import { createMiddleware } from "hono/factory"

import { createAuth } from "./auth"

export type AppUser = {
  id: string
  name: string
  email: string
}

export type AuthedEnv = {
  Bindings: Env
  Variables: { userId: string }
}

export async function getRequestUser(
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

export const requireUser = createMiddleware<AuthedEnv>(async (c, next) => {
  const user = await getRequestUser(c.env, c.req.raw)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  c.set("userId", user.id)
  await next()
})
