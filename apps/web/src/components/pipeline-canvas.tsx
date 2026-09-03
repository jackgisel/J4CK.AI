import { useCallback, useEffect, useRef } from "react"
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { StepFlowNode, type FlowNode } from "@/components/pipeline-nodes"
import {
  CHAT_MODELS,
  MAX_NODES,
  MODELS,
  modelLabel,
  type PipelineGraph,
  type PipelineNodeData,
} from "@/lib/pipelines"

const pipelineNodeTypes = {
  step: StepFlowNode,
}

const TEXT_INPUT = ""

export function PipelineCanvas({
  graph,
  onChange,
}: {
  graph: PipelineGraph
  onChange: (graph: PipelineGraph) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlow(graph).nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlow(graph).edges)
  const skipSync = useRef(true)

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    onChange(fromFlow(nodes, edges))
  }, [nodes, edges, onChange])

  const selected = nodes.find((node) => node.selected)

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${shortId()}`,
          type: "smoothstep",
        },
        current
      )
    )
  }, [setEdges])

  function addNode() {
    if (nodes.length >= MAX_NODES) {
      return
    }
    const model = CHAT_MODELS[0].id
    const node: FlowNode = {
      id: `n${shortId()}`,
      type: "step",
      position: { x: 80 + nodes.length * 36, y: 80 + nodes.length * 28 },
      data: {
        label: uniqueLabel(modelLabel(model), nodes),
        model,
        systemPrompt: "",
      },
      selected: true,
    }
    setNodes((current) => [
      ...current.map((item) => ({ ...item, selected: false })),
      node,
    ])
  }

  function updateSelected(data: PipelineNodeData) {
    if (!selected) {
      return
    }
    const previousFrom = selected.data.inputFrom ?? null
    const nextFrom = data.inputFrom ?? null
    setNodes((current) =>
      current.map((node) =>
        node.id === selected.id ? { ...node, data } : node
      )
    )
    if (previousFrom === nextFrom) {
      return
    }
    setEdges((current) => {
      let next = current
      if (previousFrom) {
        next = next.filter(
          (edge) =>
            !(edge.source === previousFrom && edge.target === selected.id)
        )
      }
      if (
        nextFrom &&
        !next.some(
          (edge) => edge.source === nextFrom && edge.target === selected.id
        )
      ) {
        next = addEdge(
          {
            id: `e-${nextFrom}-${selected.id}-${shortId()}`,
            source: nextFrom,
            target: selected.id,
            type: "smoothstep",
          },
          next
        )
      }
      return next
    })
  }

  return (
    <ReactFlowProvider>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute top-3 left-3 z-10">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={nodes.length >= MAX_NODES}
              onClick={addNode}
            >
              Add node
            </Button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={pipelineNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.35 }}
            minZoom={0.3}
            className="h-full bg-background"
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        {selected ? (
          <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border p-4">
            <NodeInspector
              nodeId={selected.id}
              data={selected.data}
              nodes={nodes}
              edges={edges}
              onChange={updateSelected}
            />
          </aside>
        ) : (
          <aside className="hidden w-72 shrink-0 border-l border-border p-4 lg:block">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add a node. Each one takes text or another node, a model, and
              instructions.
            </p>
          </aside>
        )}
      </div>
    </ReactFlowProvider>
  )
}

function NodeInspector({
  nodeId,
  data,
  nodes,
  edges,
  onChange,
}: {
  nodeId: string
  data: PipelineNodeData
  nodes: FlowNode[]
  edges: Edge[]
  onChange: (data: PipelineNodeData) => void
}) {
  const downstream = reachableFrom(nodeId, edges)
  const sources = nodes.filter(
    (node) =>
      node.id !== nodeId &&
      (node.id === data.inputFrom || !downstream.has(node.id))
  )
  const inputValue = data.inputFrom ?? TEXT_INPUT

  function onModelChange(model: string) {
    const previous = modelLabel(data.model)
    const next = modelLabel(model)
    onChange({
      ...data,
      model,
      label: data.label === previous ? next : data.label,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <Label htmlFor="node-name">Name</Label>
        <Input
          id="node-name"
          value={data.label}
          onChange={(event) =>
            onChange({ ...data, label: event.target.value })
          }
        />
      </label>
      <label className="flex flex-col gap-2">
        <Label htmlFor="node-input">Input</Label>
        <select
          id="node-input"
          className="h-10 border-b border-input bg-transparent text-sm outline-none"
          value={inputValue}
          onChange={(event) => {
            const value = event.target.value
            onChange({
              ...data,
              inputFrom: value === TEXT_INPUT ? null : value,
            })
          }}
        >
          <option value={TEXT_INPUT}>Text, when you run</option>
          {sources.map((node) => (
            <option key={node.id} value={node.id}>
              {node.data.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <Label htmlFor="node-model">Model</Label>
        <select
          id="node-model"
          className="h-10 border-b border-input bg-transparent text-sm outline-none"
          value={data.model}
          onChange={(event) => onModelChange(event.target.value)}
        >
          {MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <Label htmlFor="node-system">Instructions</Label>
        <Textarea
          id="node-system"
          value={data.systemPrompt}
          placeholder="What this step should do"
          onChange={(event) =>
            onChange({ ...data, systemPrompt: event.target.value })
          }
        />
      </label>
    </div>
  )
}

function toFlow(graph: PipelineGraph) {
  const nodes: FlowNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "step",
    position: node.position,
    data: node.data,
  }))
  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
  }))
  return { nodes, edges }
}

function fromFlow(nodes: FlowNode[], edges: Edge[]): PipelineGraph {
  const ids = new Set(nodes.map((node) => node.id))
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: "step",
      position: node.position,
      data: {
        ...node.data,
        inputFrom:
          node.data.inputFrom && ids.has(node.data.inputFrom)
            ? node.data.inputFrom
            : null,
      },
    })),
    edges: edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
  }
}

function reachableFrom(start: string, edges: Edge[]) {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge.target)
    outgoing.set(edge.source, list)
  }
  const seen = new Set<string>()
  const stack = [...(outgoing.get(start) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    for (const next of outgoing.get(id) ?? []) {
      stack.push(next)
    }
  }
  return seen
}

function uniqueLabel(base: string, nodes: FlowNode[]) {
  const used = new Set(nodes.map((node) => node.data.label))
  if (!used.has(base)) {
    return base
  }
  let index = 2
  while (used.has(`${base} ${index}`)) {
    index += 1
  }
  return `${base} ${index}`
}

function shortId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10)
}
