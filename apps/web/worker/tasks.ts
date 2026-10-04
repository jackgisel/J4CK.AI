import { and, asc, desc, eq } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createDb } from "./db"
import { task } from "./db/schema"
import { requireUser, type AuthedEnv } from "./session"

const TITLE_MAX = 500

export const tasks = new Hono<AuthedEnv>()

tasks.use("*", requireUser)

tasks.get("/", async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(task)
    .where(eq(task.userId, c.get("userId")))
    .orderBy(asc(task.done), desc(task.completedAt), asc(task.createdAt))

  return c.json({ tasks: rows.map(serializeTask) })
})

tasks.post("/", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const title = parseTitle(body.title)
  if (typeof title !== "string") {
    return c.json({ error: title.error }, 400)
  }

  const now = new Date()
  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(task)
    .values({
      id: crypto.randomUUID(),
      userId: c.get("userId"),
      title,
      done: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ task: serializeTask(created) }, 201)
})

tasks.patch("/:id", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const now = new Date()
  const patch: {
    title?: string
    done?: boolean
    completedAt?: Date | null
    updatedAt: Date
  } = { updatedAt: now }

  if ("title" in body) {
    const title = parseTitle(body.title)
    if (typeof title !== "string") {
      return c.json({ error: title.error }, 400)
    }
    patch.title = title
  }

  if ("done" in body) {
    if (typeof body.done !== "boolean") {
      return c.json({ error: "done must be true or false" }, 400)
    }
    patch.done = body.done
    patch.completedAt = body.done ? now : null
  }

  if (patch.title === undefined && patch.done === undefined) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const db = createDb(c.env.DB)
  const [updated] = await db
    .update(task)
    .set(patch)
    .where(and(eq(task.id, c.req.param("id")), eq(task.userId, c.get("userId"))))
    .returning()

  if (!updated) {
    return c.json({ error: "Not found" }, 404)
  }

  return c.json({ task: serializeTask(updated) })
})

tasks.delete("/:id", async (c) => {
  const db = createDb(c.env.DB)
  const [deleted] = await db
    .delete(task)
    .where(and(eq(task.id, c.req.param("id")), eq(task.userId, c.get("userId"))))
    .returning({ id: task.id })

  if (!deleted) {
    return c.json({ error: "Not found" }, 404)
  }

  return c.body(null, 204)
})

async function readObject(c: Context<AuthedEnv>) {
  const body: unknown = await c.req.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null
  }
  return body as Record<string, unknown>
}

function parseTitle(value: unknown): string | { error: string } {
  if (typeof value !== "string") {
    return { error: "Title is required" }
  }
  const title = value.trim()
  if (!title) {
    return { error: "Title is required" }
  }
  if (title.length > TITLE_MAX) {
    return { error: `Title must be ${TITLE_MAX} characters or fewer` }
  }
  return title
}

function serializeTask(row: typeof task.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
