import { useEffect, useState, type FormEvent } from "react"
import {
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { InlineInput } from "@/components/inline-input"
import {
  buildListTree,
  countDescendants,
  createList,
  deleteList,
  descendantIds,
  listLists,
  renameList,
  type List,
  type ListNode,
} from "@/lib/lists"

type Actions = {
  collapsed: Set<string>
  toggle: (id: string) => void
  create: (name: string, parentId: string | null) => Promise<boolean>
  rename: (id: string, name: string) => void
  remove: (node: ListNode) => void
}

export function ListsPage() {
  const [rows, setRows] = useState<List[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    listLists()
      .then((data) => {
        if (!cancelled) {
          setRows(data)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(messageOf(caught, "Could not load lists"))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function create(name: string, parentId: string | null) {
    setError(null)
    try {
      const created = await createList(name, parentId)
      setRows((current) => [...(current ?? []), created])
      if (parentId) {
        setCollapsed((current) => {
          const next = new Set(current)
          next.delete(parentId)
          return next
        })
      }
      return true
    } catch (caught) {
      setError(messageOf(caught, "Could not create list"))
      return false
    }
  }

  async function rename(id: string, name: string) {
    setError(null)
    try {
      const updated = await renameList(id, name)
      setRows((current) =>
        (current ?? []).map((row) => (row.id === id ? updated : row))
      )
    } catch (caught) {
      setError(messageOf(caught, "Could not rename list"))
    }
  }

  async function remove(node: ListNode) {
    const nested = countDescendants(node)
    const prompt =
      nested > 0
        ? `Delete "${node.name}" and ${nested} nested ${nested === 1 ? "list" : "lists"}?`
        : `Delete "${node.name}"?`
    if (!window.confirm(prompt)) {
      return
    }
    setError(null)
    try {
      await deleteList(node.id)
      setRows((current) => {
        const gone = descendantIds(current ?? [], node.id)
        return (current ?? []).filter((row) => !gone.has(row.id))
      })
    } catch (caught) {
      setError(messageOf(caught, "Could not delete list"))
    }
  }

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.trim()
    if (name && (await create(name, null))) {
      setDraft("")
    }
  }

  const tree = rows ? buildListTree(rows) : []
  const actions: Actions = { collapsed, toggle, create, rename, remove }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <form className="flex gap-2" onSubmit={onAdd}>
        <Input
          aria-label="New list"
          placeholder="New list"
          className="min-h-10"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <Button type="submit" disabled={!draft.trim()}>
          Create
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {rows === null ? (
        error ? null : <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lists yet.</p>
      ) : (
        <ul className="flex flex-col border-t border-border">
          {tree.map((node) => (
            <ListItem key={node.id} node={node} depth={0} actions={actions} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ListItem({
  node,
  depth,
  actions,
}: {
  node: ListNode
  depth: number
  actions: Actions
}) {
  const [renaming, setRenaming] = useState(false)
  const [adding, setAdding] = useState(false)
  const isOpen = !actions.collapsed.has(node.id)
  const hasChildren = node.children.length > 0
  const indent = { paddingLeft: `${depth * 1.5}rem` }

  return (
    <li>
      <div
        className="group flex min-h-11 items-center gap-1 border-b border-border"
        style={indent}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={isOpen ? "Collapse" : "Expand"}
            aria-expanded={isOpen}
            onClick={() => actions.toggle(node.id)}
          >
            <ChevronRightIcon
              className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </Button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden />
        )}
        {renaming ? (
          <InlineInput
            label="List name"
            initial={node.name}
            onSubmit={(name) => {
              setRenaming(false)
              if (name !== node.name) {
                actions.rename(node.id, name)
              }
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate py-2 text-sm">
            {node.name}
            {hasChildren ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {node.children.length}
              </span>
            ) : null}
          </span>
        )}
        <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add a list inside ${node.name}`}
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${node.name}`}
            onClick={() => setRenaming(true)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${node.name}`}
            onClick={() => actions.remove(node)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {adding ? (
        <div
          className="flex min-h-11 items-center gap-1 border-b border-border"
          style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
        >
          <span className="size-7 shrink-0" aria-hidden />
          <InlineInput
            label={`New list inside ${node.name}`}
            placeholder="Nested list name"
            initial=""
            onSubmit={(name) => {
              setAdding(false)
              void actions.create(name, node.id)
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : null}

      {hasChildren && isOpen ? (
        <ul>
          {node.children.map((child) => (
            <ListItem
              key={child.id}
              node={child}
              depth={depth + 1}
              actions={actions}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function messageOf(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}
