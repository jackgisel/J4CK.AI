import { desc, eq } from "drizzle-orm"

import { createDb } from "./db"
import { guy, message } from "./db/schema"
import { asGuyHome, readHook } from "./home"
import {
  generateFollowThrough,
  generateIdle,
  generateReply,
  HISTORY_LIMIT,
  isDanglingPromise,
  type ToolBridge,
} from "./reply"

export type SerializedMessage = {
  id: string
  guyId: string
  role: "user" | "assistant"
  body: string
  createdAt: string
}

export function serializeMessage(
  row: typeof message.$inferSelect
): SerializedMessage {
  return {
    id: row.id,
    guyId: row.guyId,
    role: row.role,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function writeAssistantReplies(
  env: Env,
  userName: string,
  row: typeof guy.$inferSelect,
  extra?: ToolBridge
) {
  const history = await loadHistory(env, row.id)
  const last = history[history.length - 1]
  if (!last) {
    return []
  }

  const home = asGuyHome(row)
  let texts =
    last.role === "user"
      ? await generateReply(
          env.AI,
          env.BUCKET,
          home,
          userName,
          history,
          extra
        )
      : last.role === "assistant" && isDanglingPromise(last.body)
        ? await generateFollowThrough(
            env.AI,
            env.BUCKET,
            home,
            userName,
            history,
            extra
          )
        : null

  if (texts && texts.length > 0 && isDanglingPromise(texts[texts.length - 1])) {
    const more = await generateFollowThrough(
      env.AI,
      env.BUCKET,
      home,
      userName,
      [
        ...history,
        ...texts.map((body) => ({ role: "assistant" as const, body })),
      ],
      extra
    )
    if (more && more.length > 0) {
      texts = [...texts, ...more].slice(0, 3)
    }
  }

  return insertAssistantTexts(env, row.id, texts)
}

export async function writeIdleReplies(
  env: Env,
  userName: string,
  row: typeof guy.$inferSelect,
  extra?: ToolBridge
) {
  const history = await loadHistory(env, row.id)
  if (history.length === 0) {
    return []
  }
  const texts = await generateIdle(
    env.AI,
    env.BUCKET,
    asGuyHome(row),
    userName,
    history,
    extra
  )
  return insertAssistantTexts(env, row.id, texts)
}

export async function lastMessageDangles(env: Env, guyId: string) {
  const history = await loadHistory(env, guyId)
  const last = history[history.length - 1]
  return Boolean(last && last.role === "assistant" && isDanglingPromise(last.body))
}

export async function idleHookExists(
  env: Env,
  row: typeof guy.$inferSelect
) {
  const hook = await readHook(env.BUCKET, asGuyHome(row), "on-idle")
  return hook.trim().length > 0
}

async function loadHistory(env: Env, guyId: string) {
  const db = createDb(env.DB)
  const recent = await db
    .select()
    .from(message)
    .where(eq(message.guyId, guyId))
    .orderBy(desc(message.createdAt))
    .limit(HISTORY_LIMIT)

  return recent.reverse()
}

async function insertAssistantTexts(
  env: Env,
  guyId: string,
  texts: string[] | null
) {
  if (!texts || texts.length === 0) {
    return []
  }

  const db = createDb(env.DB)
  const now = Date.now()
  return db
    .insert(message)
    .values(
      texts.map((body, index) => ({
        id: crypto.randomUUID(),
        guyId,
        role: "assistant" as const,
        body,
        createdAt: new Date(now + index),
      }))
    )
    .returning()
}
