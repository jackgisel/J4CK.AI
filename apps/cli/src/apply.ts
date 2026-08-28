import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"

import type { Site } from "./api"
import type { Link, Snapshot } from "./config"
import { loadSnapshot, saveSnapshot } from "./config"
import {
  joinPrefix,
  planSync,
  shouldSkipPath,
  skipName,
  stripPrefix,
  trimPath,
  type LocalFile,
  type RemoteFile,
  type SnapshotFile,
} from "./sync"

export type ApplyCounts = {
  pushed: number
  pulled: number
  deleted: number
  conflicts: number
}

export async function syncLink(
  site: Site,
  link: Link,
  mode: "sync" | "pull" | "push",
  remove: boolean
) {
  const dir = resolve(link.dir)
  const folder = await stat(dir).catch(() => null)
  if (!folder?.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`)
  }

  const prefix = trimPath(link.path) || "files"
  const local = await walkLocal(dir)
  const remoteListed = await site.listHome(link.guyId, prefix)
  const remote = new Map<string, RemoteFile>()
  for (const file of remoteListed) {
    const rel = stripPrefix(file.path, prefix)
    if (rel === null || !rel || shouldSkipPath(rel)) {
      continue
    }
    remote.set(rel, {
      path: rel,
      size: file.size,
      etag: file.etag,
      uploaded: file.uploaded,
    })
  }

  const stored = await loadSnapshot(link.guyId)
  const snapshot = new Map<string, SnapshotFile>(Object.entries(stored.files))

  let actions = planSync({ local, remote, snapshot, remove })
  if (mode === "pull") {
    actions = actions.filter(
      (action) => action.type === "pull" || action.type === "delete-local"
    )
  }
  if (mode === "push") {
    actions = actions.filter(
      (action) => action.type === "push" || action.type === "delete-remote"
    )
  }

  const counts: ApplyCounts = {
    pushed: 0,
    pulled: 0,
    deleted: 0,
    conflicts: 0,
  }
  const nextFiles = { ...stored.files }

  for (const action of actions) {
    if (action.type === "push" || action.type === "pull") {
      if (action.reason === "conflict") {
        counts.conflicts += 1
        console.log(`conflict ${action.path} → ${action.type}`)
      }
    }
    if (action.type === "push") {
      const abs = join(dir, action.path)
      const bytes = await readFile(abs)
      const written = await site.upload(
        link.guyId,
        joinPrefix(prefix, action.path),
        bytes,
        contentType(action.path)
      )
      const info = await stat(abs)
      nextFiles[action.path] = {
        etag: written.etag,
        size: info.size,
        mtimeMs: info.mtimeMs,
      }
      counts.pushed += 1
      console.log(`push ${action.path}`)
      continue
    }
    if (action.type === "pull") {
      const remotePath = joinPrefix(prefix, action.path)
      const downloaded = await site.download(link.guyId, remotePath)
      const abs = join(dir, action.path)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, downloaded.bytes)
      const info = await stat(abs)
      const remoteMeta = remote.get(action.path)
      nextFiles[action.path] = {
        etag: downloaded.etag || remoteMeta?.etag || "",
        size: info.size,
        mtimeMs: info.mtimeMs,
      }
      counts.pulled += 1
      console.log(`pull ${action.path}`)
      continue
    }
    if (action.type === "delete-local") {
      await unlink(join(dir, action.path)).catch(() => undefined)
      delete nextFiles[action.path]
      counts.deleted += 1
      console.log(`delete local ${action.path}`)
      continue
    }
    await site.deleteFile(link.guyId, joinPrefix(prefix, action.path))
    delete nextFiles[action.path]
    counts.deleted += 1
    console.log(`delete remote ${action.path}`)
  }

  const snapshotOut: Snapshot = {
    guyId: link.guyId,
    path: prefix,
    files: nextFiles,
  }
  await saveSnapshot(snapshotOut)
  return counts
}

export async function walkLocal(root: string) {
  const out = new Map<string, LocalFile>()
  async function visit(path: string) {
    const entries = await readdir(path, { withFileTypes: true })
    for (const entry of entries) {
      if (skipName(entry.name)) {
        continue
      }
      const next = join(path, entry.name)
      if (entry.isDirectory()) {
        await visit(next)
        continue
      }
      if (!entry.isFile()) {
        continue
      }
      const rel = trimPath(relative(root, next))
      if (!rel || shouldSkipPath(rel)) {
        continue
      }
      const info = await stat(next)
      out.set(rel, { path: rel, size: info.size, mtimeMs: info.mtimeMs })
    }
  }
  await visit(root)
  return out
}

export function summarize(counts: ApplyCounts) {
  return `${counts.pulled} pulled, ${counts.pushed} pushed, ${counts.deleted} deleted`
}

export function contentType(path: string) {
  if (path.endsWith(".md")) {
    return "text/markdown; charset=utf-8"
  }
  if (path.endsWith(".csv")) {
    return "text/csv; charset=utf-8"
  }
  if (path.endsWith(".json")) {
    return "application/json"
  }
  if (path.endsWith(".txt")) {
    return "text/plain; charset=utf-8"
  }
  if (path.endsWith(".pdf")) {
    return "application/pdf"
  }
  if (path.endsWith(".png")) {
    return "image/png"
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg"
  }
  return "application/octet-stream"
}
