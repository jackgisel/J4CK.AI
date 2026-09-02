import type { ReactNode } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import {
  isImageModel,
  modelLabel,
  type PipelineNodeData,
  type PipelineNodeType,
} from "@/lib/pipelines"

export type FlowNode = Node<PipelineNodeData, PipelineNodeType>

function NodeShell({
  selected,
  children,
}: {
  selected: boolean
  children: ReactNode
}) {
  return (
    <div
      className={
        selected
          ? "w-56 border border-foreground bg-card px-3 py-2.5 shadow-sm"
          : "w-56 border border-border bg-card px-3 py-2.5"
      }
    >
      {children}
    </div>
  )
}

export function StepFlowNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <NodeShell selected={selected}>
      <Handle type="target" position={Position.Left} />
      <p className="font-heading text-sm font-semibold tracking-wide uppercase">
        {data.label}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {modelLabel(data.model)}
        {isImageModel(data.model) ? " · image" : ""}
        {data.inputFrom ? " · from node" : " · text"}
      </p>
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  )
}
