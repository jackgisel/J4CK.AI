import { and, asc, desc, eq } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { studioMessage } from "./db/schema"
import { CHAT_MODELS, MODELS, isImageModel } from "./pipeline-graph"
import { extractImage, extractText, runModel } from "./pipeline-providers"

type AppEnv = {
  Bindings: Env
  Variables: { userId: string }
}

const PROMPT_MAX = 4000
const HISTORY_LIMIT = 40
const CHAT_CONTEXT = 20

export const studio = new Hono<AppEnv>()

export function studioKey(userId: string, messageId: string) {
  return `studio/${userId}/${messageId}`
}

studio.use("*", async (c, next) => {
  const session = await createAuth(c.env, c.req.raw).api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  c.set("userId", session.user.id)
  await next()
})

studio.get("/messages", async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(studioMessage)
    .where(eq(studioMessage.userId, c.get("userId")))
    .orderBy(desc(studioMessage.createdAt))
    .limit(HISTORY_LIMIT)

  return c.json({ messages: rows.reverse().map(serialize) })
})

studio.post("/messages", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const prompt = parsePrompt(body.body)
  if (typeof prompt !== "string") {
    return c.json({ error: prompt.error }, 400)
  }

  const model = parseModel(body.model)
  if (typeof model !== "string") {
    return c.json({ error: model.error }, 400)
  }

  const userId = c.get("userId")
  const db = createDb(c.env.DB)
  const history = isImageModel(model) ? [] : await recentChat(c.env, userId)

  const [asked] = await db
    .insert(studioMessage)
    .values({
      id: crypto.randomUUID(),
      userId,
      role: "user",
      model,
      body: prompt,
      createdAt: new Date(),
    })
    .returning()

  if (!asked) {
    return c.json({ error: "Could not save" }, 500)
  }

  const replyId = crypto.randomUUID()
  let reply: typeof studioMessage.$inferSelect | undefined
  try {
    reply = isImageModel(model)
      ? await answerWithImage(c.env, db, { userId, model, prompt, replyId })
      : await answerWithText(c.env, db, {
          userId,
          model,
          prompt,
          replyId,
          history,
        })
  } catch (error) {
    // The prompt stays in the thread so it can be edited and sent again.
    await db.delete(studioMessage).where(eq(studioMessage.id, asked.id))
    const message = error instanceof Error ? error.message : "Model failed"
    return c.json({ error: message }, 502)
  }

  if (!reply) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ message: serialize(asked), reply: serialize(reply) }, 201)
})

studio.get("/messages/:id/image", async (c) => {
  const row = await findOwned(c)
  if (!row?.artifactKey) {
    return c.json({ error: "Not found" }, 404)
  }
  const object = await c.env.BUCKET.get(row.artifactKey)
  if (!object) {
    return c.json({ error: "Not found" }, 404)
  }
  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ?? row.contentType ?? "image/png",
      "cache-control": "private, max-age=3600",
    },
  })
})

studio.delete("/messages", async (c) => {
  const userId = c.get("userId")
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(studioMessage)
    .where(eq(studioMessage.userId, userId))

  for (const row of rows) {
    if (row.artifactKey) {
      await c.env.BUCKET.delete(row.artifactKey)
    }
  }
  await db.delete(studioMessage).where(eq(studioMessage.userId, userId))
  return c.body(null, 204)
})

async function answerWithImage(
  env: Env,
  db: ReturnType<typeof createDb>,
  ctx: { userId: string; model: string; prompt: string; replyId: string }
) {
  const result = await runModel(env, ctx.model, { prompt: ctx.prompt })
  const image = await extractImage(result)
  const key = studioKey(ctx.userId, ctx.replyId)
  await env.BUCKET.put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
  })

  const [row] = await db
    .insert(studioMessage)
    .values({
      id: ctx.replyId,
      userId: ctx.userId,
      role: "assistant",
      model: ctx.model,
      body: ctx.prompt,
      artifactKey: key,
      contentType: image.contentType,
      createdAt: new Date(),
    })
    .returning()
  return row
}

async function answerWithText(
  env: Env,
  db: ReturnType<typeof createDb>,
  ctx: {
    userId: string
    model: string
    prompt: string
    replyId: string
    history: Array<{ role: "user" | "assistant"; content: string }>
  }
) {
  const result = await runModel(env, ctx.model, {
    messages: [...ctx.history, { role: "user", content: ctx.prompt }],
  })
  const text = extractText(result)
  if (!text) {
    throw new Error("The model returned no text")
  }

  const [row] = await db
    .insert(studioMessage)
    .values({
      id: ctx.replyId,
      userId: ctx.userId,
      role: "assistant",
      model: ctx.model,
      body: text,
      createdAt: new Date(),
    })
    .returning()
  return row
}

async function recentChat(env: Env, userId: string) {
  const db = createDb(env.DB)
  const rows = await db
    .select()
    .from(studioMessage)
    .where(eq(studioMessage.userId, userId))
    .orderBy(desc(studioMessage.createdAt))
    .limit(CHAT_CONTEXT)

  return rows
    .reverse()
    .filter((row) => !row.artifactKey && row.body.trim())
    .map((row) => ({ role: row.role, content: row.body }))
}

async function findOwned(c: Context<AppEnv>) {
  const id = c.req.param("id")
  if (!id) {
    return null
  }
  const db = createDb(c.env.DB)
  const [row] = await db
    .select()
    .from(studioMessage)
    .where(
      and(
        eq(studioMessage.id, id),
        eq(studioMessage.userId, c.get("userId"))
      )
    )
    .orderBy(asc(studioMessage.createdAt))
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

function parsePrompt(value: unknown) {
  if (typeof value !== "string") {
    return { error: "Write a prompt" }
  }
  const prompt = value.trim()
  if (!prompt) {
    return { error: "Write a prompt" }
  }
  if (prompt.length > PROMPT_MAX) {
    return { error: `Prompts have to be ${PROMPT_MAX} characters or fewer` }
  }
  return prompt
}

function parseModel(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return CHAT_MODELS[0].id as string
  }
  if (typeof value !== "string" || !MODELS.some((item) => item.id === value)) {
    return { error: "Pick a model" }
  }
  return value
}

function serialize(row: typeof studioMessage.$inferSelect) {
  return {
    id: row.id,
    role: row.role,
    model: row.model,
    body: row.body,
    image: Boolean(row.artifactKey),
    contentType: row.contentType,
    createdAt: row.createdAt.toISOString(),
  }
}
