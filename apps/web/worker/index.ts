import { Hono } from "hono"

const app = new Hono<{ Bindings: Env }>()

app.get("/api/health", (c) => {
  return c.json({ ok: true })
})

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
