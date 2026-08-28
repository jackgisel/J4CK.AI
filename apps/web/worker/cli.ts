import { and, desc, eq } from "drizzle-orm"
import { Hono } from "hono"

import { createDb } from "./db"
import { cliDevice, cliToken } from "./db/schema"
import { getCookieUser, getRequestUser } from "./session"
import { generateToken, hashToken, tokenPrefix } from "./token"

const DEVICE_TTL_MS = 10 * 60 * 1000
const HOST_MAX = 80
const NAME_MAX = 80

type AppEnv = { Bindings: Env }

export const cli = new Hono<AppEnv>()

cli.get("/me", async (c) => {
  const user = await getRequestUser(c.env, c.req.raw)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  return c.json({ id: user.id, name: user.name, email: user.email })
})

cli.post("/device", async (c) => {
  const body = await readObject(c)
  const hostname = parseLabel(body?.hostname, HOST_MAX)
  const now = Date.now()
  const id = crypto.randomUUID()
  const db = createDb(c.env.DB)
  await db.insert(cliDevice).values({
    id,
    hostname,
    expiresAt: new Date(now + DEVICE_TTL_MS),
    createdAt: new Date(now),
  })
  const origin = new URL(c.req.url).origin
  return c.json(
    {
      id,
      verifyUrl: `${origin}/cli?device=${id}`,
      expiresIn: DEVICE_TTL_MS / 1000,
    },
    201
  )
})

cli.get("/device/:id", async (c) => {
  const row = await findDevice(c)
  if (!row) {
    return c.json({ status: "expired" })
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return c.json({ status: "expired" })
  }
  if (row.token) {
    return c.json({ status: "approved", hostname: row.hostname })
  }
  return c.json({ status: "pending", hostname: row.hostname })
})

cli.post("/device/:id/approve", async (c) => {
  const user = await getCookieUser(c.env, c.req.raw)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  const row = await findDevice(c)
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return c.json({ error: "That link expired. Run j4ck login again." }, 410)
  }
  if (row.token) {
    return c.json({ status: "approved", hostname: row.hostname })
  }

  const body = await readObject(c)
  const name = parseLabel(body?.name, NAME_MAX) || deviceName(row.hostname)
  const created = await issueToken(c.env, user.id, name)
  const db = createDb(c.env.DB)
  await db
    .update(cliDevice)
    .set({ userId: user.id, token: created.token })
    .where(eq(cliDevice.id, row.id))

  return c.json({ status: "approved", hostname: row.hostname, name })
})

cli.post("/device/:id/token", async (c) => {
  const row = await findDevice(c)
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return c.json({ status: "expired" })
  }
  if (!row.token) {
    return c.json({ status: "pending" })
  }

  const db = createDb(c.env.DB)
  await db.delete(cliDevice).where(eq(cliDevice.id, row.id))
  return c.json({ status: "approved", token: row.token })
})

cli.get("/tokens", async (c) => {
  const user = await getCookieUser(c.env, c.req.raw)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  const db = createDb(c.env.DB)
  const rows = await db
    .select({
      id: cliToken.id,
      name: cliToken.name,
      prefix: cliToken.prefix,
      createdAt: cliToken.createdAt,
      lastUsedAt: cliToken.lastUsedAt,
    })
    .from(cliToken)
    .where(eq(cliToken.userId, user.id))
    .orderBy(desc(cliToken.createdAt))

  return c.json({
    tokens: rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    })),
  })
})

cli.post("/tokens", async (c) => {
  const user = await getCookieUser(c.env, c.req.raw)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  const body = await readObject(c)
  const name = parseLabel(body?.name, NAME_MAX) || "Mac"
  const created = await issueToken(c.env, user.id, name)
  return c.json(
    {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      token: created.token,
      createdAt: created.createdAt.toISOString(),
    },
    201
  )
})

cli.delete("/tokens/:id", async (c) => {
  const user = await getCookieUser(c.env, c.req.raw)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  const id = c.req.param("id")
  if (!id) {
    return c.json({ error: "Not found" }, 404)
  }
  const db = createDb(c.env.DB)
  const deleted = await db
    .delete(cliToken)
    .where(and(eq(cliToken.id, id), eq(cliToken.userId, user.id)))
    .returning({ id: cliToken.id })
  if (deleted.length === 0) {
    return c.json({ error: "Not found" }, 404)
  }
  return c.body(null, 204)
})

async function issueToken(env: Env, userId: string, name: string) {
  const token = generateToken()
  const now = new Date()
  const id = crypto.randomUUID()
  const db = createDb(env.DB)
  await db.insert(cliToken).values({
    id,
    userId,
    name,
    tokenHash: await hashToken(token),
    prefix: tokenPrefix(token),
    createdAt: now,
  })
  return { id, name, prefix: tokenPrefix(token), token, createdAt: now }
}

async function findDevice(c: {
  env: Env
  req: { param: (name: string) => string }
}) {
  const id = c.req.param("id")
  if (!id) {
    return null
  }
  const db = createDb(c.env.DB)
  const [row] = await db
    .select()
    .from(cliDevice)
    .where(eq(cliDevice.id, id))
    .limit(1)
  return row ?? null
}

function deviceName(hostname: string) {
  if (hostname) {
    return hostname
  }
  return "Mac"
}

function parseLabel(value: unknown, max: number) {
  if (typeof value !== "string") {
    return ""
  }
  return value.trim().slice(0, max)
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
