import {
  FILE_MAX,
  UPLOAD_MAX,
  guessContentType,
  isTextFile,
  putBytes,
  writeFile,
  type GuyHome,
} from "./home"

export const ORIGIN_PATH = "origin.json"
const IMPORT_MAX_FILES = 200
const TOKEN_MAX = 400

const IGNORE_DIRS = new Set([
  ".git",
  ".github",
  ".gitlab",
  "node_modules",
  "dist",
  "build",
  ".turbo",
  "coverage",
  ".wrangler",
  ".next",
  ".output",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
])

const IGNORE_FILES = new Set([
  ".ds_store",
  "thumbs.db",
  "package.json",
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
  "license",
  "license.md",
  ".gitignore",
  ".editorconfig",
  "origin.json",
  "wrangler.toml",
  "wrangler.jsonc",
])

export type GitHubTarget = {
  owner: string
  repo: string
  ref?: string
  subdir: string
}

export type RepoLayout = {
  hasSkillsDir: boolean
  hasCursorSkills: boolean
  hasFilesDir: boolean
  hasRootSkill: boolean
}

export type ImportOk = {
  url: string
  owner: string
  repo: string
  ref: string
  sha: string
  importedAt: string
  skills: string[]
  imported: Array<{ path: string; bytes: number }>
  skipped: Array<{ path: string; reason: string }>
}

export type ImportFail = { error: string }

export function parseGitHubUrl(value: string): GitHubTarget | ImportFail {
  const raw = value.trim()
  if (!raw) {
    return { error: "Repo URL is required" }
  }

  const ssh = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (ssh) {
    return { owner: ssh[1]!, repo: ssh[2]!, subdir: "" }
  }

  const short = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  if (short && !raw.includes("://")) {
    return { owner: short[1]!, repo: short[2]!, subdir: "" }
  }

  let parsed: URL
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`)
  } catch {
    return { error: "Use a GitHub URL (https://github.com/owner/repo)" }
  }

  if (!/^(www\.)?github\.com$/i.test(parsed.hostname)) {
    return { error: "Use a GitHub URL (https://github.com/owner/repo)" }
  }

  const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")
  const owner = parts[0]
  const repoPart = parts[1]
  if (!owner || !repoPart) {
    return { error: "Use a GitHub URL (https://github.com/owner/repo)" }
  }
  const repo = repoPart.replace(/\.git$/i, "")
  if (parts[2] === "tree" && parts[3]) {
    return {
      owner,
      repo,
      ref: parts[3],
      subdir: parts.slice(4).join("/"),
    }
  }
  return { owner, repo, subdir: "" }
}

export function inspectRepoLayout(paths: string[]): RepoLayout {
  let hasSkillsDir = false
  let hasCursorSkills = false
  let hasFilesDir = false
  let hasRootSkill = false
  for (const path of paths) {
    const relative = stripSlashes(path)
    if (relative === "SKILL.md" || relative.endsWith("/SKILL.md")) {
      if (relative === "SKILL.md") {
        hasRootSkill = true
      }
    }
    if (relative === "files" || relative.startsWith("files/")) {
      hasFilesDir = true
    }
    if (relative === "skills" || relative.startsWith("skills/")) {
      hasSkillsDir = true
    }
    if (
      relative.startsWith(".cursor/skills/") ||
      relative === ".cursor/skills"
    ) {
      hasCursorSkills = true
    }
    if (
      relative.startsWith(".agents/skills/") ||
      relative === ".agents/skills"
    ) {
      hasCursorSkills = true
    }
  }
  return { hasSkillsDir, hasCursorSkills, hasFilesDir, hasRootSkill }
}

export function mapRepoPath(
  path: string,
  layout: RepoLayout,
  repoSlug: string
): string | { skip: string } {
  const relative = stripSlashes(path)
  if (!relative) {
    return { skip: "empty path" }
  }
  if (ignoredPath(relative)) {
    return { skip: "ignored" }
  }

  const cursorSkill = stripPrefix(relative, ".cursor/skills/")
  if (cursorSkill) {
    return mapSkillPath(cursorSkill)
  }
  const agentSkill = stripPrefix(relative, ".agents/skills/")
  if (agentSkill) {
    return mapSkillPath(agentSkill)
  }
  const skill = stripPrefix(relative, "skills/")
  if (skill) {
    return mapSkillPath(skill)
  }

  if (relative === "hooks/on-message.md" || relative === "hooks/on-idle.md") {
    return relative
  }
  if (relative === "identity.md" || relative === "mcp.json") {
    return relative
  }
  if (relative === "AGENTS.md" || relative === "CLAUDE.md") {
    return `files/${relative}`
  }
  if (relative === ".cursorrules") {
    return "files/cursorrules.md"
  }

  const underFiles = stripPrefix(relative, "files/")
  if (underFiles) {
    return `files/${underFiles}`
  }

  const singleSkill =
    layout.hasRootSkill && !layout.hasSkillsDir && !layout.hasCursorSkills
  if (singleSkill) {
    const dest = mapSkillPath(`${repoSlug}/${relative}`)
    return dest
  }

  if (!layout.hasFilesDir) {
    return `files/${relative}`
  }

  return { skip: "outside skills and files" }
}

export function skillSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(slug)) {
    return null
  }
  return slug
}

export function parseRepoToken(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return ""
  }
  if (typeof value !== "string") {
    return { error: "Token must be text" }
  }
  if (value.length > TOKEN_MAX) {
    return { error: "Token is too long" }
  }
  return value.trim()
}

export async function importGitHubRepo(
  bucket: R2Bucket,
  home: GuyHome,
  input: { url: string; ref?: string; token?: string },
  fetchImpl: typeof fetch = fetch
): Promise<ImportOk | ImportFail> {
  const target = parseGitHubUrl(input.url)
  if ("error" in target) {
    return target
  }
  const token =
    typeof input.token === "string" ? parseRepoToken(input.token) : ""
  if (typeof token !== "string") {
    return token
  }

  const headers = githubHeaders(token)
  const repoUrl = `https://api.github.com/repos/${target.owner}/${target.repo}`
  const repoRes = await fetchImpl(repoUrl, { headers })
  if (repoRes.status === 404) {
    return {
      error: token
        ? "Repo not found"
        : "Repo not found or private. Paste a token for private repos.",
    }
  }
  if (repoRes.status === 401 || repoRes.status === 403) {
    return { error: await githubError(repoRes, "GitHub refused that request") }
  }
  if (!repoRes.ok) {
    return { error: await githubError(repoRes, "Could not read the repo") }
  }

  const repoBody = (await repoRes.json()) as {
    default_branch?: string
    html_url?: string
  }
  const ref =
    input.ref?.trim() || target.ref || repoBody.default_branch || "main"
  const treeRes = await fetchImpl(
    `${repoUrl}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers }
  )
  if (treeRes.status === 404) {
    return { error: `No tree at ${ref}` }
  }
  if (!treeRes.ok) {
    return { error: await githubError(treeRes, "Could not list the repo") }
  }

  const treeBody = (await treeRes.json()) as {
    sha?: string
    truncated?: boolean
    tree?: Array<{
      path?: string
      type?: string
      sha?: string
      size?: number
      mode?: string
    }>
  }
  if (treeBody.truncated) {
    return { error: "Repo is too large to import. Point at a smaller tree." }
  }

  const prefix = target.subdir ? `${stripSlashes(target.subdir)}/` : ""
  const blobs = (treeBody.tree ?? []).flatMap((entry) => {
    if (entry.type !== "blob" || !entry.path || !entry.sha) {
      return []
    }
    if (entry.mode === "120000") {
      return []
    }
    if (prefix && !entry.path.startsWith(prefix)) {
      return []
    }
    const relative = prefix ? entry.path.slice(prefix.length) : entry.path
    if (!relative) {
      return []
    }
    return [
      {
        path: relative,
        sha: entry.sha,
        size: typeof entry.size === "number" ? entry.size : 0,
      },
    ]
  })

  const layout = inspectRepoLayout(blobs.map((row) => row.path))
  const repoSlug = skillSlug(target.repo) ?? "project"
  const planned: Array<{
    source: string
    dest: string
    sha: string
    size: number
  }> = []
  const skipped: Array<{ path: string; reason: string }> = []

  for (const blob of blobs) {
    const mapped = mapRepoPath(blob.path, layout, repoSlug)
    if (typeof mapped !== "string") {
      if (mapped.skip !== "ignored") {
        skipped.push({ path: blob.path, reason: mapped.skip })
      }
      continue
    }
    if (blob.size > UPLOAD_MAX) {
      skipped.push({ path: blob.path, reason: "too large" })
      continue
    }
    planned.push({
      source: blob.path,
      dest: mapped,
      sha: blob.sha,
      size: blob.size,
    })
  }

  if (planned.length === 0) {
    return {
      error:
        "No skills or files found. Expected skills/*/SKILL.md, .cursor/skills, or files/.",
    }
  }

  const capped = planned.slice(0, IMPORT_MAX_FILES)
  for (const extra of planned.slice(IMPORT_MAX_FILES)) {
    skipped.push({ path: extra.source, reason: "import cap" })
  }

  const imported: Array<{ path: string; bytes: number }> = []
  for (const batch of chunk(capped, 8)) {
    const written = await Promise.all(
      batch.map(async (row) => {
        const blobRes = await fetchImpl(`${repoUrl}/git/blobs/${row.sha}`, {
          headers,
        })
        if (!blobRes.ok) {
          return {
            skip: true as const,
            path: row.source,
            reason: "could not fetch",
          }
        }
        const blob = (await blobRes.json()) as {
          content?: string
          encoding?: string
        }
        if (!blob.content || blob.encoding !== "base64") {
          return { skip: true as const, path: row.source, reason: "bad blob" }
        }
        const bytes = decodeBase64(blob.content)
        const type = guessContentType(row.dest)
        if (isTextFile(row.dest, type)) {
          const content = new TextDecoder("utf-8", { fatal: false }).decode(
            bytes
          )
          if (content.length > FILE_MAX) {
            return {
              skip: true as const,
              path: row.source,
              reason: "too large",
            }
          }
          const result = await writeFile(bucket, home, row.dest, content)
          if ("error" in result) {
            return {
              skip: true as const,
              path: row.source,
              reason: result.error,
            }
          }
          return {
            skip: false as const,
            path: result.path,
            bytes: result.bytes,
          }
        }
        const result = await putBytes(
          bucket,
          home,
          row.dest,
          toArrayBuffer(bytes),
          type
        )
        if ("error" in result) {
          return { skip: true as const, path: row.source, reason: result.error }
        }
        return { skip: false as const, path: result.path, bytes: result.bytes }
      })
    )
    for (const row of written) {
      if (row.skip) {
        skipped.push({ path: row.path, reason: row.reason })
      } else {
        imported.push({ path: row.path, bytes: row.bytes })
      }
    }
  }

  if (imported.length === 0) {
    return { error: "Could not copy any files from the repo" }
  }

  const skills = [
    ...new Set(
      imported.flatMap((row) => {
        const match = /^skills\/([^/]+)/.exec(row.path)
        return match?.[1] ? [match[1]] : []
      })
    ),
  ].sort()
  const cabinetFiles = imported.filter((row) =>
    row.path.startsWith("files/")
  ).length
  const origin: ImportOk = {
    url:
      repoBody.html_url ?? `https://github.com/${target.owner}/${target.repo}`,
    owner: target.owner,
    repo: target.repo,
    ref,
    sha: treeBody.sha ?? ref,
    importedAt: new Date().toISOString(),
    skills,
    imported,
    skipped,
  }
  await writeFile(
    bucket,
    home,
    ORIGIN_PATH,
    `${JSON.stringify(
      {
        url: origin.url,
        owner: origin.owner,
        repo: origin.repo,
        ref: origin.ref,
        sha: origin.sha,
        importedAt: origin.importedAt,
        skills: origin.skills,
        files: cabinetFiles,
        skipped: origin.skipped.length,
      },
      null,
      2
    )}\n`
  )
  return origin
}

export function backstoryFromIdentity(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  let start = 0
  if (lines[0]?.startsWith("# ")) {
    start = 1
  }
  while (start < lines.length && lines[start]?.trim() === "") {
    start += 1
  }
  return lines.slice(start).join("\n").trim()
}

function mapSkillPath(relative: string) {
  const [name, ...rest] = stripSlashes(relative).split("/")
  const slug = name ? skillSlug(name) : null
  if (!slug) {
    return { skip: "invalid skill name" }
  }
  if (rest.length === 0) {
    return { skip: "skill folder" }
  }
  return `skills/${slug}/${rest.join("/")}`
}

function ignoredPath(path: string) {
  const parts = path.split("/")
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? ""
    if (IGNORE_DIRS.has(part)) {
      return true
    }
    if (part === ".cursor" || part === ".agents") {
      const next = parts[i + 1]
      if (next !== "skills") {
        return true
      }
    } else if (part.startsWith(".") && part !== ".cursorrules") {
      return true
    }
  }
  const leaf = (parts[parts.length - 1] ?? "").toLowerCase()
  if (IGNORE_FILES.has(leaf)) {
    return true
  }
  if (/^tsconfig(\..+)?\.json$/.test(leaf)) {
    return true
  }
  if (/^vite\.config\./.test(leaf)) {
    return true
  }
  return false
}

function stripPrefix(path: string, prefix: string) {
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length)
  }
  return null
}

function stripSlashes(path: string) {
  return path.replace(/^\/+|\/+$/g, "")
}

function githubHeaders(token: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "j4ck.ai",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function githubError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string }
    if (typeof body.message === "string" && body.message.trim()) {
      if (/rate limit/i.test(body.message)) {
        return "GitHub rate limit. Add a token or wait, then try again."
      }
      return body.message
    }
  } catch {
    // keep fallback
  }
  return fallback
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function decodeBase64(content: string) {
  const binary = atob(content.replaceAll("\n", ""))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}
