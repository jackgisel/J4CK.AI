import { api } from "@/lib/api"

export type List = {
  id: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

export type ListNode = List & { children: ListNode[] }

export async function listLists() {
  const data = await api<{ lists: List[] }>("/api/lists")
  return data.lists
}

export async function createList(name: string, parentId: string | null) {
  const data = await api<{ list: List }>("/api/lists", {
    method: "POST",
    body: JSON.stringify({ name, parentId }),
  })
  return data.list
}

export async function renameList(id: string, name: string) {
  const data = await api<{ list: List }>(`/api/lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })
  return data.list
}

export async function deleteList(id: string) {
  await api<void>(`/api/lists/${id}`, { method: "DELETE" })
}

export function buildListTree(rows: List[]): ListNode[] {
  const nodes = new Map<string, ListNode>()
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] })
  }

  const roots: ListNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const byCreated = (a: ListNode, b: ListNode) =>
    a.createdAt.localeCompare(b.createdAt)
  const sortDeep = (level: ListNode[]) => {
    level.sort(byCreated)
    for (const node of level) {
      sortDeep(node.children)
    }
  }
  sortDeep(roots)
  return roots
}

export function countDescendants(node: ListNode): number {
  return node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0
  )
}

export function descendantIds(rows: List[], id: string) {
  const ids = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id)
        grew = true
      }
    }
  }
  return ids
}
