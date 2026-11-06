import { WorkflowEntrypoint } from "cloudflare:workers"
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { NonRetryableError } from "cloudflare:workflows"
import { and, eq, sql } from "drizzle-orm"

import { type ModelPrice, type Plan, readPrices } from "./card-estimate"
import { createDb } from "./db"
import { card, run, runTurn } from "./db/schema"
import {
  type ChatMessage,
  completeText,
  MODELS_URL,
  OpenRouterError,
  type TextResult,
} from "./openrouter"

export type CardRunParams = {
  runId: string
  cardId: string
  userId: string
}

export const RUN_MODEL = "deepseek/deepseek-v4-flash"
export const RUN_BUDGET_USD = 1

const MAX_OUTPUT_TOKENS = 8000
const MAX_TURNS_PER_STEP = 3
const SEARCHES_PER_TURN = 3

// Exa's fee per search, and room for what its results add to the prompt.
const SEARCH_FEE_USD = 0.007
const SEARCH_RESULT_TOKENS = 20_000

const READ_CONFIG = {
  retries: {
    limit: 2,
    delay: "8 seconds" as const,
    backoff: "exponential" as const,
  },
  timeout: "1 minute" as const,
}

const TURN_CONFIG = {
  retries: {
    limit: 3,
    delay: "15 seconds" as const,
    backoff: "exponential" as const,
  },
  timeout: "10 minutes" as const,
}

const RUN_SYSTEM = `You are carrying out a task for a person, one step at a time.

Use the web search tool whenever a step depends on current or outside facts. Never invent sources, prices, reviews or findings. If you cannot find something, say so.

Later steps only see what you write, not your search results, so write down what you found and where. Work only on the step you are given. You cannot ask the person anything, so pick a sensible assumption, state it and carry on.`

const FINAL_STEP = {
  title: "Final result",
  detail:
    "Write the finished result for the person. Use only what the earlier steps found, and name the sources it came from. Start with the answer itself, with no step heading.",
}

type Task = {
  transcript: string
  plan: Plan
}

type Outcome = {
  status: "finished" | "capped" | "turn_limit" | "failed"
  error?: string
}

export type Reply = TextResult & {
  costUsd: number
  retries: number
  durationMs: number
}

export class CardRunWorkflow extends WorkflowEntrypoint<Env, CardRunParams> {
  async run(event: WorkflowEvent<CardRunParams>, step: WorkflowStep) {
    const { runId, cardId } = event.payload
    const outputs: string[] = []

    const outcome = await this.work(event.payload, step, outputs).catch(
      (error): Outcome => ({
        status: "failed",
        // Workflows prepends the class name, and this text reaches the board.
        error:
          error instanceof Error
            ? error.message.replace(/^NonRetryableError: /, "")
            : "Run failed",
      })
    )

    await step.do("finish run", async () => {
      const finished = outcome.status === "finished"
      const db = createDb(this.env.DB)
      const now = new Date()
      await db.batch([
        db
          .update(run)
          .set({
            status: outcome.status,
            error: outcome.error ?? null,
            // A stopped run keeps its notes, since they cost money to make.
            result: finished ? outputs.at(-1) : outputs.join("\n\n"),
            finishedAt: now,
          })
          .where(eq(run.id, runId)),
        db
          .update(card)
          .set({
            status: finished ? "done" : "approved",
            error: outcome.error ?? null,
            updatedAt: now,
          })
          .where(and(eq(card.id, cardId), eq(card.status, "running"))),
      ])
    })
  }

  private async work(
    { runId, cardId, userId }: CardRunParams,
    step: WorkflowStep,
    outputs: string[]
  ): Promise<Outcome> {
    const task = await step.do("read task", READ_CONFIG, () =>
      readTask(this.env, cardId, userId)
    )
    if (!task) {
      return { status: "failed", error: "This card has no plan to run" }
    }

    const price = await step.do("read price", READ_CONFIG, () =>
      readPrice(this.env, runId)
    )

    const steps = [...task.plan.steps, FINAL_STEP]
    const messages: ChatMessage[] = [{ role: "system", content: RUN_SYSTEM }]
    let spent = 0
    let provider: string | undefined

    for (const [index, planStep] of steps.entries()) {
      const last = index === steps.length - 1
      const searches = last ? 0 : SEARCHES_PER_TURN
      const label = `Step ${index + 1} of ${steps.length}`
      messages.push({
        role: "user",
        content: stepPrompt(task, index, label, planStep),
      })

      const parts: string[] = []
      let finishReason = "unknown"

      for (let turn = 1; turn <= MAX_TURNS_PER_STEP; turn++) {
        if (spent + worstCaseUsd(messages, searches, price) > RUN_BUDGET_USD) {
          outputs.push(...parts)
          return {
            status: "capped",
            error: `Stopped at the ${usd(RUN_BUDGET_USD)} cap on ${label.toLowerCase()}, with ${usd(spent)} spent`,
          }
        }

        const name = `step ${index + 1} turn ${turn}`
        const reply: Reply = await step.do(name, TURN_CONFIG, (ctx) =>
          callModel(
            this.env,
            { messages, searches, provider, price },
            ctx.attempt
          )
        )
        const complete = reply.finishReason === "stop" && reply.text !== ""

        // Separate from the call, so a failed write cannot pay for it twice.
        await step.do(`save ${name}`, READ_CONFIG, () =>
          saveTurn(this.env, {
            runId,
            stepIndex: index,
            stepTitle: planStep.title,
            turn,
            reply,
            stepsDone: complete ? index + 1 : index,
          })
        )

        spent += reply.costUsd
        provider ??= reply.provider ?? undefined
        finishReason = reply.finishReason

        if (reply.text) {
          parts.push(reply.text)
          messages.push({ role: "assistant", content: reply.text })
        }
        if (complete) {
          break
        }
        if (reply.text) {
          messages.push({
            role: "user",
            content: "Continue exactly where you stopped.",
          })
        }
        if (turn === MAX_TURNS_PER_STEP) {
          outputs.push(parts.join("\n"))
          return {
            status: "turn_limit",
            error: `${label} did not finish in ${MAX_TURNS_PER_STEP} turns (${finishReason})`,
          }
        }
      }

      outputs.push(parts.join("\n"))
    }

    return { status: "finished" }
  }
}

async function readTask(env: Env, cardId: string, userId: string) {
  const [row] = await createDb(env.DB)
    .select({ transcript: card.transcript, plan: card.plan })
    .from(card)
    .where(and(eq(card.id, cardId), eq(card.userId, userId)))
  if (!row?.plan) {
    return null
  }
  return { transcript: row.transcript, plan: JSON.parse(row.plan) as Plan }
}

async function readPrice(env: Env, runId: string) {
  const [row] = await createDb(env.DB)
    .select({ model: run.model })
    .from(run)
    .where(eq(run.id, runId))
  const response = await fetch(MODELS_URL)
  if (!response.ok) {
    throw new Error(`Model prices failed: HTTP ${response.status}`)
  }
  const [price] = readPrices(await response.json(), [row?.model ?? RUN_MODEL])
  if (!price) {
    throw new NonRetryableError("OpenRouter did not list the run model")
  }
  return price
}

async function callModel(
  env: Env,
  request: {
    messages: ChatMessage[]
    searches: number
    provider: string | undefined
    price: ModelPrice
  },
  attempt: number
): Promise<Reply> {
  const started = Date.now()
  try {
    const reply = await completeText(env, {
      model: request.price.id,
      messages: request.messages,
      maxTokens: MAX_OUTPUT_TOKENS,
      searches: request.searches,
      provider: request.provider,
    })
    return {
      ...reply,
      // A missing cost must not read as free, or the cap would never trip.
      costUsd:
        reply.costUsd ??
        tokenUsd(reply.inputTokens, reply.outputTokens, request.price),
      retries: attempt - 1,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    // No credits or a bad request will fail the same way every time.
    if (
      error instanceof OpenRouterError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408 &&
      error.status !== 429
    ) {
      throw new NonRetryableError(error.message)
    }
    throw error
  }
}

export async function saveTurn(
  env: Env,
  turn: {
    runId: string
    stepIndex: number
    stepTitle: string
    turn: number
    reply: Reply
    stepsDone: number
  }
) {
  const { runId, reply } = turn
  const db = createDb(env.DB)
  const total = (column: string) =>
    sql`(select coalesce(sum(${sql.identifier(column)}), 0) from run_turn where run_id = ${runId})`

  await db.batch([
    db
      .insert(runTurn)
      .values({
        id: `${runId}:${turn.stepIndex}:${turn.turn}`,
        runId,
        stepIndex: turn.stepIndex,
        stepTitle: turn.stepTitle,
        turn: turn.turn,
        provider: reply.provider,
        finishReason: reply.finishReason,
        retries: reply.retries,
        inputTokens: reply.inputTokens,
        cachedTokens: reply.cachedTokens,
        outputTokens: reply.outputTokens,
        reasoningTokens: reply.reasoningTokens,
        searches: reply.searches,
        costUsd: reply.costUsd,
        searchUsd: reply.searchUsd,
        durationMs: reply.durationMs,
        output: reply.text,
        citations: JSON.stringify(reply.citations),
        createdAt: new Date(),
      })
      .onConflictDoNothing(),
    db
      .update(run)
      .set({
        stepsDone: turn.stepsDone,
        turns: sql`(select count(*) from run_turn where run_id = ${runId})`,
        retries: total("retries"),
        inputTokens: total("input_tokens"),
        cachedTokens: total("cached_tokens"),
        outputTokens: total("output_tokens"),
        reasoningTokens: total("reasoning_tokens"),
        costUsd: total("cost_usd"),
        searchUsd: total("search_usd"),
      })
      .where(eq(run.id, runId)),
  ])
}

function stepPrompt(
  task: Task,
  index: number,
  label: string,
  step: { title: string; detail: string }
) {
  const prompt = `${label}: ${step.title}. ${step.detail}`
  if (index > 0) {
    return prompt
  }

  const { plan, transcript } = task
  const steps = plan.steps.map((item, at) => `${at + 1}. ${item.title}`)
  return [
    `The person said: "${transcript}"`,
    `Goal: ${plan.summary}`,
    `Approach: ${plan.approach}`,
    `Plan:\n${steps.join("\n")}`,
    `Questions nobody answered, so assume something: ${plan.unknowns.join(" ") || "none"}`,
    prompt,
  ].join("\n\n")
}

// The most a call can cost, so the cap stops a run before it overspends. Four
// characters is roughly one token, so three stays on the safe side, and each
// search sends the whole prompt to the model again.
function worstCaseUsd(
  messages: ChatMessage[],
  searches: number,
  price: ModelPrice
) {
  const chars = messages.reduce((total, row) => total + row.content.length, 0)
  const prompt = chars / 3 + searches * SEARCH_RESULT_TOKENS
  return (
    tokenUsd(prompt * (searches + 1), MAX_OUTPUT_TOKENS, price) +
    searches * SEARCH_FEE_USD
  )
}

function tokenUsd(input: number, output: number, price: ModelPrice) {
  return (input * price.inputPerM + output * price.outputPerM) / 1_000_000
}

function usd(value: number) {
  return `$${value.toFixed(value < 0.01 ? 4 : 2)}`
}
