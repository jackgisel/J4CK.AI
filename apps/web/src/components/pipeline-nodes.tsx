import { useCallback } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { GuyMark } from "@/components/guy-mark"
import {
  MODELS,
  isImageModel,
  type PipelineEdgeKind,
  type PipelineNodeData,
  type PipelineNodeType,
} from "@/lib/pipelines"

export type FlowNode = Node<PipelineNodeData, PipelineNodeType>
export type FlowEdge = Edge<{ kind: PipelineEdgeKind }>

export function GuyFlowNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { setNodes } = useReactFlow<FlowNode>()
  const pickModel = useCallback(
    (value: string | null) => {
      if (!value) {
        return
      }
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, model: value } }
            : node
        )
      )
    },
    [id, setNodes]
  )

  return (
    <div className="relative flex w-28 flex-col items-center gap-1">
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-foreground/70 !bg-background"
      />
      <div
        className={
          selected
            ? "rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background"
            : "rounded-full"
        }
      >
        <GuyMark
          color={data.color}
          avatarEyes={data.avatarEyes}
          avatarFacialHair={data.avatarFacialHair}
          avatarHat={data.avatarHat}
          className="size-16"
        />
      </div>
      <p className="max-w-full truncate text-center font-heading text-[0.625rem] font-semibold tracking-widest uppercase">
        {data.label}
      </p>
      <p className="max-w-full truncate text-center text-[0.6rem] tracking-wide text-muted-foreground uppercase">
        {isImageModel(data.model) ? "image" : "bot"}
      </p>
      <Select value={data.model} onValueChange={pickModel}>
        <SelectTrigger
          size="sm"
          className="nodrag nopan h-6 w-full gap-1 px-1.5 text-[0.6rem] **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
          aria-label={`Model for ${data.label}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="nodrag nopan">
          {MODELS.map((item) => (
            <SelectItem key={item.id} value={item.id} className="text-xs">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-foreground/70 !bg-background"
      />
    </div>
  )
}

export function BoardEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<FlowEdge>) {
  const loop = data?.kind === "loop" || source === target
  const [path, labelX, labelY] =
    source === target
      ? selfLoop(sourceX, sourceY, targetX, targetY)
      : getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 2.4 : 1.7,
          strokeDasharray: loop ? "6 4" : undefined,
        }}
      />
      {loop ? (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan pointer-events-none absolute text-[0.6rem] font-semibold tracking-widest text-muted-foreground uppercase"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            loop
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

function selfLoop(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): [string, number, number] {
  const lift = 72
  const swing = 28
  const path = `M ${sourceX} ${sourceY} C ${sourceX + swing} ${sourceY - lift}, ${targetX - swing} ${targetY - lift}, ${targetX} ${targetY}`
  return [
    path,
    (sourceX + targetX) / 2,
    Math.min(sourceY, targetY) - lift * 0.55,
  ]
}
