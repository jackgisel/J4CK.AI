import { and, desc, eq, inArray } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { pipeline, pipelineRun } from "./db/schema"
import {
  emptyGraph,
  parseGraph,
  parseRunInput,
  starterGraph,
  type PipelineGraph,
} from "./pipeline-graph"
import {
  readPipelineRunState,
  startPipelineRun,
  type PipelineRunAgentState,
} from "./pipeline-agent"
import { artifactKey } from "./pipeline-providers"

type AppEnv = {
  Bindings: Env
  Variables: { userId: string; userName: string }
}

const NAME_MAX = 80

export const pipelines = new Hono<AppEnv>()

pipelines.use("*", async (c, next) => {
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

pipelines.get("/", async (c) => {
  const db = createDb(c.env.DB)
  const userId = c.get("userId")
  const rows = await db
    .select()
    .from(pipeline)
    .where(eq(pipeline.userId, userId))
    .orderBy(desc(pipeline.updatedAt))

  const lastByPipeline = new Map<string, typeof pipelineRun.$inferSelect>()
  const ids = rows.map((row) => row.id)
  if (ids.length > 0) {
    const runs = await db
      .select()
      .from(pipelineRun)
      .where(inArray(pipelineRun.pipelineId, ids))
      .orderBy(desc(pipelineRun.createdAt))
    for (const run of runs) {
      if (!lastByPipeline.has(run.pipelineId)) {
        lastByPipeline.set(run.pipelineId, run)
      }
    }
  }

  return c.json({
    pipelines: rows.map((row) =>
      serializePipeline(row, lastByPipeline.get(row.id) ?? null)
    ),
  })
})

pipelines.post("/", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const template = body.template === "review" ? "review" : "blank"
  const name =
    typeof body.name === "string" && body.name.trim()
      ? parseName(body.name)
      : template === "review"
        ? "June and Fable"
        : "Untitled"
  if (typeof name !== "string") {
    return c.json({ error: name.error }, 400)
  }

  const parsed =
    body.graph !== undefined
      ? parseGraph(body.graph)
      : template === "review"
        ? starterGraph()
        : emptyGraph()
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400)
  }

  const now = new Date()
  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(pipeline)
    .values({
      id: crypto.randomUUID(),
      userId: c.get("userId"),
      name,
      graph: JSON.stringify(parsed),
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ pipeline: serializePipeline(created, null) }, 201)
})

pipelines.get("/:id", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  return c.json({ pipeline: serializePipeline(row, null) })
})

pipelines.patch("/:id", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const patch: {
    name?: string
    graph?: string
    updatedAt: Date
  } = { updatedAt: new Date() }

  if ("name" in body) {
    const name = parseName(body.name)
    if (typeof name !== "string") {
      return c.json({ error: name.error }, 400)
    }
    patch.name = name
  }

  if ("graph" in body) {
    const parsed = parseGraph(body.graph)
    if ("error" in parsed) {
      return c.json({ error: parsed.error }, 400)
    }
    patch.graph = JSON.stringify(parsed)
  }

  if (patch.name === undefined && patch.graph === undefined) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const db = createDb(c.env.DB)
  const [updated] = await db
    .update(pipeline)
    .set(patch)
    .where(eq(pipeline.id, row.id))
    .returning()

  if (!updated) {
    return c.json({ error: "Could not save" }, 500)
  }

  return c.json({ pipeline: serializePipeline(updated, null) })
})

pipelines.delete("/:id", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const db = createDb(c.env.DB)
  await db.delete(pipeline).where(eq(pipeline.id, row.id))
  return c.body(null, 204)
})

pipelines.get("/:id/runs", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(pipelineRun)
    .where(eq(pipelineRun.pipelineId, row.id))
    .orderBy(desc(pipelineRun.createdAt))

  return c.json({
    pipeline: serializePipeline(row, null),
    runs: rows.map(serializeRun),
  })
})

pipelines.post("/:id/runs", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const graph = parseGraph(row.graph)
  if ("error" in graph) {
    return c.json({ error: graph.error }, 400)
  }
  if (graph.nodes.length === 0) {
    return c.json({ error: "Add a guy first" }, 400)
  }

  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }
  const input = parseRunInput(graph, body)
  if ("error" in input) {
    return c.json({ error: input.error }, 400)
  }

  const now = new Date()
  const runId = crypto.randomUUID()
  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(pipelineRun)
    .values({
      id: runId,
      pipelineId: row.id,
      userId: c.get("userId"),
      status: "running",
      input: JSON.stringify(input),
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not start" }, 500)
  }

  try {
    const workflowInstanceId = await startPipelineRun(c.env, runId, {
      pipelineId: row.id,
      userId: c.get("userId"),
      graph,
      input,
    })
    const [updated] = await db
      .update(pipelineRun)
      .set({ workflowInstanceId, updatedAt: new Date() })
      .where(eq(pipelineRun.id, runId))
      .returning()
    return c.json(
      {
        run: serializeRun(updated ?? created),
        state: await readPipelineRunState(c.env, runId),
      },
      201
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start"
    await db
      .update(pipelineRun)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(pipelineRun.id, runId))
    return c.json({ error: message, run: serializeRun(created) }, 500)
  }
})

pipelines.get("/:id/runs/:runId", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const run = await findOwnedRun(c, row.id)
  if (!run) {
    return c.json({ error: "Not found" }, 404)
  }

  let state: PipelineRunAgentState | null = null
  try {
    state = await readPipelineRunState(c.env, run.id)
  } catch {
    /* agent may not exist yet */
  }

  return c.json({
    pipeline: serializePipeline(row, run),
    run: serializeRun(run),
    state,
  })
})

pipelines.get("/:id/runs/:runId/artifacts/:nodeId", async (c) => {
  const row = await findOwnedPipeline(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const run = await findOwnedRun(c, row.id)
  if (!run) {
    return c.json({ error: "Not found" }, 404)
  }
  const nodeId = c.req.param("nodeId")
  if (!nodeId) {
    return c.json({ error: "Not found" }, 404)
  }
  const key = artifactKey(c.get("userId"), row.id, run.id, nodeId)
  const object = await c.env.BUCKET.get(key)
  if (!object) {
    return c.json({ error: "Not found" }, 404)
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/png",
      "cache-control": "private, max-age=3600",
    },
  })
})

async function findOwnedPipeline(c: Context<AppEnv>) {
  const id = c.req.param("id")
  if (!id) {
    return null
  }
  const db = createDb(c.env.DB)
  const [row] = await db
    .select()
    .from(pipeline)
    .where(and(eq(pipeline.id, id), eq(pipeline.userId, c.get("userId"))))
    .limit(1)
  return row ?? null
}

async function findOwnedRun(c: Context<AppEnv>, pipelineId: string) {
  const runId = c.req.param("runId")
  if (!runId) {
    return null
  }
  const db = createDb(c.env.DB)
  const [row] = await db
    .select()
    .from(pipelineRun)
    .where(
      and(
        eq(pipelineRun.id, runId),
        eq(pipelineRun.pipelineId, pipelineId),
        eq(pipelineRun.userId, c.get("userId"))
      )
    )
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

function parseStoredGraph(raw: string): PipelineGraph {
  const parsed = parseGraph(raw)
  if ("error" in parsed) {
    return { nodes: [], edges: [] }
  }
  return parsed
}

function serializePipeline(
  row: typeof pipeline.$inferSelect,
  last: typeof pipelineRun.$inferSelect | null
) {
  return {
    id: row.id,
    name: row.name,
    graph: parseStoredGraph(row.graph),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastRun: last ? serializeRun(last) : null,
  }
}

function serializeRun(row: typeof pipelineRun.$inferSelect) {
  let input: Record<string, string> = {}
  try {
    const value: unknown = JSON.parse(row.input)
    if (value && typeof value === "object" && !Array.isArray(value)) {
      input = value as Record<string, string>
    }
  } catch {
    input = {}
  }
  return {
    id: row.id,
    pipelineId: row.pipelineId,
    status: row.status,
    input,
    workflowInstanceId: row.workflowInstanceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
