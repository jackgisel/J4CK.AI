import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"

import { Button } from "@workspace/ui/components/button"
import {
  createPipeline,
  formatRunTime,
  listPipelines,
  type Pipeline,
} from "@/lib/pipelines"

export function WorkflowsPage() {
  return <WorkflowList />
}

function WorkflowList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Pipeline[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<"blank" | "review" | null>(null)

  useEffect(() => {
    let cancelled = false
    listPipelines()
      .then((loaded) => {
        if (!cancelled) {
          setRows(loaded)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load workflows"
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function create(template: "blank" | "review") {
    setCreating(template)
    setError(null)
    try {
      const pipeline = await createPipeline({ template })
      navigate(`/workflows/${pipeline.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create")
      setCreating(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Invent a guy in chat. Drop faces on the board. Draw arrows and loops.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={creating !== null}
            onClick={() => create("review")}
          >
            {creating === "review" ? "Creating…" : "Use example"}
          </Button>
          <Button disabled={creating !== null} onClick={() => create("blank")}>
            {creating === "blank" ? "Creating…" : "New board"}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          None yet. Invent a guy in chat, or use the example.
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-border first:border-t">
              <Link
                to={`/workflows/${row.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-muted/40"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-heading text-sm font-semibold tracking-wide uppercase">
                    {row.name}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {row.graph.nodes.length} nodes
                    {row.lastRun
                      ? ` · ${row.lastRun.status} ${formatRunTime(row.lastRun.createdAt)}`
                      : " · never run"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
