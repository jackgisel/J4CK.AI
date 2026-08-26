#!/usr/bin/env bun

import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  inspectRepoLayout,
  mapRepoPath,
  skillSlug,
} from "../worker/import-repo"

const BUCKET = "j4ck-ai"
const INDEX = ".sync.json"
const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

type Args = {
  guy: string
  dir: string
  pull: boolean
  local: boolean
  filesOnly: boolean
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args) {
    console.error(
      "Usage: bun run --filter web sync -- --guy <id> --dir ~/path/to/books [--pull] [--local] [--files-only]"
    )
    process.exit(1)
  }

  const dir = resolve(args.dir)
  const folder = await stat(dir).catch(() => null)
  if (!folder?.isDirectory()) {
    console.error(`Not a directory: ${dir}`)
    process.exit(1)
  }

  const userId = await lookupUserId(args.guy, args.local)
  const filesPrefix = `guys/${userId}/${args.guy}/files/`
  const homePrefix = `guys/${userId}/${args.guy}/`
  const remoteFlag = args.local ? "--local" : "--remote"

  if (args.pull) {
    const rels = await remoteRelPaths(filesPrefix, dir, remoteFlag)
    if (rels.length === 0) {
      console.log("Nothing to pull. Push once or upload in the cabinet first.")
      return
    }
    for (const rel of rels) {
      const dest = join(dir, rel)
      await mkdir(dirname(dest), { recursive: true })
      await wrangler([
        "r2",
        "object",
        "get",
        `${BUCKET}/${filesPrefix}${rel}`,
        "--file",
        dest,
        remoteFlag,
      ])
      console.log(`pull ${rel}`)
    }
    return
  }

  const files = await walkFiles(dir)
  if (files.length === 0) {
    console.log("Local folder is empty.")
    return
  }

  const rels: string[] = []
  for (const file of files) {
    const rel = relative(dir, file).split("\\").join("/")
    if (rel === INDEX) {
      continue
    }
    rels.push(rel)
  }
  const layout = inspectRepoLayout(rels)
  const asRepo =
    !args.filesOnly &&
    (layout.hasSkillsDir ||
      layout.hasCursorSkills ||
      layout.hasRootSkill ||
      rels.some((rel) => rel === "identity.md" || rel.startsWith("hooks/")))
  const repoSlug = skillSlug(basename(dir)) ?? "project"

  const pushed: string[] = []
  for (const rel of rels) {
    const mapped = asRepo ? mapRepoPath(rel, layout, repoSlug) : `files/${rel}`
    if (typeof mapped !== "string") {
      continue
    }
    const file = join(dir, rel)
    await wrangler([
      "r2",
      "object",
      "put",
      `${BUCKET}/${homePrefix}${mapped}`,
      "--file",
      file,
      "--content-type",
      contentType(rel),
      remoteFlag,
    ])
    pushed.push(asRepo ? mapped : rel)
    console.log(`push ${mapped}`)
  }

  if (asRepo) {
    return
  }

  const known = new Set(await readIndex(filesPrefix, remoteFlag))
  for (const rel of pushed) {
    known.add(rel)
  }
  const indexPath = join(await mkdtemp(join(tmpdir(), "guy-sync-")), INDEX)
  await writeFile(
    indexPath,
    `${JSON.stringify({ files: [...known].sort() }, null, 2)}\n`
  )
  await wrangler([
    "r2",
    "object",
    "put",
    `${BUCKET}/${filesPrefix}${INDEX}`,
    "--file",
    indexPath,
    "--content-type",
    "application/json",
    remoteFlag,
  ])
}

function parseArgs(argv: string[]): Args | null {
  const args: Args = {
    guy: "",
    dir: "",
    pull: false,
    local: false,
    filesOnly: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--pull") {
      args.pull = true
      continue
    }
    if (token === "--local") {
      args.local = true
      continue
    }
    if (token === "--files-only") {
      args.filesOnly = true
      continue
    }
    if (token === "--guy") {
      args.guy = argv[i + 1] ?? ""
      i += 1
      continue
    }
    if (token === "--dir") {
      args.dir = argv[i + 1] ?? ""
      i += 1
      continue
    }
  }
  if (!args.guy || !args.dir) {
    return null
  }
  return args
}

async function lookupUserId(guyId: string, local: boolean) {
  const remoteFlag = local ? "--local" : "--remote"
  const output = await wrangler(
    [
      "d1",
      "execute",
      "j4ck-ai",
      "--json",
      "--command",
      `SELECT user_id FROM guy WHERE id = '${escapeSql(guyId)}' LIMIT 1`,
      remoteFlag,
    ],
    true
  )
  const rows = d1Rows(JSON.parse(extractJson(output)))
  const userId = rows[0]?.user_id
  if (typeof userId !== "string" || !userId) {
    throw new Error(`No guy with id ${guyId}`)
  }
  return userId
}

async function remoteRelPaths(prefix: string, dir: string, remoteFlag: string) {
  const known = new Set(await readIndex(prefix, remoteFlag))
  for (const file of await walkFiles(dir)) {
    const rel = relative(dir, file).split("\\").join("/")
    if (rel !== INDEX) {
      known.add(rel)
    }
  }
  return [...known].sort()
}

async function readIndex(prefix: string, remoteFlag: string) {
  const dest = join(await mkdtemp(join(tmpdir(), "guy-sync-")), INDEX)
  try {
    await wrangler(
      [
        "r2",
        "object",
        "get",
        `${BUCKET}/${prefix}${INDEX}`,
        "--file",
        dest,
        remoteFlag,
      ],
      true
    )
    const parsed: unknown = JSON.parse(await readFile(dest, "utf8"))
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("files" in parsed) ||
      !Array.isArray(parsed.files)
    ) {
      return []
    }
    return parsed.files.filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
  } catch {
    return []
  }
}

function d1Rows(parsed: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(parsed)) {
    return []
  }
  const first = parsed[0]
  if (!first || typeof first !== "object" || !("results" in first)) {
    return []
  }
  const results = first.results
  if (!Array.isArray(results)) {
    return []
  }
  return results.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null
  )
}

async function walkFiles(root: string) {
  const out: string[] = []
  async function visit(path: string) {
    const entries = await readdir(path, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue
      }
      const next = join(path, entry.name)
      if (entry.isDirectory()) {
        await visit(next)
        continue
      }
      if (entry.isFile()) {
        out.push(next)
      }
    }
  }
  await visit(root)
  return out
}

function contentType(path: string) {
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
  return "application/octet-stream"
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''")
}

function extractJson(text: string) {
  const start = text.search(/[\[{]/)
  if (start < 0) {
    throw new Error("wrangler returned no JSON")
  }
  return text.slice(start)
}

async function wrangler(args: string[], capture = false) {
  const proc = Bun.spawn(["bunx", "wrangler", ...args], {
    cwd: WEB_ROOT,
    stdout: capture ? "pipe" : "inherit",
    stderr: capture ? "pipe" : "inherit",
  })
  const stdout = capture ? await new Response(proc.stdout).text() : ""
  const stderr = capture ? await new Response(proc.stderr).text() : ""
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(
      stderr.trim() || `wrangler ${args.join(" ")} failed (${code})`
    )
  }
  return stdout
}

await main()
