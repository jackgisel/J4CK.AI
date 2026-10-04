import { useEffect, useState, type FormEvent } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { InlineInput } from "@/components/inline-input"
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type Task,
} from "@/lib/tasks"

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    listTasks()
      .then((rows) => {
        if (!cancelled) {
          setTasks(rows)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(messageOf(caught, "Could not load tasks"))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) {
      return
    }
    setAdding(true)
    setError(null)
    try {
      const created = await createTask(title)
      setTasks((rows) => [...(rows ?? []), created])
      setDraft("")
    } catch (caught) {
      setError(messageOf(caught, "Could not add task"))
    } finally {
      setAdding(false)
    }
  }

  async function onUpdate(
    id: string,
    input: Partial<Pick<Task, "title" | "done">>
  ) {
    setError(null)
    try {
      const updated = await updateTask(id, input)
      setTasks((rows) =>
        (rows ?? []).map((row) => (row.id === id ? updated : row))
      )
    } catch (caught) {
      setError(messageOf(caught, "Could not update task"))
    }
  }

  async function onDelete(id: string) {
    setError(null)
    try {
      await deleteTask(id)
      setTasks((rows) => (rows ?? []).filter((row) => row.id !== id))
    } catch (caught) {
      setError(messageOf(caught, "Could not delete task"))
    }
  }

  const open = (tasks ?? [])
    .filter((row) => !row.done)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const done = (tasks ?? [])
    .filter((row) => row.done)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <form className="flex gap-2" onSubmit={onAdd}>
        <Input
          aria-label="New task"
          placeholder="Add a task"
          className="min-h-10"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <Button type="submit" disabled={adding || !draft.trim()}>
          Add
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {tasks === null ? (
        error ? null : <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to do.</p>
          ) : (
            <TaskList rows={open} onUpdate={onUpdate} onDelete={onDelete} />
          )}
          {done.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                Completed · {done.length}
              </h2>
              <TaskList rows={done} onUpdate={onUpdate} onDelete={onDelete} />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function TaskList({
  rows,
  onUpdate,
  onDelete,
}: {
  rows: Task[]
  onUpdate: (id: string, input: Partial<Pick<Task, "title" | "done">>) => void
  onDelete: (id: string) => void
}) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <TaskRow
          key={row.id}
          task={row}
          onUpdate={(input) => onUpdate(row.id, input)}
          onDelete={() => onDelete(row.id)}
        />
      ))}
    </ul>
  )
}

function TaskRow({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task
  onUpdate: (input: Partial<Pick<Task, "title" | "done">>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li className="group flex min-h-12 items-center gap-3 border-b border-border first:border-t">
      <Checkbox
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        checked={task.done}
        onCheckedChange={(checked) => onUpdate({ done: checked })}
      />
      {editing ? (
        <InlineInput
          label="Task title"
          initial={task.title}
          onSubmit={(title) => {
            setEditing(false)
            if (title !== task.title) {
              onUpdate({ title })
            }
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          className={`min-w-0 flex-1 truncate py-3 text-left text-sm ${
            task.done ? "text-muted-foreground line-through" : ""
          }`}
          onClick={() => setEditing(true)}
        >
          {task.title}
        </button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete task"
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </li>
  )
}

function messageOf(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}
