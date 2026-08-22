import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { guy, message } from "./db/schema"
import { generateReply, HISTORY_LIMIT } from "./reply"

type AppEnv = {
  Bindings: Env
  Variables: { userId: string; userName: string }
}

const NAME_MAX = 80
const BACKSTORY_MAX = 8000
const BODY_MAX = 4000
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const AVATAR_EYES = [
  "dots",
  "wide",
  "sleepy",
  "angry",
  "squint",
  "glasses",
] as const
const AVATAR_FACIAL_HAIR = [
  "none",
  "stubble",
  "mustache",
  "beard",
  "goatee",
] as const
const AVATAR_HATS = [
  "none",
  "cap",
  "beanie",
  "hardhat",
  "tophat",
  "cowboy",
] as const

export const guys = new Hono<AppEnv>()

guys.use("*", async (c, next) => {
  const session = await createAuth(c.env, c.req.raw).api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  c.set("userId", session.user.id)
  c.set("userName", session.user.name)
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

  const avatarEyes = parseTrait(body.avatarEyes, AVATAR_EYES, "dots", "eyes")
  if (typeof avatarEyes !== "string") {
    return c.json({ error: avatarEyes.error }, 400)
  }

  const avatarFacialHair = parseTrait(
    body.avatarFacialHair,
    AVATAR_FACIAL_HAIR,
    "none",
    "facial hair"
  )
  if (typeof avatarFacialHair !== "string") {
    return c.json({ error: avatarFacialHair.error }, 400)
  }

  const avatarHat = parseTrait(body.avatarHat, AVATAR_HATS, "none", "hat")
  if (typeof avatarHat !== "string") {
    return c.json({ error: avatarHat.error }, 400)
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
      avatarEyes,
      avatarFacialHair,
      avatarHat,
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
    avatarEyes?: string
    avatarFacialHair?: string
    avatarHat?: string
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

  if ("avatarEyes" in body) {
    const avatarEyes = parseTrait(body.avatarEyes, AVATAR_EYES, "dots", "eyes")
    if (typeof avatarEyes !== "string") {
      return c.json({ error: avatarEyes.error }, 400)
    }
    patch.avatarEyes = avatarEyes
  }

  if ("avatarFacialHair" in body) {
    const avatarFacialHair = parseTrait(
      body.avatarFacialHair,
      AVATAR_FACIAL_HAIR,
      "none",
      "facial hair"
    )
    if (typeof avatarFacialHair !== "string") {
      return c.json({ error: avatarFacialHair.error }, 400)
    }
    patch.avatarFacialHair = avatarFacialHair
  }

  if ("avatarHat" in body) {
    const avatarHat = parseTrait(body.avatarHat, AVATAR_HATS, "none", "hat")
    if (typeof avatarHat !== "string") {
      return c.json({ error: avatarHat.error }, 400)
    }
    patch.avatarHat = avatarHat
  }

  if (
    patch.name === undefined &&
    patch.color === undefined &&
    patch.backstory === undefined &&
    patch.avatarEyes === undefined &&
    patch.avatarFacialHair === undefined &&
    patch.avatarHat === undefined
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

  const reply = await writeAssistantReply(c.env, c.get("userName"), row)

  return c.json(
    {
      message: serializeMessage(created),
      reply: reply ? serializeMessage(reply) : null,
    },
    201
  )
})

guys.post("/:id/reply", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const reply = await writeAssistantReply(c.env, c.get("userName"), row)
  return c.json({ reply: reply ? serializeMessage(reply) : null })
})

async function writeAssistantReply(
  env: Env,
  userName: string,
  row: typeof guy.$inferSelect
) {
  const db = createDb(env.DB)
  const recent = await db
    .select()
    .from(message)
    .where(eq(message.guyId, row.id))
    .orderBy(desc(message.createdAt))
    .limit(HISTORY_LIMIT)

  if (!recent[0] || recent[0].role !== "user") {
    return null
  }

  const history = recent.reverse()
  const replyText = await generateReply(env.AI, row, userName, history)
  if (!replyText) {
    return null
  }

  const [reply] = await db
    .insert(message)
    .values({
      id: crypto.randomUUID(),
      guyId: row.id,
      role: "assistant",
      body: replyText,
      createdAt: new Date(),
    })
    .returning()

  return reply ?? null
}

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

function parseTrait<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string
) {
  if (value === undefined || value === null || value === "") {
    return fallback
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return { error: `Unknown ${label}` }
  }
  return value as T
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
    avatarEyes: row.avatarEyes,
    avatarFacialHair: row.avatarFacialHair,
    avatarHat: row.avatarHat,
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
