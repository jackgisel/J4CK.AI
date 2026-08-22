import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { guy, message } from "./db/schema"

type AppEnv = {
  Bindings: Env
  Variables: { userId: string }
}

const NAME_MAX = 80
const BACKSTORY_MAX = 8000
const BODY_MAX = 4000
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export const guys = new Hono<AppEnv>()

guys.use("*", async (c, next) => {
  const session = await createAuth(c.env, c.req.raw).api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  c.set("userId", session.user.id)
  await next()
})

guys.get("/", async (c) => {
  const db = createDb(c.env.DB)
  const userId = c.get("userId")
  const rows = await db
    .select()
    .from(guy)
    .where(eq(guy.userId, userId))
    .orderBy(desc(guy.createdAt))

  const lastByGuy = new Map<string, typeof message.$inferSelect>()
  const ids = rows.map((row) => row.id)
  if (ids.length > 0) {
    const messages = await db
      .select()
      .from(message)
      .where(inArray(message.guyId, ids))
      .orderBy(desc(message.createdAt))

    for (const row of messages) {
      if (!lastByGuy.has(row.guyId)) {
        lastByGuy.set(row.guyId, row)
      }
    }
  }

  return c.json({
    guys: rows.map((row) => serializeGuy(row, lastByGuy.get(row.id) ?? null)),
  })
})

guys.post("/", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const name = parseName(body.name)
  if (typeof name !== "string") {
    return c.json({ error: name.error }, 400)
  }

  const color = parseColor(body.color)
  if (typeof color !== "string") {
    return c.json({ error: color.error }, 400)
  }

  const backstory = parseBackstory(body.backstory ?? "")
  if (typeof backstory !== "string") {
    return c.json({ error: backstory.error }, 400)
  }

  const now = new Date()
  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(guy)
    .values({
      id: crypto.randomUUID(),
      userId: c.get("userId"),
      name,
      color,
      backstory,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ guy: serializeGuy(created, null) }, 201)
})

guys.get("/:id", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  return c.json({ guy: serializeGuy(row, null) })
})

guys.patch("/:id", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const patch: {
    name?: string
    color?: string
    backstory?: string
    updatedAt: Date
  } = { updatedAt: new Date() }

  if ("name" in body) {
    const name = parseName(body.name)
    if (typeof name !== "string") {
      return c.json({ error: name.error }, 400)
    }
    patch.name = name
  }

  if ("color" in body) {
    const color = parseColor(body.color)
    if (typeof color !== "string") {
      return c.json({ error: color.error }, 400)
    }
    patch.color = color
  }

  if ("backstory" in body) {
    const backstory = parseBackstory(body.backstory)
    if (typeof backstory !== "string") {
      return c.json({ error: backstory.error }, 400)
    }
    patch.backstory = backstory
  }

  if (
    patch.name === undefined &&
    patch.color === undefined &&
    patch.backstory === undefined
  ) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const db = createDb(c.env.DB)
  const [updated] = await db
    .update(guy)
    .set(patch)
    .where(eq(guy.id, row.id))
    .returning()

  if (!updated) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ guy: serializeGuy(updated, null) })
})

guys.delete("/:id", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const db = createDb(c.env.DB)
  await db.delete(guy).where(eq(guy.id, row.id))
  return c.body(null, 204)
})

guys.get("/:id/messages", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(message)
    .where(eq(message.guyId, row.id))
    .orderBy(asc(message.createdAt))

  return c.json({
    guy: serializeGuy(row, null),
    messages: rows.map(serializeMessage),
  })
})

guys.post("/:id/messages", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const text = parseBody(body.body)
  if (typeof text !== "string") {
    return c.json({ error: text.error }, 400)
  }

  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(message)
    .values({
      id: crypto.randomUUID(),
      guyId: row.id,
      role: "user",
      body: text,
      createdAt: new Date(),
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not send" }, 500)
  }

  return c.json({ message: serializeMessage(created) }, 201)
})

async function findOwnedGuy(c: Context<AppEnv>) {
  const id = c.req.param("id")
  if (!id) {
    return null
  }

  const db = createDb(c.env.DB)
  const [row] = await db
    .select()
    .from(guy)
    .where(and(eq(guy.id, id), eq(guy.userId, c.get("userId"))))
    .limit(1)

  return row ?? null
}

async function readObject(c: {
  req: { json: () => Promise<unknown> }
}): Promise<Record<string, unknown> | null> {
  try {
    const value = await c.req.json()
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function parseName(value: unknown) {
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

function parseColor(value: unknown) {
  if (typeof value !== "string" || !COLOR_RE.test(value)) {
    return { error: "Color must be a hex value like #0f766e" }
  }
  return value.toLowerCase()
}

function parseBackstory(value: unknown) {
  if (value === undefined || value === null) {
    return ""
  }
  if (typeof value !== "string") {
    return { error: "Backstory must be text" }
  }
  if (value.length > BACKSTORY_MAX) {
    return { error: `Backstory must be ${BACKSTORY_MAX} characters or fewer` }
  }
  return value
}

function parseBody(value: unknown) {
  if (typeof value !== "string") {
    return { error: "Message is required" }
  }
  const body = value.trim()
  if (!body) {
    return { error: "Message is required" }
  }
  if (body.length > BODY_MAX) {
    return { error: `Message must be ${BODY_MAX} characters or fewer` }
  }
  return body
}

function serializeGuy(
  row: typeof guy.$inferSelect,
  last: typeof message.$inferSelect | null
) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    backstory: row.backstory,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessage: last ? serializeMessage(last) : null,
  }
}

function serializeMessage(row: typeof message.$inferSelect) {
  return {
    id: row.id,
    guyId: row.guyId,
    role: row.role,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}
