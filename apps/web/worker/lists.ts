import { and, asc, eq } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createDb } from "./db"
import { list } from "./db/schema"
import { requireUser, type AuthedEnv } from "./session"

const NAME_MAX = 200

export const lists = new Hono<AuthedEnv>()

lists.use("*", requireUser)

lists.get("/", async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(list)
    .where(eq(list.userId, c.get("userId")))
    .orderBy(asc(list.createdAt))

  return c.json({ lists: rows.map(serializeList) })
})

lists.post("/", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const name = parseName(body.name)
  if (typeof name !== "string") {
    return c.json({ error: name.error }, 400)
  }

  const parentId = body.parentId ?? null
  if (parentId !== null && typeof parentId !== "string") {
    return c.json({ error: "parentId must be a string" }, 400)
  }

  const db = createDb(c.env.DB)
  const userId = c.get("userId")

  if (parentId) {
    const [parent] = await db
      .select({ id: list.id })
      .from(list)
      .where(and(eq(list.id, parentId), eq(list.userId, userId)))
      .limit(1)
    if (!parent) {
      return c.json({ error: "Parent list not found" }, 404)
    }
  }

  const now = new Date()
  const [created] = await db
    .insert(list)
    .values({
      id: crypto.randomUUID(),
      userId,
      parentId,
      name,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ list: serializeList(created) }, 201)
})

lists.patch("/:id", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const name = parseName(body.name)
  if (typeof name !== "string") {
    return c.json({ error: name.error }, 400)
  }

  const db = createDb(c.env.DB)
  const [updated] = await db
    .update(list)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(list.id, c.req.param("id")), eq(list.userId, c.get("userId"))))
    .returning()

  if (!updated) {
    return c.json({ error: "Not found" }, 404)
  }

  return c.json({ list: serializeList(updated) })
})

lists.delete("/:id", async (c) => {
  const db = createDb(c.env.DB)
  const [deleted] = await db
    .delete(list)
    .where(and(eq(list.id, c.req.param("id")), eq(list.userId, c.get("userId"))))
    .returning({ id: list.id })

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

function parseName(value: unknown): string | { error: string } {
  if (typeof value !== "string") {
    return { error: "Name is required" }
  }
  const name = value.trim()
  if (!name) {
    return { error: "Name is required" }
  }
  if (name.length > NAME_MAX) {
    return { error: `Name must be ${NAME_MAX} characters or fewer` }
  }
  return name
}

function serializeList(row: typeof list.$inferSelect) {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
