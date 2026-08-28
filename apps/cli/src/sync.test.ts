import { expect, test } from "bun:test"

import {
  joinPrefix,
  planSync,
  shouldSkipPath,
  stripPrefix,
  type LocalFile,
  type RemoteFile,
  type SnapshotFile,
} from "./sync"

function local(
  path: string,
  size: number,
  mtimeMs: number
): [string, LocalFile] {
  return [path, { path, size, mtimeMs }]
}

function remote(
  path: string,
  size: number,
  etag: string,
  uploaded: string
): [string, RemoteFile] {
  return [path, { path, size, etag, uploaded }]
}

function snap(
  path: string,
  etag: string,
  size: number,
  mtimeMs: number
): [string, SnapshotFile] {
  return [path, { etag, size, mtimeMs }]
}

test("stripPrefix maps cabinet paths onto the local folder", () => {
  expect(stripPrefix("files/books/a.md", "files")).toBe("books/a.md")
  expect(stripPrefix("files", "files")).toBe("")
  expect(stripPrefix("hooks/on-idle.md", "files")).toBe(null)
  expect(joinPrefix("files", "books/a.md")).toBe("files/books/a.md")
  expect(shouldSkipPath(".sync.json")).toBe(true)
  expect(shouldSkipPath("books/.DS_Store")).toBe(true)
  expect(shouldSkipPath("books/a.md")).toBe(false)
})

test("planSync pushes local-only files and pulls remote-only files", () => {
  const actions = planSync({
    local: new Map([local("new.md", 4, 100)]),
    remote: new Map([remote("site.md", 8, "e1", "2026-08-01T00:00:00.000Z")]),
    snapshot: new Map(),
    remove: true,
  })
  expect(actions).toEqual([
    { type: "push", path: "new.md", reason: "new" },
    { type: "pull", path: "site.md", reason: "new" },
  ])
})

test("planSync skips files that already match the snapshot", () => {
  const actions = planSync({
    local: new Map([local("a.md", 10, 50)]),
    remote: new Map([remote("a.md", 10, "etag", "2026-08-01T00:00:00.000Z")]),
    snapshot: new Map([snap("a.md", "etag", 10, 50)]),
    remove: true,
  })
  expect(actions).toEqual([])
})

test("planSync pushes when only local changed and pulls when only remote changed", () => {
  expect(
    planSync({
      local: new Map([local("a.md", 11, 80)]),
      remote: new Map([remote("a.md", 10, "etag", "2026-08-01T00:00:00.000Z")]),
      snapshot: new Map([snap("a.md", "etag", 10, 50)]),
      remove: true,
    })
  ).toEqual([{ type: "push", path: "a.md", reason: "changed" }])

  expect(
    planSync({
      local: new Map([local("a.md", 10, 50)]),
      remote: new Map([remote("a.md", 12, "new", "2026-08-02T00:00:00.000Z")]),
      snapshot: new Map([snap("a.md", "etag", 10, 50)]),
      remove: true,
    })
  ).toEqual([{ type: "pull", path: "a.md", reason: "changed" }])
})

test("planSync last-write-wins when both sides changed", () => {
  const localNewer = planSync({
    local: new Map([local("a.md", 11, Date.parse("2026-08-20T00:00:00.000Z"))]),
    remote: new Map([remote("a.md", 12, "new", "2026-08-10T00:00:00.000Z")]),
    snapshot: new Map([snap("a.md", "old", 10, 1)]),
    remove: true,
  })
  expect(localNewer).toEqual([
    { type: "push", path: "a.md", reason: "conflict" },
  ])

  const remoteNewer = planSync({
    local: new Map([local("a.md", 11, Date.parse("2026-08-01T00:00:00.000Z"))]),
    remote: new Map([remote("a.md", 12, "new", "2026-08-10T00:00:00.000Z")]),
    snapshot: new Map([snap("a.md", "old", 10, 1)]),
    remove: true,
  })
  expect(remoteNewer).toEqual([
    { type: "pull", path: "a.md", reason: "conflict" },
  ])
})

test("planSync deletes only when mirroring is on", () => {
  const mirrored = planSync({
    local: new Map([local("kept.md", 1, 1)]),
    remote: new Map([
      remote("gone-local.md", 1, "e", "2026-08-01T00:00:00.000Z"),
    ]),
    snapshot: new Map([
      snap("kept.md", "x", 1, 1),
      snap("gone-local.md", "e", 1, 1),
    ]),
    remove: true,
  })
  expect(mirrored).toEqual([
    { type: "delete-remote", path: "gone-local.md" },
    { type: "delete-local", path: "kept.md" },
  ])

  const kept = planSync({
    local: new Map([local("kept.md", 1, 1)]),
    remote: new Map([
      remote("gone-local.md", 1, "e", "2026-08-01T00:00:00.000Z"),
    ]),
    snapshot: new Map([
      snap("kept.md", "x", 1, 1),
      snap("gone-local.md", "e", 1, 1),
    ]),
    remove: false,
  })
  expect(kept).toEqual([])
})
