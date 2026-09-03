import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type DragEvent,
} from "react"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { GuyMark } from "@/components/guy-mark"
import {
  BoardEdge,
  GuyFlowNode,
  type FlowEdge,
  type FlowNode,
} from "@/components/pipeline-nodes"
import type { Guy } from "@/lib/guys"
import {
  CHAT_MODELS,
  DEFAULT_FACE,
  DEFAULT_LOOPS,
  MAX_NODES,
  hydrateGraph,
  wouldCreateCycle,
  type PipelineEdgeKind,
  type PipelineGraph,
  type PipelineNodeData,
} from "@/lib/pipelines"

const nodeTypes = { step: GuyFlowNode }
const edgeTypes = { board: BoardEdge }

const defaultEdgeOptions = {
  type: "board" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
}

export type PipelineCanvasHandle = {
  placeGuy: (guy: Guy, model?: string) => string | null
}

export const PipelineCanvas = forwardRef<
  PipelineCanvasHandle,
  {
    graph: PipelineGraph
    guys: Guy[]
    selectedId: string | null
    onChange: (graph: PipelineGraph) => void
    onSelect: (id: string | null) => void
  }
>(function PipelineCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <CanvasBody ref={ref} {...props} />
    </ReactFlowProvider>
  )
})

const CanvasBody = forwardRef<
  PipelineCanvasHandle,
  {
    graph: PipelineGraph
    guys: Guy[]
    selectedId: string | null
    onChange: (graph: PipelineGraph) => void
    onSelect: (id: string | null) => void
  }
>(function CanvasBody(
  { graph, guys, selectedId, onChange, onSelect },
  ref
) {
  const hydrated = useMemo(() => hydrateGraph(graph, guys), [graph, guys])
  const initial = toFlow(hydrated)
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const skipSync = useRef(true)
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    onChange(fromFlow(nodes, edges))
  }, [nodes, edges, onChange])

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === selectedId,
      }))
    )
  }, [selectedId, setNodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }
      const kind: PipelineEdgeKind = wouldCreateCycle(
        fromFlow(nodes, edges).edges,
        connection.source,
        connection.target
      )
        ? "loop"
        : "flow"
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${shortId()}`,
            type: "board",
            data: { kind },
            markerEnd: defaultEdgeOptions.markerEnd,
            style:
              kind === "loop" ? { strokeDasharray: "6 4" } : undefined,
          },
          current
        )
      )
    },
    [edges, nodes, setEdges]
  )

  const placeGuy = useCallback(
    (guy: Guy, model?: string, position?: { x: number; y: number }) => {
      const existing = nodes.find((node) => node.data.guyId === guy.id)
      if (existing) {
        onSelect(existing.id)
        return existing.id
      }
      if (nodes.length >= MAX_NODES) {
        return null
      }
      const id = `n${shortId()}`
      const node: FlowNode = {
        id,
        type: "step",
        position: position ?? {
          x: 80 + (nodes.length % 5) * 140,
          y: 80 + Math.floor(nodes.length / 5) * 140,
        },
        data: guyNodeData(guy, model),
        selected: true,
      }
      setNodes((current) => [
        ...current.map((item) => ({ ...item, selected: false })),
        node,
      ])
      onSelect(id)
      return id
    },
    [nodes, onSelect, setNodes]
  )

  useImperativeHandle(ref, () => ({ placeGuy }), [placeGuy])

  function onDragOver(event: DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    const guyId = event.dataTransfer.getData("application/j4ck-guy")
    const guy = guys.find((row) => row.id === guyId)
    if (!guy) {
      return
    }
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    placeGuy(guy, undefined, position)
  }

  const onBoard = new Set(
    nodes.map((node) => node.data.guyId).filter((id): id is string => Boolean(id))
  )
  const tray = guys.filter((guy) => !onBoard.has(guy.id))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneClick={() => onSelect(null)}
          onSelectionChange={({ nodes: selected }) => {
            onSelect(selected[0]?.id ?? null)
          }}
          isValidConnection={() => true}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.35, minZoom: 0.35 }}
          minZoom={0.25}
          className="h-full bg-muted/30"
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-background px-3 py-2">
        <p className="shrink-0 text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
          Drop
        </p>
        {tray.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {guys.length === 0
              ? "Invent one in chat."
              : "Everyone is already on the board."}
          </p>
        ) : (
          tray.map((guy) => (
            <button
              key={guy.id}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/j4ck-guy", guy.id)
                event.dataTransfer.effectAllowed = "move"
              }}
              onClick={() => placeGuy(guy)}
              className="flex shrink-0 items-center gap-2 border border-transparent px-1 py-0.5 hover:border-foreground/40"
              aria-label={`Drop ${guy.name}`}
            >
              <GuyMark
                color={guy.color}
                avatarEyes={guy.avatarEyes}
                avatarFacialHair={guy.avatarFacialHair}
                avatarHat={guy.avatarHat}
                className="size-8"
              />
              <span className="font-heading text-[0.625rem] font-semibold tracking-widest uppercase">
                {guy.name}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
})

function guyNodeData(guy: Guy, model?: string): PipelineNodeData {
  return {
    label: guy.name,
    model: model || CHAT_MODELS[0].id,
    systemPrompt: guy.backstory,
    guyId: guy.id,
    color: guy.color,
    avatarEyes: guy.avatarEyes,
    avatarFacialHair: guy.avatarFacialHair,
    avatarHat: guy.avatarHat,
    maxLoops: DEFAULT_LOOPS,
  }
}

function toFlow(graph: PipelineGraph) {
  const nodes: FlowNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "step",
    position: node.position,
    data: {
      ...DEFAULT_FACE,
      ...node.data,
    },
  }))
  const edges: FlowEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "board",
    data: { kind: edge.kind ?? "flow" },
    markerEnd: defaultEdgeOptions.markerEnd,
    style: edge.kind === "loop" ? { strokeDasharray: "6 4" } : undefined,
  }))
  return { nodes, edges }
}

function fromFlow(nodes: FlowNode[], edges: Edge[]): PipelineGraph {
  const ids = new Set(nodes.map((node) => node.id))
  const mapped: FlowEdge[] = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => {
      const kind: PipelineEdgeKind =
        edge.source === edge.target ||
        (edge.data as { kind?: PipelineEdgeKind } | undefined)?.kind === "loop"
          ? "loop"
          : "flow"
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "board",
        data: { kind },
      }
    })

  const classified = mapped.map((edge, index, list) => {
    if (edge.data?.kind === "loop") {
      return edge
    }
    const previous = list.slice(0, index).map((item) => ({
      id: item.id,
      source: item.source,
      target: item.target,
      kind: item.data?.kind ?? "flow",
    }))
    const kind = wouldCreateCycle(previous, edge.source, edge.target)
      ? "loop"
      : "flow"
    return { ...edge, data: { kind } }
  })

  return {
    nodes: nodes.map((node) => {
      const incoming = classified.find(
        (edge) => edge.target === node.id && edge.data?.kind !== "loop"
      )
      return {
        id: node.id,
        type: "step" as const,
        position: node.position,
        data: {
          ...DEFAULT_FACE,
          ...node.data,
          inputFrom: incoming?.source ?? null,
        },
      }
    }),
    edges: classified.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.data?.kind === "loop" ? "loop" : "flow",
    })),
  }
}

function shortId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10)
}
