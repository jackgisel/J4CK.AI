export const CHAT_MODELS = [
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet" },
] as const

export const IMAGE_MODELS = [
  { id: "xai/grok-imagine-image", label: "Grok Image" },
  { id: "openai/gpt-image-2", label: "GPT Image" },
] as const

export const MODELS = [...CHAT_MODELS, ...IMAGE_MODELS]
export const MAX_NODES = 20

export type PipelineNodeType = "step"

export type RunField = {
  key: string
  label: string
}

export type PipelineNodeData = {
  label: string
  model: string
  systemPrompt: string
  inputFrom?: string | null
}

export type PipelineNode = {
  id: string
  type: PipelineNodeType
  position: { x: number; y: number }
  data: PipelineNodeData
}

export type PipelineEdge = {
  id: string
  source: string
  target: string
}

export type PipelineGraph = {
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

export type PipelineRunStatus = "running" | "complete" | "error"

export type PipelineRun = {
  id: string
  pipelineId: string
  status: PipelineRunStatus
  input: Record<string, string>
  workflowInstanceId: string | null
  createdAt: string
  updatedAt: string
}

export type Pipeline = {
  id: string
  name: string
  graph: PipelineGraph
  createdAt: string
  updatedAt: string
  lastRun: PipelineRun | null
}

export type NodeRunStatus = "pending" | "running" | "complete" | "error"

export type NodeRunState = {
  status: NodeRunStatus
  text?: string
  artifact?: boolean
  contentType?: string
  error?: string
}

export type PipelineRunAgentState = {
  pipelineId: string
  userId: string
  status: "idle" | "running" | "complete" | "error"
  input: Record<string, string>
  nodes: Record<string, NodeRunState>
  error: string | null
}

export function isImageModel(model: string | undefined) {
  return IMAGE_MODELS.some((item) => item.id === model)
}

export function modelLabel(model: string | undefined) {
  return MODELS.find((item) => item.id === model)?.label ?? "Model"
}

export function runInputs(graph: PipelineGraph): RunField[] {
  return graph.nodes
    .filter((node) => !node.data.inputFrom)
    .map((node) => ({ key: node.id, label: node.data.label }))
}

export function formatRunTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export async function listPipelines() {
  const data = await api<{ pipelines: Pipeline[] }>("/api/pipelines")
  return data.pipelines
}

export async function getPipeline(id: string) {
  const data = await api<{ pipeline: Pipeline }>(`/api/pipelines/${id}`)
  return data.pipeline
}

export async function createPipeline(input: {
  name?: string
  template?: "blank" | "review"
  graph?: PipelineGraph
}) {
  const data = await api<{ pipeline: Pipeline }>("/api/pipelines", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return data.pipeline
}

export async function updatePipeline(
  id: string,
  input: { name?: string; graph?: PipelineGraph }
) {
  const data = await api<{ pipeline: Pipeline }>(`/api/pipelines/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return data.pipeline
}

export async function deletePipeline(id: string) {
  await api<void>(`/api/pipelines/${id}`, { method: "DELETE" })
}

export async function listPipelineRuns(id: string) {
  return api<{ pipeline: Pipeline; runs: PipelineRun[] }>(
    `/api/pipelines/${id}/runs`
  )
}

export async function startPipelineRun(
  id: string,
  input: Record<string, string>
) {
  return api<{ run: PipelineRun; state: PipelineRunAgentState }>(
    `/api/pipelines/${id}/runs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}

export async function getPipelineRun(pipelineId: string, runId: string) {
  return api<{
    pipeline: Pipeline
    run: PipelineRun
    state: PipelineRunAgentState | null
  }>(`/api/pipelines/${pipelineId}/runs/${runId}`)
}

export function artifactUrl(
  pipelineId: string,
  runId: string,
  nodeId: string
) {
  return `/api/pipelines/${pipelineId}/runs/${runId}/artifacts/${nodeId}`
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(typeof init?.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorMessage(data))
  }
  return data as T
}

function errorMessage(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error
  }
  return "Request failed"
}
