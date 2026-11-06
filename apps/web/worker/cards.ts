import { and, desc, eq, sql } from "drizzle-orm"
import { Hono } from "hono"

import { createDb } from "./db"
import { card } from "./db/schema"
import { completeJson } from "./openrouter"
import { requireUser, type AuthedEnv } from "./session"

const TITLE_MODEL = "deepseek/deepseek-v4-flash"
const TITLE_MAX = 80
const TITLE_TIMEOUT_MS = 8000
const TRANSCRIPT_MAX = 8000

type Status = (typeof card.$inferSelect)["status"]

// Researching to approval only happens inside the workflow.
const MOVES: Partial<Record<Status, Status[]>> = {
  idea: ["researching"],
  approval: ["approved", "idea"],
}

export const cards = new Hono<AuthedEnv>()

cards.use("*", requireUser)

cards.get("/", async (c) => {
  const rows = await createDb(c.env.DB)
    .select()
    .from(card)
    .where(eq(card.userId, c.get("userId")))
    .orderBy(desc(card.createdAt))

  return c.json({ cards: rows.map(serializeCard) })
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
    .select({ status: card.status })
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

  // Matching on the old status means two clicks cannot both start research.
  const [updated] = await db
    .update(card)
    .set({
      status,
      updatedAt: now,
      error: null,
      approvedAt: status === "approved" ? now : null,
      ...(status === "idea" ? { plan: null, estimate: null } : {}),
    })
    .where(and(eq(card.id, id), eq(card.status, row.status)))
    .returning()
  if (!updated) {
    return c.json({ error: "Card already moved" }, 409)
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
        sql`${card.status} != 'researching'`
      )
    )
    .returning({ id: card.id })

  if (!deleted) {
    return c.json({ error: "Not found or still researching" }, 404)
  }

  return c.body(null, 204)
})

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

function serializeCard(row: typeof card.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    transcript: row.transcript,
    status: row.status,
    plan: row.plan ? JSON.parse(row.plan) : null,
    estimate: row.estimate ? JSON.parse(row.estimate) : null,
    spentUsd: row.spentUsd,
    error: row.error,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
