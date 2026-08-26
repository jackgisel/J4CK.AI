import { and, asc, desc, eq, gte, inArray } from "drizzle-orm"
import { Hono, type Context } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { guy, message } from "./db/schema"
import {
  asGuyHome,
  defaultSkillMarkdown,
  deleteFile,
  deleteHome,
  ensureHome,
  getObject,
  listFiles,
  listFilesDeep,
  parseSkillName,
  putBytes,
  readFile,
  seedHome,
  syncIdentity,
  toPath,
  UPLOAD_MAX,
  writeFile,
} from "./home"
import { runGuyTurn } from "./agent"
import {
  backstoryFromIdentity,
  importGitHubRepo,
  parseRepoToken,
  type ImportFail,
  type ImportOk,
} from "./import-repo"
import { serializeMessage } from "./turn"

type AppEnv = {
  Bindings: Env
  Variables: { userId: string; userName: string }
}

const NAME_MAX = 80
const BACKSTORY_MAX = 8000
const BODY_MAX = 4000
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const AVATAR_EYES = [
  "dots",
  "wide",
  "sleepy",
  "angry",
  "squint",
  "glasses",
] as const
const AVATAR_FACIAL_HAIR = [
  "none",
  "stubble",
  "mustache",
  "beard",
  "goatee",
] as const
const AVATAR_HATS = [
  "none",
  "cap",
  "beanie",
  "hardhat",
  "tophat",
  "cowboy",
] as const

export const guys = new Hono<AppEnv>()

guys.use("*", async (c, next) => {
  const session = await createAuth(c.env, c.req.raw).api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  c.set("userId", session.user.id)
  c.set("userName", session.user.name)
  await next()
})

guys.get("/", async (c) => {
  const db = createDb(c.env.DB)
  const userId = c.get("userId")
  const rows = await db
    .select()
    .from(guy)
    .where(eq(guy.userId, userId))
    .orderBy(desc(guy.createdAt))

  const lastByGuy = new Map<string, typeof message.$inferSelect>()
  const ids = rows.map((row) => row.id)
  if (ids.length > 0) {
    const messages = await db
      .select()
      .from(message)
      .where(inArray(message.guyId, ids))
      .orderBy(desc(message.createdAt))

    for (const row of messages) {
      if (!lastByGuy.has(row.guyId)) {
        lastByGuy.set(row.guyId, row)
      }
    }
  }

  return c.json({
    guys: rows.map((row) => serializeGuy(row, lastByGuy.get(row.id) ?? null)),
  })
})

guys.get("/stats", async (c) => {
  const db = createDb(c.env.DB)
  const userId = c.get("userId")
  const now = new Date()
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  const days = 90
  const startMs = todayUtc - (days - 1) * 86_400_000
  const start = new Date(startMs)

  const series: Array<{ date: string; sent: number; received: number }> = []
  const index = new Map<
    string,
    { date: string; sent: number; received: number }
  >()
  for (let i = 0; i < days; i++) {
    const date = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10)
    const point = { date, sent: 0, received: 0 }
    series.push(point)
    index.set(date, point)
  }

  const owned = await db
    .select({ id: guy.id })
    .from(guy)
    .where(eq(guy.userId, userId))
  const ids = owned.map((row) => row.id)
  if (ids.length === 0) {
    return c.json({ series })
  }

  const rows = await db
    .select({
      role: message.role,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(and(inArray(message.guyId, ids), gte(message.createdAt, start)))

  for (const row of rows) {
    const date = row.createdAt.toISOString().slice(0, 10)
    const point = index.get(date)
    if (!point) {
      continue
    }
    if (row.role === "user") {
      point.sent += 1
    } else {
      point.received += 1
    }
  }

  return c.json({ series })
})

guys.post("/", async (c) => {
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const name = parseName(body.name)
  if (typeof name !== "string") {
    return c.json({ error: name.error }, 400)
  }

  const color = parseColor(body.color)
  if (typeof color !== "string") {
    return c.json({ error: color.error }, 400)
  }

  const backstory = parseBackstory(body.backstory ?? "")
  if (typeof backstory !== "string") {
    return c.json({ error: backstory.error }, 400)
  }

  const avatarEyes = parseTrait(body.avatarEyes, AVATAR_EYES, "dots", "eyes")
  if (typeof avatarEyes !== "string") {
    return c.json({ error: avatarEyes.error }, 400)
  }

  const avatarFacialHair = parseTrait(
    body.avatarFacialHair,
    AVATAR_FACIAL_HAIR,
    "none",
    "facial hair"
  )
  if (typeof avatarFacialHair !== "string") {
    return c.json({ error: avatarFacialHair.error }, 400)
  }

  const avatarHat = parseTrait(body.avatarHat, AVATAR_HATS, "none", "hat")
  if (typeof avatarHat !== "string") {
    return c.json({ error: avatarHat.error }, 400)
  }

  const now = new Date()
  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(guy)
    .values({
      id: crypto.randomUUID(),
      userId: c.get("userId"),
      name,
      color,
      backstory,
      avatarEyes,
      avatarFacialHair,
      avatarHat,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not save" }, 500)
  }

  await seedHome(c.env.BUCKET, asGuyHome(created))
  const trained = await trainFromRepo(c.env, created, body)

  return c.json(
    { guy: serializeGuy(trained.guy, null), imported: trained.imported },
    201
  )
})

guys.get("/:id", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  await ensureHome(c.env.BUCKET, asGuyHome(row))
  return c.json({ guy: serializeGuy(row, null) })
})

guys.patch("/:id", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const patch: {
    name?: string
    color?: string
    backstory?: string
    avatarEyes?: string
    avatarFacialHair?: string
    avatarHat?: string
    updatedAt: Date
  } = { updatedAt: new Date() }

  if ("name" in body) {
    const name = parseName(body.name)
    if (typeof name !== "string") {
      return c.json({ error: name.error }, 400)
    }
    patch.name = name
  }

  if ("color" in body) {
    const color = parseColor(body.color)
    if (typeof color !== "string") {
      return c.json({ error: color.error }, 400)
    }
    patch.color = color
  }

  if ("backstory" in body) {
    const backstory = parseBackstory(body.backstory)
    if (typeof backstory !== "string") {
      return c.json({ error: backstory.error }, 400)
    }
    patch.backstory = backstory
  }

  if ("avatarEyes" in body) {
    const avatarEyes = parseTrait(body.avatarEyes, AVATAR_EYES, "dots", "eyes")
    if (typeof avatarEyes !== "string") {
      return c.json({ error: avatarEyes.error }, 400)
    }
    patch.avatarEyes = avatarEyes
  }

  if ("avatarFacialHair" in body) {
    const avatarFacialHair = parseTrait(
      body.avatarFacialHair,
      AVATAR_FACIAL_HAIR,
      "none",
      "facial hair"
    )
    if (typeof avatarFacialHair !== "string") {
      return c.json({ error: avatarFacialHair.error }, 400)
    }
    patch.avatarFacialHair = avatarFacialHair
  }

  if ("avatarHat" in body) {
    const avatarHat = parseTrait(body.avatarHat, AVATAR_HATS, "none", "hat")
    if (typeof avatarHat !== "string") {
      return c.json({ error: avatarHat.error }, 400)
    }
    patch.avatarHat = avatarHat
  }

  if (
    patch.name === undefined &&
    patch.color === undefined &&
    patch.backstory === undefined &&
    patch.avatarEyes === undefined &&
    patch.avatarFacialHair === undefined &&
    patch.avatarHat === undefined
  ) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const db = createDb(c.env.DB)
  const [updated] = await db
    .update(guy)
    .set(patch)
    .where(eq(guy.id, row.id))
    .returning()

  if (!updated) {
    return c.json({ error: "Could not save" }, 500)
  }

  if (patch.name !== undefined || patch.backstory !== undefined) {
    await syncIdentity(c.env.BUCKET, asGuyHome(updated))
  }

  return c.json({ guy: serializeGuy(updated, null) })
})

guys.delete("/:id", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const db = createDb(c.env.DB)
  await db.delete(guy).where(eq(guy.id, row.id))
  await deleteHome(c.env.BUCKET, { userId: row.userId, guyId: row.id })
  return c.body(null, 204)
})

guys.get("/:id/messages", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(message)
    .where(eq(message.guyId, row.id))
    .orderBy(asc(message.createdAt))

  return c.json({
    guy: serializeGuy(row, null),
    messages: rows.map(serializeMessage),
  })
})

guys.post("/:id/messages", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }

  const text = parseBody(body.body)
  if (typeof text !== "string") {
    return c.json({ error: text.error }, 400)
  }

  const db = createDb(c.env.DB)
  const [created] = await db
    .insert(message)
    .values({
      id: crypto.randomUUID(),
      guyId: row.id,
      role: "user",
      body: text,
      createdAt: new Date(),
    })
    .returning()

  if (!created) {
    return c.json({ error: "Could not send" }, 500)
  }

  const replies = await runGuyTurn(c.env, c.get("userName"), row)

  return c.json(
    {
      message: serializeMessage(created),
      replies,
    },
    201
  )
})

guys.get("/:id/home", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const home = asGuyHome(row)
  await ensureHome(c.env.BUCKET, home)
  try {
    const listing =
      c.req.query("deep") === "1"
        ? await listFilesDeep(c.env.BUCKET, home, c.req.query("path") ?? "")
        : await listFiles(c.env.BUCKET, home, c.req.query("path") ?? "")
    return c.json(listing)
  } catch {
    return c.json({ error: "Invalid path" }, 400)
  }
})

guys.get("/:id/home/file", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const home = asGuyHome(row)
  await ensureHome(c.env.BUCKET, home)
  const path = c.req.query("path") ?? ""
  if (!toPath(path)) {
    return c.json({ error: "Path is required" }, 400)
  }
  const download = c.req.query("download") === "1"
  try {
    if (download) {
      const object = await getObject(c.env.BUCKET, home, path)
      if (!object) {
        return c.json({ error: "Not found" }, 404)
      }
      const name = toPath(path).split("/").pop() ?? "file"
      return new Response(object.body, {
        headers: {
          "content-type":
            object.httpMetadata?.contentType ?? "application/octet-stream",
          "content-disposition": `attachment; filename="${name}"`,
        },
      })
    }
    const file = await readFile(c.env.BUCKET, home, path)
    if ("error" in file) {
      return c.json(file, 404)
    }
    return c.json(file)
  } catch {
    return c.json({ error: "Invalid path" }, 400)
  }
})

guys.put("/:id/home/file", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const home = asGuyHome(row)
  await ensureHome(c.env.BUCKET, home)
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }
  const path = typeof body.path === "string" ? body.path : ""
  const content = typeof body.content === "string" ? body.content : ""
  if (!toPath(path)) {
    return c.json({ error: "Path is required" }, 400)
  }
  try {
    const written = await writeFile(c.env.BUCKET, home, path, content)
    if ("error" in written) {
      return c.json(written, 400)
    }
    return c.json(written)
  } catch {
    return c.json({ error: "Invalid path" }, 400)
  }
})

guys.post("/:id/home/upload", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const home = asGuyHome(row)
  await ensureHome(c.env.BUCKET, home)
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: "Expected multipart form" }, 400)
  }
  const folder = toPath(String(form.get("folder") ?? "files"))
  const file = form.get("file")
  if (!(file instanceof File)) {
    return c.json({ error: "File is required" }, 400)
  }
  if (file.size > UPLOAD_MAX) {
    return c.json({ error: "File too large. Max 10 MB." }, 400)
  }
  const name = file.name.replace(/[/\\]/g, "").trim()
  if (!name) {
    return c.json({ error: "File name is required" }, 400)
  }
  const path = folder ? `${folder}/${name}` : name
  try {
    const written = await putBytes(
      c.env.BUCKET,
      home,
      path,
      await file.arrayBuffer(),
      file.type
    )
    if ("error" in written) {
      return c.json(written, 400)
    }
    return c.json(written)
  } catch {
    return c.json({ error: "Invalid path" }, 400)
  }
})

guys.delete("/:id/home/file", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const home = asGuyHome(row)
  const path = c.req.query("path") ?? ""
  if (!toPath(path)) {
    return c.json({ error: "Path is required" }, 400)
  }
  try {
    return c.json(await deleteFile(c.env.BUCKET, home, path))
  } catch {
    return c.json({ error: "Invalid path" }, 400)
  }
})

guys.post("/:id/home/import", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  await ensureHome(c.env.BUCKET, asGuyHome(row))
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }
  const trained = await trainFromRepo(c.env, row, body)
  if (!trained.imported) {
    return c.json({ error: "Repo URL is required" }, 400)
  }
  if ("error" in trained.imported) {
    return c.json({ error: trained.imported.error }, 400)
  }
  return c.json({
    guy: serializeGuy(trained.guy, null),
    imported: trained.imported,
  })
})

guys.post("/:id/home/skills", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }
  const home = asGuyHome(row)
  await ensureHome(c.env.BUCKET, home)
  const body = await readObject(c)
  if (!body) {
    return c.json({ error: "Expected JSON" }, 400)
  }
  const parsed = parseSkillName(typeof body.name === "string" ? body.name : "")
  if (typeof parsed !== "string") {
    return c.json(parsed, 400)
  }
  const content =
    typeof body.content === "string" && body.content.trim()
      ? body.content
      : defaultSkillMarkdown(parsed)
  try {
    const written = await writeFile(
      c.env.BUCKET,
      home,
      `skills/${parsed}/SKILL.md`,
      content
    )
    if ("error" in written) {
      return c.json(written, 400)
    }
    return c.json({ ...written, name: parsed })
  } catch {
    return c.json({ error: "Invalid path" }, 400)
  }
})

guys.post("/:id/reply", async (c) => {
  const row = await findOwnedGuy(c)
  if (!row) {
    return c.json({ error: "Not found" }, 404)
  }

  const replies = await runGuyTurn(c.env, c.get("userName"), row)
  return c.json({ replies })
})

async function findOwnedGuy(c: Context<AppEnv>) {
  const id = c.req.param("id")
  if (!id) {
    return null
  }

  const db = createDb(c.env.DB)
  const [row] = await db
    .select()
    .from(guy)
    .where(and(eq(guy.id, id), eq(guy.userId, c.get("userId"))))
    .limit(1)

  return row ?? null
}

async function readObject(c: {
  req: { json: () => Promise<unknown> }
}): Promise<Record<string, unknown> | null> {
  try {
    const value = await c.req.json()
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function parseName(value: unknown) {
  if (typeof value !== "string") {
    return { error: "Name is required" }
  }
  const name = value.trim()
  if (!name) {
    return { error: "Name is required" }
  }
  if (name.length > NAME_MAX) {
    return { error: `Name must be ${NAME_MAX} characters or fewer` }
  }
  return name
}

function parseColor(value: unknown) {
  if (typeof value !== "string" || !COLOR_RE.test(value)) {
    return { error: "Color must be a hex value like #0f766e" }
  }
  return value.toLowerCase()
}

function parseBackstory(value: unknown) {
  if (value === undefined || value === null) {
    return ""
  }
  if (typeof value !== "string") {
    return { error: "Backstory must be text" }
  }
  if (value.length > BACKSTORY_MAX) {
    return { error: `Backstory must be ${BACKSTORY_MAX} characters or fewer` }
  }
  return value
}

function parseTrait<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string
) {
  if (value === undefined || value === null || value === "") {
    return fallback
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return { error: `Unknown ${label}` }
  }
  return value as T
}

function parseBody(value: unknown) {
  if (typeof value !== "string") {
    return { error: "Message is required" }
  }
  const body = value.trim()
  if (!body) {
    return { error: "Message is required" }
  }
  if (body.length > BODY_MAX) {
    return { error: `Message must be ${BODY_MAX} characters or fewer` }
  }
  return body
}

async function trainFromRepo(
  env: Env,
  row: typeof guy.$inferSelect,
  body: Record<string, unknown>
): Promise<{
  imported: ImportOk | ImportFail | null
  guy: typeof guy.$inferSelect
}> {
  const url = typeof body.repoUrl === "string" ? body.repoUrl.trim() : ""
  if (!url) {
    return { imported: null, guy: row }
  }
  const token = parseRepoToken(body.repoToken)
  if (typeof token !== "string") {
    return { imported: token, guy: row }
  }
  const ref = typeof body.repoRef === "string" ? body.repoRef.trim() : ""
  const home = asGuyHome(row)
  const imported = await importGitHubRepo(env.BUCKET, home, {
    url,
    ref: ref || undefined,
    token,
  })
  if ("error" in imported) {
    return { imported, guy: row }
  }
  if (row.backstory.trim()) {
    await syncIdentity(env.BUCKET, home)
    return { imported, guy: row }
  }
  const identity = await readFile(env.BUCKET, home, "identity.md")
  if ("error" in identity || identity.binary) {
    return { imported, guy: row }
  }
  const backstory = backstoryFromIdentity(identity.content)
  if (!backstory || backstory.length > BACKSTORY_MAX) {
    return { imported, guy: row }
  }
  const db = createDb(env.DB)
  const [updated] = await db
    .update(guy)
    .set({ backstory, updatedAt: new Date() })
    .where(eq(guy.id, row.id))
    .returning()
  return { imported, guy: updated ?? row }
}

function serializeGuy(
  row: typeof guy.$inferSelect,
  last: typeof message.$inferSelect | null
) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    backstory: row.backstory,
    avatarEyes: row.avatarEyes,
    avatarFacialHair: row.avatarFacialHair,
    avatarHat: row.avatarHat,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessage: last ? serializeMessage(last) : null,
  }
}
