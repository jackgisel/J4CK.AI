import { WorkflowEntrypoint } from "cloudflare:workers"
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { and, eq, sql } from "drizzle-orm"

import {
  priceEstimate,
  readPrices,
  type Plan,
  type StepTokens,
} from "./card-estimate"
import { createDb } from "./db"
import { card } from "./db/schema"
import { completeJson, MODELS_URL } from "./openrouter"

export type CardResearchParams = {
  cardId: string
  userId: string
}

export const RESEARCH_MODEL = "deepseek/deepseek-v4-flash"

const RESEARCH_TOKENS = 4000
const ESTIMATE_TOKENS = 3000

const STEP_CONFIG = {
  retries: {
    limit: 2,
    delay: "8 seconds" as const,
    backoff: "exponential" as const,
  },
  timeout: "5 minutes" as const,
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "approach", "steps", "unknowns"],
  properties: {
    summary: { type: "string" },
    approach: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
      },
    },
    unknowns: { type: "array", items: { type: "string" } },
  },
}

const TOKENS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "inputTokens", "outputTokens"],
        properties: {
          title: { type: "string" },
          inputTokens: { type: "integer" },
          outputTokens: { type: "integer" },
        },
      },
    },
  },
}

const RESEARCH_SYSTEM = `You are a research agent. A person described a task out loud, and the text may contain transcription mistakes. Work out how an AI agent could carry it out.

Return a one-sentence summary, the approach in a few sentences, 2 to 8 concrete steps in order, and anything you would need to ask or check before starting. Do not start the work.`

const ESTIMATE_SYSTEM = `You are a cost estimation agent. Estimate the tokens an AI agent would use on each step of a plan.

inputTokens is the total sent to the model across every turn of the step, including context that is re-sent on each turn. outputTokens is the total generated, including reasoning. Long work needs many turns, so do not guess low. Return one entry per step, using each step's title.`

export class CardResearchWorkflow extends WorkflowEntrypoint<
  Env,
  CardResearchParams
> {
  async run(event: WorkflowEvent<CardResearchParams>, step: WorkflowStep) {
    const { cardId, userId } = event.payload

    try {
      const transcript = await step.do("read card", async () => {
        const [row] = await createDb(this.env.DB)
          .select({ transcript: card.transcript })
          .from(card)
          .where(and(eq(card.id, cardId), eq(card.userId, userId)))
        return row?.transcript ?? null
      })
      if (transcript === null) {
        return
      }

      const plan = await step.do("research", STEP_CONFIG, async () => {
        const { value, costUsd } = await completeJson<Plan>(this.env, {
          model: RESEARCH_MODEL,
          name: "plan",
          system: RESEARCH_SYSTEM,
          prompt: transcript,
          schema: PLAN_SCHEMA,
          maxTokens: RESEARCH_TOKENS,
        })
        await addSpend(this.env, cardId, costUsd)
        return value
      })

      const tokens = await step.do("estimate tokens", STEP_CONFIG, async () => {
        const { value, costUsd } = await completeJson<{ steps: StepTokens[] }>(
          this.env,
          {
            model: RESEARCH_MODEL,
            name: "tokens",
            system: ESTIMATE_SYSTEM,
            prompt: JSON.stringify(plan),
            schema: TOKENS_SCHEMA,
            maxTokens: ESTIMATE_TOKENS,
          }
        )
        await addSpend(this.env, cardId, costUsd)
        return value.steps
      })

      const prices = await step.do("read prices", STEP_CONFIG, async () => {
        const response = await fetch(MODELS_URL)
        if (!response.ok) {
          throw new Error(`Model prices failed: HTTP ${response.status}`)
        }
        return readPrices(await response.json())
      })
      if (prices.length === 0) {
        throw new Error("OpenRouter listed none of the estimate models")
      }

      await step.do("ask for approval", async () => {
        const estimate = priceEstimate(tokens, prices)
        await createDb(this.env.DB)
          .update(card)
          .set({
            status: "approval",
            plan: JSON.stringify(plan),
            estimate: JSON.stringify(estimate),
            updatedAt: new Date(),
          })
          .where(and(eq(card.id, cardId), eq(card.status, "researching")))
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed"
      await step.do("send back to idea", async () => {
        await createDb(this.env.DB)
          .update(card)
          .set({ status: "idea", error: message, updatedAt: new Date() })
          .where(and(eq(card.id, cardId), eq(card.status, "researching")))
      })
    }
  }
}

// Saved as each call finishes, so a run that fails later still shows its cost.
async function addSpend(env: Env, cardId: string, costUsd: number) {
  await createDb(env.DB)
    .update(card)
    .set({ spentUsd: sql`${card.spentUsd} + ${costUsd}` })
    .where(eq(card.id, cardId))
}
