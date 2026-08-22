import { Hono } from "hono"

import { createAuth } from "./auth"
import { guys } from "./guys"

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

app.route("/api/guys", guys)

app.get("/api/r2", async (c) => {
  const listed = await c.env.BUCKET.list({ limit: 20 })

  return c.json({
    objects: listed.objects.map((object) => ({
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
    })),
    truncated: listed.truncated,
  })
})

export default app
