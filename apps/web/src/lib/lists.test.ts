import { expect, test } from "bun:test"

import {
  buildListTree,
  countDescendants,
  descendantIds,
  type List,
} from "./lists"

function row(id: string, parentId: string | null, minute: number): List {
  const at = new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString()
  return { id, parentId, name: id, createdAt: at, updatedAt: at }
}

const rows = [
  row("work", null, 2),
  row("home", null, 1),
  row("q3", "work", 4),
  row("q2", "work", 3),
  row("okrs", "q3", 5),
  row("stray", "missing", 6),
]

test("buildListTree nests children under parents in creation order", () => {
  const tree = buildListTree(rows)
  expect(tree.map((node) => node.id)).toEqual(["home", "work", "stray"])
  const work = tree[1]!
  expect(work.children.map((node) => node.id)).toEqual(["q2", "q3"])
  expect(work.children[1]!.children.map((node) => node.id)).toEqual(["okrs"])
})

test("countDescendants counts every level below a node", () => {
  const work = buildListTree(rows)[1]!
  expect(countDescendants(work)).toBe(3)
})

test("descendantIds includes the node and its whole subtree", () => {
  expect([...descendantIds(rows, "work")].sort()).toEqual(
    ["okrs", "q2", "q3", "work"].sort()
  )
  expect([...descendantIds(rows, "home")]).toEqual(["home"])
})
