import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { DEFAULT_ORIGIN, DEFAULT_PREFIX } from "./args"
import type { SnapshotFile } from "./sync"

export type Link = {
  guyId: string
  guyName: string
  dir: string
  path: string
}

export type Config = {
  origin: string
  token: string
  email: string
  links: Link[]
}

export type Snapshot = {
  guyId: string
  path: string
  files: Record<string, SnapshotFile>
}

export function configDir(home = homedir()) {
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) {
    return join(xdg, "j4ck")
  }
  return join(home, ".config", "j4ck")
}

export function configPath(home = homedir()) {
  return join(configDir(home), "config.json")
}

export function snapshotPath(guyId: string, home = homedir()) {
  return join(configDir(home), "state", `${guyId}.json`)
}

export async function loadConfig(home = homedir()): Promise<Config | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(configPath(home), "utf8"))
    if (!isConfig(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function saveConfig(config: Config, home = homedir()) {
  const path = configPath(home)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  await chmod(path, 0o600)
}

export async function clearConfig(home = homedir()) {
  const { unlink } = await import("node:fs/promises")
  await unlink(configPath(home)).catch(() => undefined)
}

export async function loadSnapshot(
  guyId: string,
  home = homedir()
): Promise<Snapshot> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(snapshotPath(guyId, home), "utf8")
    )
    if (!isSnapshot(parsed) || parsed.guyId !== guyId) {
      return { guyId, path: DEFAULT_PREFIX, files: {} }
    }
    return parsed
  } catch {
    return { guyId, path: DEFAULT_PREFIX, files: {} }
  }
}

export async function saveSnapshot(snapshot: Snapshot, home = homedir()) {
  const path = snapshotPath(snapshot.guyId, home)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`)
}

export function emptyConfig(origin = DEFAULT_ORIGIN): Config {
  return { origin, token: "", email: "", links: [] }
}

function isConfig(value: unknown): value is Config {
  if (!value || typeof value !== "object") {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.origin === "string" &&
    typeof row.token === "string" &&
    typeof row.email === "string" &&
    Array.isArray(row.links) &&
    row.links.every(isLink)
  )
}

function isLink(value: unknown): value is Link {
  if (!value || typeof value !== "object") {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.guyId === "string" &&
    typeof row.guyName === "string" &&
    typeof row.dir === "string" &&
    typeof row.path === "string"
  )
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.guyId === "string" &&
    typeof row.path === "string" &&
    typeof row.files === "object" &&
    row.files !== null
  )
}
