import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"

import { GuyMark } from "@/components/guy-mark"
import {
  isImageModel,
  type PipelineEdgeKind,
  type PipelineNodeData,
  type PipelineNodeType,
} from "@/lib/pipelines"

export type FlowNode = Node<PipelineNodeData, PipelineNodeType>
export type FlowEdge = Edge<{ kind: PipelineEdgeKind }>

export function GuyFlowNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div className="relative flex w-24 flex-col items-center gap-1">
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
  return [path, (sourceX + targetX) / 2, Math.min(sourceY, targetY) - lift * 0.55]
}
