import { Hono } from "hono"
import { routeAgentRequest } from "agents"

import { createAuth } from "./auth"
import { guys } from "./guys"
import { pipelines } from "./pipelines"

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
app.route("/api/pipelines", pipelines)

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

export { GuyAgent } from "./agent"
export { PipelineRunAgent } from "./pipeline-agent"
export { PipelineWorkflow } from "./pipeline-workflow"

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const routed = await routeAgentRequest(request, env, { cors: true })
    if (routed) {
      return routed
    }
    return app.fetch(request, env, ctx)
  },
}
