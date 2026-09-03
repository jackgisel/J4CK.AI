import { eq } from "drizzle-orm"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { cliToken, user } from "./db/schema"
import { bearerToken, hashToken } from "./token"

const LAST_USED_GAP_MS = 10 * 60 * 1000

export type AppUser = {
  id: string
  name: string
  email: string
}

export async function getCookieUser(
  env: Env,
  request: Request
): Promise<AppUser | null> {
  const session = await createAuth(env, request).api.getSession({
    headers: request.headers,
  })
  if (!session) {
    return null
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  }
}

export async function getRequestUser(
  env: Env,
  request: Request
): Promise<AppUser | null> {
  const fromCookie = await getCookieUser(env, request)
  if (fromCookie) {
    return fromCookie
  }
  return getTokenUser(env, request)
}

async function getTokenUser(env: Env, request: Request) {
  const token = bearerToken(request.headers.get("authorization"))
  if (!token) {
    return null
  }
  const db = createDb(env.DB)
  const hash = await hashToken(token)
  const [row] = await db
    .select({
      tokenId: cliToken.id,
      userId: cliToken.userId,
      lastUsedAt: cliToken.lastUsedAt,
      name: user.name,
      email: user.email,
    })
    .from(cliToken)
    .innerJoin(user, eq(user.id, cliToken.userId))
    .where(eq(cliToken.tokenHash, hash))
    .limit(1)

  if (!row) {
    return null
  }

  const now = Date.now()
  const last = row.lastUsedAt?.getTime() ?? 0
  if (now - last > LAST_USED_GAP_MS) {
    await db
      .update(cliToken)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(cliToken.id, row.tokenId))
  }

  return { id: row.userId, name: row.name, email: row.email }
}
