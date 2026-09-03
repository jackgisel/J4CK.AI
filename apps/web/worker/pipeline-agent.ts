import { Agent, getAgentByName } from "agents"
import { eq } from "drizzle-orm"

import { createDb } from "./db"
import { pipelineRun } from "./db/schema"
import type { NodeOutput, PipelineGraph } from "./pipeline-graph"
import { artifactKey } from "./pipeline-providers"

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

export type StartRunPayload = {
  pipelineId: string
  userId: string
  graph: PipelineGraph
  input: Record<string, string>
}

export class PipelineRunAgent extends Agent<Env, PipelineRunAgentState> {
  initialState: PipelineRunAgentState = {
    pipelineId: "",
    userId: "",
    status: "idle",
    input: {},
    nodes: {},
    error: null,
  }

  async start(payload: StartRunPayload) {
    const nodes: Record<string, NodeRunState> = {}
    for (const node of payload.graph.nodes) {
      nodes[node.id] = { status: "pending" }
    }
    this.setState({
      pipelineId: payload.pipelineId,
      userId: payload.userId,
      status: "running",
      input: payload.input,
      nodes,
      error: null,
    })

    const instanceId = await this.runWorkflow(
      "PIPELINE_WORKFLOW",
      {
        runId: this.name,
        pipelineId: payload.pipelineId,
        userId: payload.userId,
        graph: payload.graph,
        input: payload.input,
      },
      { agentBinding: "PipelineRunAgent" }
    )
    await this.writeRun({ workflowInstanceId: instanceId, status: "running" })
    return instanceId
  }

  async markNode(nodeId: string, patch: NodeRunState) {
    this.setState({
      ...this.state,
      nodes: {
        ...this.state.nodes,
        [nodeId]: {
          ...this.state.nodes[nodeId],
          ...patch,
        },
      },
    })
  }

  async snapshot(): Promise<Record<string, NodeOutput>> {
    const outputs: Record<string, NodeOutput> = {}
    for (const [id, node] of Object.entries(this.state.nodes)) {
      outputs[id] = {
        text: node.text,
        artifactKey: node.artifact
          ? artifactKey(
              this.state.userId,
              this.state.pipelineId,
              this.name,
              id
            )
          : undefined,
        contentType: node.contentType,
      }
    }
    return outputs
  }

  async onWorkflowComplete() {
    this.setState({
      ...this.state,
      status: "complete",
      error: null,
    })
    await this.writeRun({ status: "complete" })
  }

  async onWorkflowError(workflowName: string, instanceId: string, error: string) {
    void workflowName
    void instanceId
    this.setState({
      ...this.state,
      status: "error",
      error,
    })
    await this.writeRun({ status: "error" })
  }

  private async writeRun(patch: {
    status?: "running" | "complete" | "error"
    workflowInstanceId?: string
  }) {
    const db = createDb(this.env.DB)
    await db
      .update(pipelineRun)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(pipelineRun.id, this.name))
  }
}

export async function startPipelineRun(
  env: Env,
  runId: string,
  payload: StartRunPayload
) {
  const agent = await getAgentByName<Env, PipelineRunAgent>(
    env.PipelineRunAgent,
    runId
  )
  return agent.start(payload)
}

export async function readPipelineRunState(env: Env, runId: string) {
  const agent = await getAgentByName<Env, PipelineRunAgent>(
    env.PipelineRunAgent,
    runId
  )
  return agent.state
}
