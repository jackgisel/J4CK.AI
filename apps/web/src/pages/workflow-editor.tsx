import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  PipelineCanvas,
  type PipelineCanvasHandle,
} from "@/components/pipeline-canvas"
import { WorkflowChat } from "@/components/workflow-chat"
import { listGuys, type Guy } from "@/lib/guys"
import {
  deletePipeline,
  getPipeline,
  hydrateGraph,
  runInputs,
  startPipelineRun,
  updatePipeline,
  type Pipeline,
  type PipelineGraph,
} from "@/lib/pipelines"

export function WorkflowEditorPage() {
  return <WorkflowEditor />
}

function WorkflowEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef<PipelineCanvasHandle>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [guys, setGuys] = useState<Guy[]>([])
  const [name, setName] = useState("")
  const [graph, setGraph] = useState<PipelineGraph | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [runValues, setRunValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)

  const onGraphChange = useCallback((next: PipelineGraph) => {
    setGraph(next)
  }, [])

  useEffect(() => {
    if (!id) {
      return
    }
    let cancelled = false
    Promise.all([getPipeline(id), listGuys()])
      .then(([row, rows]) => {
        if (cancelled) {
          return
        }
        setGuys(rows)
        setPipeline(row)
        setName(row.name)
        setGraph(hydrateGraph(row.graph, rows))
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
  }, [id])

  if (missing || !id) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-6 p-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Missing
        </h1>
        <p className="text-base text-muted-foreground">No workflow with that id.</p>
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

  if (!pipeline || !graph) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  }

  const row = pipeline
  const currentGraph = graph
  const fields = runInputs(currentGraph)
  const selectedNode = currentGraph.nodes.find((node) => node.id === selectedId)
  const selectedGuy =
    guys.find((guy) => guy.id === selectedNode?.data.guyId) ?? null

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updatePipeline(row.id, { name, graph: currentGraph })
      setPipeline(updated)
      setName(updated.name)
      setGraph(hydrateGraph(updated.graph, guys))
      setSaving(false)
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save")
      setSaving(false)
      return false
    }
  }

  async function onRun() {
    const ok = await save()
    if (!ok) {
      return
    }
    const next: Record<string, string> = {}
    for (const field of fields) {
      next[field.key] = runValues[field.key] ?? ""
    }
    setRunValues(next)
    setRunOpen(true)
  }

  async function submitRun() {
    setRunning(true)
    setError(null)
    try {
      const started = await startPipelineRun(row.id, runValues)
      navigate(`/workflows/${row.id}/runs/${started.run.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not run")
      setRunning(false)
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this workflow?")) {
      return
    }
    setDeleting(true)
    try {
      await deletePipeline(row.id)
      navigate("/workflows", { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete")
      setDeleting(false)
    }
  }

  function onSpawned(guy: Guy, model: string) {
    setGuys((current) =>
      current.some((row) => row.id === guy.id) ? current : [guy, ...current]
    )
    const placed = canvasRef.current?.placeGuy(guy, model)
    if (placed) {
      setSelectedId(placed)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-xs"
          aria-label="Workflow name"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={deleting}
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || running}
            onClick={() => {
              void save()
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" disabled={saving || running} onClick={() => void onRun()}>
            Run
          </Button>
        </div>
      </div>
      {error ? (
        <p className="border-b border-border px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[42vh] min-h-0 w-full shrink-0 flex-col border-b border-border lg:h-auto lg:w-[22rem] lg:border-r lg:border-b-0">
          <WorkflowChat
            guy={selectedGuy}
            onSpawned={onSpawned}
            onClear={() => setSelectedId(null)}
          />
        </div>
        <PipelineCanvas
          key={row.id}
          ref={canvasRef}
          graph={currentGraph}
          guys={guys}
          selectedId={selectedId}
          onChange={onGraphChange}
          onSelect={setSelectedId}
        />
      </div>
      <Sheet open={runOpen} onOpenChange={setRunOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Run</SheetTitle>
            <SheetDescription>
              {fields.length > 0
                ? "Guys with no incoming arrow take the first text."
                : "Every guy reads from someone else. It will run as-is."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-8">
            {fields.map((field) => (
              <label key={field.key} className="flex flex-col gap-2">
                <Label htmlFor={`run-${field.key}`}>{field.label}</Label>
                <Textarea
                  id={`run-${field.key}`}
                  value={runValues[field.key] ?? ""}
                  onChange={(event) =>
                    setRunValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <SheetFooter>
            <Button disabled={running} onClick={() => void submitRun()}>
              {running ? "Starting…" : "Start"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
