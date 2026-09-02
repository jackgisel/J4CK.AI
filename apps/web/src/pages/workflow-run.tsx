import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { useAgent } from "agents/react"

import { Button } from "@workspace/ui/components/button"
import {
  artifactUrl,
  getPipelineRun,
  isImageModel,
  type Pipeline,
  type PipelineRun,
  type PipelineRunAgentState,
} from "@/lib/pipelines"

export function WorkflowRunPage() {
  return <WorkflowRun />
}

function WorkflowRun() {
  const { id, runId } = useParams()
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [state, setState] = useState<PipelineRunAgentState | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !runId) {
      return
    }
    let cancelled = false
    getPipelineRun(id, runId)
      .then((data) => {
        if (cancelled) {
          return
        }
        setPipeline(data.pipeline)
        setRun(data.run)
        setState(data.state)
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return
        }
        const message =
          caught instanceof Error ? caught.message : "Could not load"
        if (message === "Not found") {
          setMissing(true)
          return
        }
        setLoadError(message)
      })
    return () => {
      cancelled = true
    }
  }, [id, runId])

  useAgent<PipelineRunAgentState>({
    agent: "pipeline-run-agent",
    name: runId ?? "pending",
    onStateUpdate: (next) => {
      if (next.pipelineId) {
        setState(next)
      }
    },
  })

  if (missing || !id || !runId) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-6 p-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Missing
        </h1>
        <p className="text-base text-muted-foreground">No run with that id.</p>
        <div>
          <Button variant="outline" render={<Link to="/workflows" />}>
            Workflows
          </Button>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <p className="p-6 text-sm text-destructive" role="alert">
        {loadError}
      </p>
    )
  }

  if (!pipeline || !run) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  }

  const status = state?.status ?? run.status
  const nodes = pipeline.graph.nodes
  const nodeState = state?.nodes ?? {}

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-border p-4 lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-sm font-semibold tracking-wide uppercase">
            {pipeline.name}
          </p>
          <StatusMark status={status} />
        </div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link to={`/workflows/${pipeline.id}`} />}
        >
          Graph
        </Button>
        <ol className="flex flex-col gap-3">
          {nodes.map((node) => {
            const current = nodeState[node.id]
            return (
              <li key={node.id} className="flex flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{node.data.label}</span>
                  <StatusMark status={current?.status ?? "pending"} />
                </span>
                {current?.error ? (
                  <span className="text-xs text-destructive">{current.error}</span>
                ) : null}
              </li>
            )
          })}
        </ol>
        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex max-w-3xl flex-col gap-8">
          {nodes
            .filter((node) => nodeState[node.id]?.status === "complete")
            .map((node) => {
              const current = nodeState[node.id]
              if (!current) {
                return null
              }
              return (
                <section key={node.id} className="flex flex-col gap-3">
                  <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
                    {node.data.label}
                  </h2>
                  {current.artifact ? (
                    <img
                      src={artifactUrl(pipeline.id, run.id, node.id)}
                      alt={node.data.label}
                      className="max-h-[28rem] w-full border border-border object-contain bg-muted"
                    />
                  ) : null}
                  {current.text && !isImageModel(node.data.model) ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {current.text}
                    </p>
                  ) : null}
                </section>
              )
            })}
          {status === "running" ? (
            <p className="text-sm text-muted-foreground">Running…</p>
          ) : null}
          {status === "complete" &&
          !nodes.some((node) => nodeState[node.id]?.status === "complete") ? (
            <p className="text-sm text-muted-foreground">Nothing to show.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatusMark({ status }: { status: string }) {
  const label =
    status === "complete"
      ? "Done"
      : status === "running"
        ? "Run"
        : status === "error"
          ? "Fail"
          : "Wait"
  return (
    <span
      className={
        status === "error"
          ? "text-[0.625rem] font-semibold tracking-widest text-destructive uppercase"
          : status === "complete"
            ? "text-[0.625rem] font-semibold tracking-widest uppercase"
            : "text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase"
      }
    >
      {label}
    </span>
  )
}
