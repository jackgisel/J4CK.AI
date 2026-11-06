import { and, desc, eq, notInArray } from "drizzle-orm"
import { Hono } from "hono"

import type { Estimate, Plan } from "./card-estimate"
import { RUN_BUDGET_USD, RUN_MODEL } from "./card-run"
import { createDb } from "./db"
import { card, run, runTurn } from "./db/schema"
import type { Citation } from "./openrouter"
import { completeJson } from "./openrouter"
import { requireUser, type AuthedEnv } from "./session"

const TITLE_MODEL = "deepseek/deepseek-v4-flash"
const TITLE_MAX = 80
const TITLE_TIMEOUT_MS = 8000
const TRANSCRIPT_MAX = 8000

type Status = (typeof card.$inferSelect)["status"]

// Researching to approval and running to done only happen inside workflows. A
// card waits in approved after a run stops early, so nothing spends again
// until someone asks for it.
const MOVES: Partial<Record<Status, Status[]>> = {
  idea: ["researching"],
  approval: ["running", "idea"],
  approved: ["running"],
}

const BUSY: Status[] = ["researching", "running"]

export const cards = new Hono<AuthedEnv>()

cards.use("*", requireUser)

cards.get("/", async (c) => {
  const userId = c.get("userId")
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(card)
    .where(eq(card.userId, userId))
    .orderBy(desc(card.createdAt))
  const runs = await db
    .select()
    .from(run)
    .where(eq(run.userId, userId))
    .orderBy(desc(run.startedAt))
  const turns = await db
    .select({
      runId: runTurn.runId,
      stepTitle: runTurn.stepTitle,
      stepIndex: runTurn.stepIndex,
      costUsd: runTurn.costUsd,
      citations: runTurn.citations,
    })
    .from(runTurn)
    .innerJoin(run, eq(runTurn.runId, run.id))
    .where(eq(run.userId, userId))
    .orderBy(runTurn.stepIndex, runTurn.turn)

  return c.json({
    cards: rows.map((row) => {
      const cardRuns = runs.filter((item) => item.cardId === row.id)
      return serializeCard(row, cardRuns, turns)
    }),
  })
})

cards.post("/", async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  const transcript = parseTranscript(body)
  if (typeof transcript !== "string") {
    return c.json({ error: transcript.error }, 400)
  }

  const title = await titleFor(c.env, transcript)
  const now = new Date()
  const [created] = await createDb(c.env.DB)
    .insert(card)
    .values({
      id: crypto.randomUUID(),
      userId: c.get("userId"),
      title: title.text,
      transcript,
      spentUsd: title.costUsd,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ card: serializeCard(created) }, 201)
})

cards.patch("/:id", async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  const next = (body as { status?: unknown } | null)?.status
  const id = c.req.param("id")
  const userId = c.get("userId")
  const db = createDb(c.env.DB)

  const [row] = await db
    .select({
      status: card.status,
      estimate: card.estimate,
      plan: card.plan,
      approvedAt: card.approvedAt,
    })
    .from(card)
    .where(and(eq(card.id, id), eq(card.userId, userId)))
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const allowed = MOVES[row.status] ?? []
  if (!allowed.includes(next as Status)) {
    return c.json({ error: `Cannot move from ${row.status} to ${next}` }, 409)
  }
  const status = next as Status
  const now = new Date()

  // Matching on the old status means two clicks cannot both start work.
  const [updated] = await db
    .update(card)
    .set({
      status,
      updatedAt: now,
      error: null,
      approvedAt: status === "running" ? (row.approvedAt ?? now) : null,
      ...(status === "idea" ? { plan: null, estimate: null } : {}),
    })
    .where(and(eq(card.id, id), eq(card.status, row.status)))
    .returning()
  if (!updated) {
    return c.json({ error: "Card already moved" }, 409)
  }

  if (status === "running") {
    const error = await startRun(c.env, updated)
    if (error) {
      const [reverted] = await db
        .update(card)
        .set({ status: "approved", error, updatedAt: new Date() })
        .where(eq(card.id, id))
        .returning()
      return c.json({ error, card: reverted && serializeCard(reverted) }, 500)
    }
    return c.json({ card: serializeCard(updated) })
  }

  if (status !== "researching") {
    return c.json({ card: serializeCard(updated) })
  }

  try {
    await c.env.CARD_RESEARCH.create({ params: { cardId: id, userId } })
  } catch {
    const [reverted] = await db
      .update(card)
      .set({
        status: "idea",
        error: "Could not start research",
        updatedAt: new Date(),
      })
      .where(eq(card.id, id))
      .returning()
    return c.json(
      {
        error: "Could not start research",
        card: reverted && serializeCard(reverted),
      },
      500
    )
  }

  return c.json({ card: serializeCard(updated) })
})

cards.delete("/:id", async (c) => {
  const db = createDb(c.env.DB)
  const [deleted] = await db
    .delete(card)
    .where(
      and(
        eq(card.id, c.req.param("id")),
        eq(card.userId, c.get("userId")),
        notInArray(card.status, BUSY)
      )
    )
    .returning({ id: card.id })

  if (!deleted) {
    return c.json({ error: "Not found or still working" }, 404)
  }

  return c.body(null, 204)
})

async function startRun(env: Env, row: typeof card.$inferSelect) {
  const id = crypto.randomUUID()
  const plan = JSON.parse(row.plan ?? "null") as Plan | null
  const estimate = JSON.parse(row.estimate ?? "null") as Estimate | null
  const db = createDb(env.DB)

  await db.insert(run).values({
    id,
    cardId: row.id,
    userId: row.userId,
    model: RUN_MODEL,
    budgetUsd: RUN_BUDGET_USD,
    estimateUsd: estimate?.models.find((item) => item.id === RUN_MODEL)?.usd,
    estimateInputTokens: estimate?.inputTokens,
    estimateOutputTokens: estimate?.outputTokens,
    // The plan's steps plus the write-up at the end.
    stepCount: (plan?.steps.length ?? 0) + 1,
    startedAt: new Date(),
  })

  try {
    await env.CARD_RUN.create({
      id,
      params: { runId: id, cardId: row.id, userId: row.userId },
    })
    return null
  } catch {
    const error = "Could not start the run"
    await db
      .update(run)
      .set({ status: "failed", error, finishedAt: new Date() })
      .where(eq(run.id, id))
    return error
  }
}

async function titleFor(env: Env, transcript: string) {
  try {
    const { value, costUsd } = await completeJson<{ title: string }>(env, {
      model: TITLE_MODEL,
      name: "title",
      system:
        "Turn this spoken note into a task title of at most eight words. Fix obvious transcription mistakes. Keep the speaker's meaning.",
      prompt: transcript,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: { title: { type: "string" } },
      },
      maxTokens: 800,
      skipReasoning: true,
      signal: AbortSignal.timeout(TITLE_TIMEOUT_MS),
    })
    const text = value.title.trim().slice(0, TITLE_MAX)
    return { text: text || fallbackTitle(transcript), costUsd }
  } catch (error) {
    console.error("[cards] title failed", error)
    return { text: fallbackTitle(transcript), costUsd: 0 }
  }
}

function fallbackTitle(transcript: string) {
  return transcript.split(/\s+/).slice(0, 8).join(" ").slice(0, TITLE_MAX)
}

function parseTranscript(body: unknown): string | { error: string } {
  const value = (body as { transcript?: unknown } | null)?.transcript
  if (typeof value !== "string" || !value.trim()) {
    return { error: "Say something first" }
  }
  const transcript = value.trim()
  if (transcript.length > TRANSCRIPT_MAX) {
    return { error: `Keep it under ${TRANSCRIPT_MAX} characters` }
  }
  return transcript
}

type TurnSummary = Pick<
  typeof runTurn.$inferSelect,
  "runId" | "stepTitle" | "stepIndex" | "costUsd" | "citations"
>

function serializeCard(
  row: typeof card.$inferSelect,
  runs: Array<typeof run.$inferSelect> = [],
  turns: TurnSummary[] = []
) {
  const [latest] = runs

  return {
    id: row.id,
    title: row.title,
    transcript: row.transcript,
    status: row.status,
    plan: row.plan ? JSON.parse(row.plan) : null,
    estimate: row.estimate ? JSON.parse(row.estimate) : null,
    spentUsd: row.spentUsd,
    runSpentUsd: runs.reduce((total, item) => total + item.costUsd, 0),
    runLimit: { model: RUN_MODEL, budgetUsd: RUN_BUDGET_USD },
    run: latest ? serializeRun(latest, turns) : null,
    error: row.error,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeRun(row: typeof run.$inferSelect, turns: TurnSummary[]) {
  const own = turns.filter((turn) => turn.runId === row.id)
  const steps = new Map<number, { title: string; costUsd: number }>()
  const sources = new Map<string, Citation>()

  for (const turn of own) {
    const step = steps.get(turn.stepIndex)
    steps.set(turn.stepIndex, {
      title: turn.stepTitle,
      costUsd: (step?.costUsd ?? 0) + turn.costUsd,
    })
    for (const source of JSON.parse(turn.citations) as Citation[]) {
      sources.set(source.url, source)
    }
  }

  return {
    id: row.id,
    model: row.model,
    status: row.status,
    budgetUsd: row.budgetUsd,
    estimateUsd: row.estimateUsd,
    estimateInputTokens: row.estimateInputTokens,
    estimateOutputTokens: row.estimateOutputTokens,
    stepCount: row.stepCount,
    stepsDone: row.stepsDone,
    turns: row.turns,
    retries: row.retries,
    inputTokens: row.inputTokens,
    cachedTokens: row.cachedTokens,
    outputTokens: row.outputTokens,
    reasoningTokens: row.reasoningTokens,
    costUsd: row.costUsd,
    searchUsd: row.searchUsd,
    result: row.result,
    error: row.error,
    steps: [...steps.values()],
    sources: [...sources.values()],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  }
}
