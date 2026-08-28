export type RemoteFile = {
  path: string
  size: number
  etag: string
  uploaded: string
}

export type LocalFile = {
  path: string
  size: number
  mtimeMs: number
}

export type SnapshotFile = {
  etag: string
  size: number
  mtimeMs: number
}

export type SyncAction =
  | { type: "push"; path: string; reason: "new" | "changed" | "conflict" }
  | { type: "pull"; path: string; reason: "new" | "changed" | "conflict" }
  | { type: "delete-local"; path: string }
  | { type: "delete-remote"; path: string }

const MTIME_SLOP_MS = 2

export function skipName(name: string) {
  return name.startsWith(".") || name === "Thumbs.db"
}

export function joinPrefix(prefix: string, relative: string) {
  const base = trimPath(prefix)
  const rel = trimPath(relative)
  if (!base) {
    return rel
  }
  if (!rel) {
    return base
  }
  return `${base}/${rel}`
}

export function stripPrefix(remotePath: string, prefix: string) {
  const base = trimPath(prefix)
  const path = trimPath(remotePath)
  if (!base) {
    return path
  }
  if (path === base) {
    return ""
  }
  if (path.startsWith(`${base}/`)) {
    return path.slice(base.length + 1)
  }
  return null
}

export function trimPath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "").split("\\").join("/")
}

export function shouldSkipPath(relative: string) {
  return trimPath(relative)
    .split("/")
    .some((part) => skipName(part) || part === ".." || part === ".")
}

export function planSync(input: {
  local: Map<string, LocalFile>
  remote: Map<string, RemoteFile>
  snapshot: Map<string, SnapshotFile>
  remove: boolean
}): SyncAction[] {
  const paths = new Set<string>([
    ...input.local.keys(),
    ...input.remote.keys(),
    ...input.snapshot.keys(),
  ])
  const actions: SyncAction[] = []
  for (const path of [...paths].sort()) {
    if (shouldSkipPath(path) || !path) {
      continue
    }
    const local = input.local.get(path)
    const remote = input.remote.get(path)
    const snap = input.snapshot.get(path)

    if (local && !remote) {
      if (!snap) {
        actions.push({ type: "push", path, reason: "new" })
      } else if (input.remove) {
        actions.push({ type: "delete-local", path })
      }
      continue
    }

    if (remote && !local) {
      if (!snap) {
        actions.push({ type: "pull", path, reason: "new" })
      } else if (input.remove) {
        actions.push({ type: "delete-remote", path })
      }
      continue
    }

    if (!local || !remote) {
      continue
    }

    const localChanged =
      !snap ||
      local.size !== snap.size ||
      Math.abs(local.mtimeMs - snap.mtimeMs) > MTIME_SLOP_MS
    const remoteChanged = !snap || remote.etag !== snap.etag

    if (!localChanged && !remoteChanged) {
      continue
    }
    if (localChanged && !remoteChanged) {
      actions.push({ type: "push", path, reason: "changed" })
      continue
    }
    if (remoteChanged && !localChanged) {
      actions.push({ type: "pull", path, reason: "changed" })
      continue
    }

    const remoteMs = Date.parse(remote.uploaded) || 0
    if (local.mtimeMs >= remoteMs) {
      actions.push({ type: "push", path, reason: "conflict" })
    } else {
      actions.push({ type: "pull", path, reason: "conflict" })
    }
  }
  return actions
}
