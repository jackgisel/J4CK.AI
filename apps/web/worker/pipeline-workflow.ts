import { AgentWorkflow } from "agents/workflows"
import type { AgentWorkflowEvent, AgentWorkflowStep } from "agents/workflows"

import type { PipelineRunAgent } from "./pipeline-agent"
import type { NodeOutput, PipelineGraph } from "./pipeline-graph"
import { topoWaves } from "./pipeline-graph"
import { executeNode } from "./pipeline-providers"

export type PipelineWorkflowParams = {
  runId: string
  pipelineId: string
  userId: string
  graph: PipelineGraph
  input: Record<string, string>
}

const STEP_CONFIG = {
  retries: {
    limit: 2,
    delay: "8 seconds" as const,
    backoff: "exponential" as const,
  },
  timeout: "6 minutes" as const,
}

export class PipelineWorkflow extends AgentWorkflow<
  PipelineRunAgent,
  PipelineWorkflowParams
> {
  async run(
    event: AgentWorkflowEvent<PipelineWorkflowParams>,
    step: AgentWorkflowStep
  ) {
    const params = event.payload
    const waves = topoWaves(params.graph)
    if ("error" in waves) {
      throw new Error(waves.error)
    }

    const outputs: Record<string, NodeOutput> = {}
    const total = params.graph.nodes.length
    let finished = 0

    for (const wave of waves) {
      const results = await Promise.all(
        wave.map((node) =>
          step.do(`node:${node.id}`, STEP_CONFIG, async () => {
            await this.agent.markNode(node.id, { status: "running" })
            try {
              const prior = await this.agent.snapshot()
              const output = await executeNode(this.env, params.graph, node, {
                userId: params.userId,
                pipelineId: params.pipelineId,
                runId: params.runId,
                inputs: params.input,
                outputs: { ...outputs, ...prior },
              })
              await this.agent.markNode(node.id, {
                status: "complete",
                text: output.text,
                artifact: Boolean(output.artifactKey),
                contentType: output.contentType,
              })
              return output
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Step failed"
              await this.agent.markNode(node.id, {
                status: "error",
                error: message,
              })
              throw error
            }
          })
        )
      )

      wave.forEach((node, index) => {
        const output = results[index]
        if (output) {
          outputs[node.id] = output
        }
      })
      finished += wave.length
      await this.reportProgress({
        step: wave.map((node) => node.id).join(","),
        status: "complete",
        percent: total === 0 ? 1 : finished / total,
      })
    }

    await step.reportComplete({ ok: true })
    return { ok: true }
  }
}
