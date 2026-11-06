import { Hono } from "hono"

import { createAuth } from "./auth"
import { lists } from "./lists"
import { tasks } from "./tasks"

const app = new Hono<{ Bindings: Env }>()

app.all("/api/auth/*", (c) => {
  return createAuth(c.env, c.req.raw).handler(c.req.raw)
})

app.get("/api/health", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>()
    return c.json({ ok: true, db: row?.ok === 1 })
  } catch {
    return c.json({ ok: true, db: false })
  }
})

app.route("/api/tasks", tasks)
app.route("/api/lists", lists)

export default app
