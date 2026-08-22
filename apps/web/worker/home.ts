const FILE_MAX = 200_000
const LIST_MAX = 80
export const UPLOAD_MAX = 10 * 1024 * 1024

export type GuyHome = {
  userId: string
  guyId: string
  name: string
  backstory: string
}

export type HomeListing = {
  path: string
  dirs: string[]
  files: Array<{ path: string; size: number }>
}

export type HomeText = {
  path: string
  binary: false
  content: string
  size: number
}

export type HomeBinary = {
  path: string
  binary: true
  size: number
  type: string
}

export type HomeRead = HomeText | HomeBinary | { error: string }

export function homeRoot(home: Pick<GuyHome, "userId" | "guyId">) {
  return `guys/${home.userId}/${home.guyId}/`
}

export function asGuyHome(row: {
  userId: string
  id: string
  name: string
  backstory: string
}): GuyHome {
  return {
    userId: row.userId,
    guyId: row.id,
    name: row.name,
    backstory: row.backstory,
  }
}

export async function ensureHome(bucket: R2Bucket, home: GuyHome) {
  const root = homeRoot(home)
  const identity = await bucket.head(`${root}identity.md`)
  if (!identity) {
    await seedHome(bucket, home)
    return
  }
  await ensureDefaults(bucket, home)
}

export async function seedHome(bucket: R2Bucket, home: GuyHome) {
  const root = homeRoot(home)
  await Promise.all([
    bucket.put(`${root}identity.md`, identityMarkdown(home)),
    bucket.put(`${root}hooks/on-message.md`, ON_MESSAGE_HOOK),
    bucket.put(`${root}hooks/on-idle.md`, ON_IDLE_HOOK),
    bucket.put(`${root}skills/files/SKILL.md`, FILES_SKILL),
    bucket.put(`${root}skills/bookkeeping/SKILL.md`, BOOKKEEPING_SKILL),
    bucket.put(
      `${root}mcp.json`,
      `${JSON.stringify({ servers: [] }, null, 2)}\n`
    ),
  ])
}

export async function syncIdentity(bucket: R2Bucket, home: GuyHome) {
  await bucket.put(`${homeRoot(home)}identity.md`, identityMarkdown(home))
}

export async function deleteHome(
  bucket: R2Bucket,
  home: Pick<GuyHome, "userId" | "guyId">
) {
  const root = homeRoot(home)
  let cursor: string | undefined
  for (let i = 0; i < 20; i += 1) {
    const listed = await bucket.list({ prefix: root, cursor, limit: 100 })
    await Promise.all(listed.objects.map((object) => bucket.delete(object.key)))
    if (!listed.truncated) {
      break
    }
    cursor = listed.cursor
  }
}

export async function listFiles(
  bucket: R2Bucket,
  home: GuyHome,
  path: string
): Promise<HomeListing> {
  const prefix = toKey(home, path, true)
  const listed = await bucket.list({
    prefix,
    delimiter: "/",
    limit: LIST_MAX,
  })
  const root = homeRoot(home)
  return {
    path: toPath(path),
    dirs: listed.delimitedPrefixes.map((dir) => dir.slice(root.length)),
    files: listed.objects.map((object) => ({
      path: object.key.slice(root.length),
      size: object.size,
    })),
  }
}

export async function listFilesDeep(
  bucket: R2Bucket,
  home: GuyHome,
  path: string
) {
  const prefix = toKey(home, path, true)
  const root = homeRoot(home)
  const files: Array<{ path: string; size: number }> = []
  let cursor: string | undefined
  for (let i = 0; i < 20; i += 1) {
    const listed = await bucket.list({ prefix, cursor, limit: 100 })
    for (const object of listed.objects) {
      files.push({
        path: object.key.slice(root.length),
        size: object.size,
      })
    }
    if (!listed.truncated) {
      break
    }
    cursor = listed.cursor
  }
  return { path: toPath(path), dirs: [] as string[], files }
}

export async function readFile(
  bucket: R2Bucket,
  home: GuyHome,
  path: string
): Promise<HomeRead> {
  const key = toKey(home, path, false)
  const object = await bucket.get(key)
  if (!object) {
    return { error: `Missing file: ${toPath(path)}` }
  }
  const type =
    object.httpMetadata?.contentType ?? guessContentType(toPath(path))
  if (!isTextFile(toPath(path), type)) {
    return {
      path: toPath(path),
      binary: true,
      size: object.size,
      type,
    }
  }
  const content = await object.text()
  return {
    path: toPath(path),
    binary: false,
    content,
    size: object.size,
  }
}

export async function getObject(bucket: R2Bucket, home: GuyHome, path: string) {
  return bucket.get(toKey(home, path, false))
}

export async function writeFile(
  bucket: R2Bucket,
  home: GuyHome,
  path: string,
  content: string
) {
  if (content.length > FILE_MAX) {
    return { error: `File too large. Max ${FILE_MAX} characters.` }
  }
  const key = toKey(home, path, false)
  await bucket.put(key, content, {
    httpMetadata: { contentType: guessContentType(toPath(path)) },
  })
  return { path: toPath(path), bytes: content.length }
}

export async function putBytes(
  bucket: R2Bucket,
  home: GuyHome,
  path: string,
  bytes: ArrayBuffer,
  contentType: string
) {
  if (bytes.byteLength > UPLOAD_MAX) {
    return { error: `File too large. Max ${UPLOAD_MAX} bytes.` }
  }
  const key = toKey(home, path, false)
  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType: contentType || guessContentType(toPath(path)),
    },
  })
  return { path: toPath(path), bytes: bytes.byteLength }
}

export async function deleteFile(bucket: R2Bucket, home: GuyHome, path: string) {
  const relative = toPath(path)
  if (!relative) {
    return { error: "Path is required" }
  }
  const key = toKey(home, path, false)
  await bucket.delete(key)
  return { path: relative, deleted: true }
}

export async function readHook(bucket: R2Bucket, home: GuyHome, name: string) {
  const object = await bucket.get(`${homeRoot(home)}hooks/${name}.md`)
  if (!object) {
    return ""
  }
  return object.text()
}

export async function listSkills(bucket: R2Bucket, home: GuyHome) {
  const listed = await bucket.list({
    prefix: `${homeRoot(home)}skills/`,
    delimiter: "/",
    limit: 40,
  })
  return listed.delimitedPrefixes.map((dir) => {
    const parts = dir.replace(/\/$/, "").split("/")
    return parts[parts.length - 1] ?? dir
  })
}

export async function readMcpConfig(bucket: R2Bucket, home: GuyHome) {
  const object = await bucket.get(`${homeRoot(home)}mcp.json`)
  if (!object) {
    return { servers: [] as Array<{ name: string; url: string }> }
  }
  try {
    const parsed: unknown = JSON.parse(await object.text())
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("servers" in parsed) ||
      !Array.isArray(parsed.servers)
    ) {
      return { servers: [] as Array<{ name: string; url: string }> }
    }
    const servers = parsed.servers.flatMap((row) => {
      if (
        typeof row !== "object" ||
        row === null ||
        !("name" in row) ||
        !("url" in row) ||
        typeof row.name !== "string" ||
        typeof row.url !== "string"
      ) {
        return []
      }
      return [{ name: row.name, url: row.url }]
    })
    return { servers }
  } catch {
    return { servers: [] as Array<{ name: string; url: string }> }
  }
}

export function parseSkillName(value: string) {
  const name = value.trim().toLowerCase()
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(name)) {
    return { error: "Skill name must be lowercase letters, numbers, dashes" }
  }
  return name
}

export function defaultSkillMarkdown(name: string) {
  return [
    "---",
    `name: ${name}`,
    "description: Use when this playbook applies.",
    "---",
    "",
    "",
  ].join("\n")
}

async function ensureDefaults(bucket: R2Bucket, home: GuyHome) {
  const root = homeRoot(home)
  const missing = [
    [`${root}hooks/on-idle.md`, ON_IDLE_HOOK],
    [`${root}skills/files/SKILL.md`, FILES_SKILL],
    [`${root}skills/bookkeeping/SKILL.md`, BOOKKEEPING_SKILL],
    [`${root}mcp.json`, `${JSON.stringify({ servers: [] }, null, 2)}\n`],
  ] as const
  await Promise.all(
    missing.map(async ([key, body]) => {
      const exists = await bucket.head(key)
      if (!exists) {
        await bucket.put(key, body)
      }
    })
  )
}

function identityMarkdown(home: GuyHome) {
  const who = home.backstory.trim()
    ? home.backstory.trim()
    : `A specific person named ${home.name}. Not a generic assistant.`
  return [`# ${home.name}`, "", who, ""].join("\n")
}

const FILES_SKILL = `---
name: files
description: Keep notes, lists, ledgers, and receipts in the home folder. Use when something should persist past this text.
---

Lasting facts go under files/ as markdown. Update the same file instead of starting a new one.

When someone asks for a breakdown, a list, or access to something, read the file first. If it does not exist, create it, then send the contents. Do not say you will send a file you did not write.
`

const BOOKKEEPING_SKILL = `---
name: bookkeeping
description: Track expenses, receipts, and simple books in files/. Use when money, invoices, receipts, or a breakdown of spend comes up.
---

Never invent numbers. Read files/ before you answer a money question.

Default ledger: files/expenses.md. One line per item, like:

- 2026-08-21 subway 50.00 meals

If they send a receipt, append it. If they ask what they spent, sum what is in the file and send that. If the file is missing, say so, then create it.

Store longer notes under files/books/. Prefer markdown or csv. Do not pretend you parsed a spreadsheet you could not read.
`

const ON_MESSAGE_HOOK = [
  "Before you reply, decide if this belongs in a file.",
  "Receipts, lists, credentials, notes, ledgers: write them under files/.",
  "If you would send something, write it first, then send the contents.",
  "Do not promise a file you did not write.",
  "",
].join("\n")

const ON_IDLE_HOOK = [
  "Only write if something is actually unfinished: a promised file, a ledger line, a breakdown.",
  "If the books are already current, send nothing.",
  "",
].join("\n")

export function toPath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "")
}

export function toKey(home: GuyHome, path: string, directory: boolean) {
  const relative = toPath(path)
  if (relative.split("/").some((part) => part === ".." || part === ".")) {
    throw new Error("Invalid path")
  }
  const root = homeRoot(home)
  if (!relative) {
    return root
  }
  return directory ? `${root}${relative}/` : `${root}${relative}`
}

function isTextFile(path: string, contentType: string) {
  if (contentType.startsWith("text/")) {
    return true
  }
  if (
    contentType === "application/json" ||
    contentType === "application/xml" ||
    contentType === "image/svg+xml"
  ) {
    return true
  }
  return /\.(md|txt|csv|json|xml|svg|ts|js|css|html|yml|yaml|toml)$/i.test(path)
}

function guessContentType(path: string) {
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
