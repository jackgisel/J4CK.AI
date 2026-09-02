export const MAX_NODES = 20
export const LABEL_MAX = 80
export const PROMPT_MAX = 8000
export const INPUT_VALUE_MAX = 8000

export const CHAT_MODELS = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet",
  },
] as const

export const IMAGE_MODELS = [
  {
    id: "xai/grok-imagine-image",
    label: "Grok Image",
  },
  {
    id: "openai/gpt-image-2",
    label: "GPT Image",
  },
] as const

export const MODELS = [...CHAT_MODELS, ...IMAGE_MODELS]

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"]
export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"]
export type ModelId = (typeof MODELS)[number]["id"]

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

export type NodeOutput = {
  text?: string
  artifactKey?: string
  contentType?: string
}

const LEGACY_TYPES = new Set(["input", "chat", "image", "step"])

export function isImageModel(model: string | undefined) {
  return IMAGE_MODELS.some((item) => item.id === model)
}

export function modelLabel(model: string | undefined) {
  return MODELS.find((item) => item.id === model)?.label ?? "Model"
}

export function emptyGraph(): PipelineGraph {
  return {
    nodes: [
      {
        id: "n1",
        type: "step",
        position: { x: 80, y: 120 },
        data: {
          label: "Claude Sonnet",
          model: CHAT_MODELS[0].id,
          systemPrompt: "",
        },
      },
    ],
    edges: [],
  }
}

export function starterGraph(): PipelineGraph {
  return {
    nodes: [
      {
        id: "claude1",
        type: "step",
        position: { x: 40, y: 80 },
        data: {
          label: "Claude",
          model: "anthropic/claude-sonnet-4-5",
          systemPrompt: "You write image prompts. Be concrete. No preamble.",
        },
      },
      {
        id: "claude2",
        type: "step",
        position: { x: 280, y: 80 },
        data: {
          label: "Follow-up",
          model: "anthropic/claude-sonnet-4-5",
          systemPrompt:
            "Revise the previous image prompt using this follow-up. Return only the prompt.",
        },
      },
      {
        id: "grok",
        type: "step",
        position: { x: 520, y: 0 },
        data: {
          label: "Grok Image",
          model: "xai/grok-imagine-image",
          systemPrompt: "",
          inputFrom: "claude2",
        },
      },
      {
        id: "gpt",
        type: "step",
        position: { x: 520, y: 200 },
        data: {
          label: "GPT Image",
          model: "openai/gpt-image-2",
          systemPrompt: "",
          inputFrom: "claude2",
        },
      },
      {
        id: "fable",
        type: "step",
        position: { x: 760, y: 100 },
        data: {
          label: "Fable",
          model: "anthropic/claude-sonnet-4-5",
          systemPrompt:
            "You are Fable. Review the two images. Compare composition, taste, and whether they match the prompt. Be direct. Name a winner if there is one.",
          inputFrom: "claude2",
        },
      },
    ],
    edges: [
      { id: "e-claude1-claude2", source: "claude1", target: "claude2" },
      { id: "e-claude2-grok", source: "claude2", target: "grok" },
      { id: "e-claude2-gpt", source: "claude2", target: "gpt" },
      { id: "e-grok-fable", source: "grok", target: "fable" },
      { id: "e-gpt-fable", source: "gpt", target: "fable" },
    ],
  }
}

export function parseGraph(raw: unknown): PipelineGraph | { error: string } {
  if (typeof raw === "string") {
    try {
      return parseGraph(JSON.parse(raw) as unknown)
    } catch {
      return { error: "Graph must be JSON" }
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Graph is required" }
  }
  const value = raw as Record<string, unknown>
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return { error: "Graph needs nodes and edges" }
  }

  const migrated = migrateLegacyGraph(value.nodes, value.edges)
  if ("error" in migrated) {
    return migrated
  }

  if (migrated.nodes.length === 0) {
    return { error: "Add at least one node" }
  }
  if (migrated.nodes.length > MAX_NODES) {
    return { error: `At most ${MAX_NODES} nodes` }
  }

  const nodes: PipelineNode[] = []
  const ids = new Set<string>()
  for (const item of migrated.nodes) {
    const node = parseNode(item)
    if ("error" in node) {
      return node
    }
    if (ids.has(node.id)) {
      return { error: `Duplicate node ${node.id}` }
    }
    ids.add(node.id)
    nodes.push(node)
  }

  for (const node of nodes) {
    const from = node.data.inputFrom
    if (!from) {
      continue
    }
    if (from === node.id) {
      return { error: `${node.data.label} cannot use itself as input` }
    }
    if (!ids.has(from)) {
      return { error: `${node.data.label} points at a missing input node` }
    }
  }

  const edges: PipelineEdge[] = []
  const edgeIds = new Set<string>()
  const edgeKeys = new Set<string>()
  for (const item of migrated.edges) {
    const edge = parseEdge(item, ids)
    if ("error" in edge) {
      return edge
    }
    const key = `${edge.source}->${edge.target}`
    if (edgeIds.has(edge.id) || edgeKeys.has(key)) {
      continue
    }
    edgeIds.add(edge.id)
    edgeKeys.add(key)
    edges.push(edge)
  }

  for (const node of nodes) {
    const from = node.data.inputFrom
    if (!from) {
      continue
    }
    const key = `${from}->${node.id}`
    if (edgeKeys.has(key)) {
      continue
    }
    const id = `e-${from}-${node.id}`
    edges.push({ id: edgeIds.has(id) ? `${id}-in` : id, source: from, target: node.id })
    edgeKeys.add(key)
  }

  const graph = { nodes, edges }
  const waves = topoWaves(graph)
  if ("error" in waves) {
    return waves
  }
  return graph
}

export function runInputs(graph: PipelineGraph): RunField[] {
  return graph.nodes
    .filter((node) => !node.data.inputFrom)
    .map((node) => ({ key: node.id, label: node.data.label }))
}

export function parentsOf(graph: PipelineGraph, nodeId: string) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  return graph.edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => byId.get(edge.source))
    .filter((node): node is PipelineNode => Boolean(node))
}

export function topoWaves(graph: PipelineGraph): PipelineNode[][] | { error: string } {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const node of graph.nodes) {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  }
  for (const edge of graph.edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    outgoing.get(edge.source)?.push(edge.target)
  }

  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  let ready = graph.nodes.filter((node) => incoming.get(node.id) === 0)
  const waves: PipelineNode[][] = []
  let seen = 0

  while (ready.length > 0) {
    waves.push(ready)
    seen += ready.length
    const next: PipelineNode[] = []
    for (const node of ready) {
      for (const target of outgoing.get(node.id) ?? []) {
        const remaining = (incoming.get(target) ?? 0) - 1
        incoming.set(target, remaining)
        if (remaining === 0) {
          const found = byId.get(target)
          if (found) {
            next.push(found)
          }
        }
      }
    }
    ready = next
  }

  if (seen !== graph.nodes.length) {
    return { error: "Graph has a cycle" }
  }
  return waves
}

function migrateLegacyGraph(
  rawNodes: unknown[],
  rawEdges: unknown[]
): { nodes: unknown[]; edges: unknown[] } | { error: string } {
  const needsMigrate = rawNodes.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false
    }
    const type = (item as { type?: unknown }).type
    return type === "input" || type === "chat" || type === "image"
  })
  if (!needsMigrate) {
    return { nodes: rawNodes, edges: rawEdges }
  }

  const inputIds = new Set<string>()
  const fieldKeys = new Set<string>()
  const keepIds = new Set<string>()

  for (const item of rawNodes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue
    }
    const node = item as Record<string, unknown>
    if (typeof node.id !== "string") {
      continue
    }
    if (node.type === "input") {
      inputIds.add(node.id)
      const data = node.data
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const fields = (data as { fields?: unknown }).fields
        if (Array.isArray(fields)) {
          for (const field of fields) {
            if (field && typeof field === "object" && !Array.isArray(field)) {
              const key = (field as { key?: unknown }).key
              if (typeof key === "string") {
                fieldKeys.add(key)
              }
            }
          }
        }
      }
      continue
    }
    keepIds.add(node.id)
  }

  const nodes: unknown[] = []
  for (const item of rawNodes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue
    }
    const node = item as Record<string, unknown>
    if (node.type === "input") {
      continue
    }
    const dataRaw =
      node.data && typeof node.data === "object" && !Array.isArray(node.data)
        ? (node.data as Record<string, unknown>)
        : {}
    const template = typeof dataRaw.promptTemplate === "string" ? dataRaw.promptTemplate : ""
    const refs = [
      ...template.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g),
    ].map((match) => match[1])
    const unique = [...new Set(refs)]
    const nodeRefs = unique.filter((ref) => keepIds.has(ref) && !inputIds.has(ref))
    const fieldRefs = unique.filter((ref) => fieldKeys.has(ref) || inputIds.has(ref))
    let inputFrom: string | null =
      typeof dataRaw.inputFrom === "string" && keepIds.has(dataRaw.inputFrom)
        ? dataRaw.inputFrom
        : null
    if (!inputFrom && nodeRefs.length === 1 && fieldRefs.length === 0) {
      inputFrom = nodeRefs[0] ?? null
    }
    const model =
      typeof dataRaw.model === "string" && MODELS.some((item) => item.id === dataRaw.model)
        ? dataRaw.model
        : node.type === "image"
          ? IMAGE_MODELS[0].id
          : CHAT_MODELS[0].id
    nodes.push({
      id: node.id,
      type: "step",
      position: node.position,
      data: {
        label: dataRaw.label,
        model,
        systemPrompt: typeof dataRaw.systemPrompt === "string" ? dataRaw.systemPrompt : "",
        inputFrom,
      },
    })
  }

  const edges = rawEdges.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false
    }
    const edge = item as Record<string, unknown>
    return (
      typeof edge.source === "string" &&
      typeof edge.target === "string" &&
      keepIds.has(edge.source) &&
      keepIds.has(edge.target)
    )
  })

  return { nodes, edges }
}

function parseNode(raw: unknown): PipelineNode | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid node" }
  }
  const value = raw as Record<string, unknown>
  const id = parseId(value.id, "Node id")
  if (typeof id !== "string") {
    return id
  }
  if (typeof value.type === "string" && !LEGACY_TYPES.has(value.type)) {
    return { error: `Unknown node type on ${id}` }
  }
  const position = parsePosition(value.position)
  if ("error" in position) {
    return position
  }
  if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) {
    return { error: `Node ${id} is missing data` }
  }
  const dataRaw = value.data as Record<string, unknown>
  const label = parseLabel(dataRaw.label, id)
  if (typeof label !== "string") {
    return label
  }
  if (typeof dataRaw.model !== "string" || !MODELS.some((item) => item.id === dataRaw.model)) {
    return { error: `Pick a model for ${label}` }
  }
  const systemPrompt =
    typeof dataRaw.systemPrompt === "string"
      ? dataRaw.systemPrompt.slice(0, PROMPT_MAX)
      : ""
  let inputFrom: string | null | undefined
  if (dataRaw.inputFrom === null || dataRaw.inputFrom === undefined || dataRaw.inputFrom === "") {
    inputFrom = null
  } else if (typeof dataRaw.inputFrom === "string") {
    const from = parseId(dataRaw.inputFrom, `${label} input`)
    if (typeof from !== "string") {
      return from
    }
    inputFrom = from
  } else {
    return { error: `Bad input on ${label}` }
  }

  return {
    id,
    type: "step",
    position,
    data: {
      label,
      model: dataRaw.model,
      systemPrompt,
      inputFrom,
    },
  }
}

function parseEdge(
  raw: unknown,
  ids: Set<string>
): PipelineEdge | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid edge" }
  }
  const value = raw as Record<string, unknown>
  const id = parseId(value.id, "Edge id")
  if (typeof id !== "string") {
    return id
  }
  const source = parseId(value.source, "Edge source")
  if (typeof source !== "string") {
    return source
  }
  const target = parseId(value.target, "Edge target")
  if (typeof target !== "string") {
    return target
  }
  if (!ids.has(source) || !ids.has(target)) {
    return { error: `Edge ${id} points at a missing node` }
  }
  if (source === target) {
    return { error: `Edge ${id} cannot loop on itself` }
  }
  return { id, source, target }
}

function parseId(value: unknown, label: string) {
  if (typeof value !== "string") {
    return { error: `${label} is required` }
  }
  const id = value.trim()
  if (!id || id.length > 64) {
    return { error: `${label} is invalid` }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { error: `${label} is invalid` }
  }
  return id
}

function parseLabel(value: unknown, id: string) {
  if (typeof value !== "string") {
    return { error: `Label required on ${id}` }
  }
  const label = value.trim()
  if (!label) {
    return { error: `Label required on ${id}` }
  }
  if (label.length > LABEL_MAX) {
    return { error: `Label on ${id} is too long` }
  }
  return label
}

function parsePosition(value: unknown): { x: number; y: number } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { x: 0, y: 0 }
  }
  const raw = value as Record<string, unknown>
  const x = typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 0
  const y = typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 0
  return { x, y }
}

export function parseRunInput(
  graph: PipelineGraph,
  raw: unknown
): Record<string, string> | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Expected JSON" }
  }
  const body = raw as Record<string, unknown>
  const fields = runInputs(graph)
  const input: Record<string, string> = {}
  for (const field of fields) {
    const value = body[field.key]
    if (typeof value !== "string") {
      return { error: `${field.label} is required` }
    }
    const text = value.trim()
    if (!text) {
      return { error: `${field.label} is required` }
    }
    if (text.length > INPUT_VALUE_MAX) {
      return {
        error: `${field.label} must be ${INPUT_VALUE_MAX} characters or fewer`,
      }
    }
    input[field.key] = text
  }
  return input
}
