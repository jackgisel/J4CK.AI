import type { AvatarEyes, AvatarFacialHair, AvatarHat } from "@/lib/avatar"

export const GUY_COLORS = [
  "#0f766e",
  "#1c1917",
  "#9f1239",
  "#1e3a5f",
  "#3f6212",
  "#9a3412",
  "#44403c",
  "#0e7490",
] as const

export type GuyColor = (typeof GUY_COLORS)[number]

export type Message = {
  id: string
  guyId: string
  role: "user" | "assistant"
  body: string
  createdAt: string
}

export type Guy = {
  id: string
  name: string
  color: string
  backstory: string
  avatarEyes: AvatarEyes
  avatarFacialHair: AvatarFacialHair
  avatarHat: AvatarHat
  createdAt: string
  updatedAt: string
  lastMessage: Message | null
}

export type GuyInput = {
  name: string
  color: string
  backstory: string
  avatarEyes: AvatarEyes
  avatarFacialHair: AvatarFacialHair
  avatarHat: AvatarHat
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export type GuyDayStat = {
  date: string
  sent: number
  received: number
}

export type GuyStats = {
  series: GuyDayStat[]
}

export async function listGuys() {
  const data = await api<{ guys: Guy[] }>("/api/guys")
  return data.guys
}

export async function getGuyStats() {
  return api<GuyStats>("/api/guys/stats")
}

export async function getGuy(id: string) {
  const data = await api<{ guy: Guy }>(`/api/guys/${id}`)
  return data.guy
}

export async function createGuy(input: GuyInput) {
  const data = await api<{ guy: Guy }>("/api/guys", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return data.guy
}

export async function updateGuy(id: string, input: Partial<GuyInput>) {
  const data = await api<{ guy: Guy }>(`/api/guys/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return data.guy
}

export async function deleteGuy(id: string) {
  await api<void>(`/api/guys/${id}`, { method: "DELETE" })
}

export async function listMessages(id: string) {
  return api<{ guy: Guy; messages: Message[] }>(`/api/guys/${id}/messages`)
}

export async function sendMessage(id: string, body: string) {
  const data = await api<{ message: Message; replies: Message[] }>(
    `/api/guys/${id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  )
  return data
}

export function shouldCatchUp(last: Message | undefined) {
  if (!last) {
    return false
  }
  if (last.role === "user") {
    return true
  }
  const text = last.body.trim()
  if (!text || text.length > 280) {
    return false
  }
  return /\b((i['’]?ll|i will|i['’]?m (gonna|going to)) (send|get|check|look|pull|grab|forward|add|do)|let me|hang on|one sec|give me a|on it|checking|coming)\b/i.test(
    text
  )
}

export async function catchUp(id: string) {
  const data = await api<{ replies: Message[] }>(`/api/guys/${id}/reply`, {
    method: "POST",
  })
  return data.replies
}

export type HomeListing = {
  path: string
  dirs: string[]
  files: Array<{ path: string; size: number; etag?: string; uploaded?: string }>
}

export type HomeTextFile = {
  path: string
  binary: false
  content: string
  size: number
}

export type HomeBinaryFile = {
  path: string
  binary: true
  size: number
  type: string
}

export type HomeFile = HomeTextFile | HomeBinaryFile

export async function listHome(id: string, path = "") {
  const query = new URLSearchParams()
  if (path) {
    query.set("path", path)
  }
  const suffix = query.toString() ? `?${query}` : ""
  return api<HomeListing>(`/api/guys/${id}/home${suffix}`)
}

export async function readHomeFile(id: string, path: string) {
  const query = new URLSearchParams({ path })
  return api<HomeFile>(`/api/guys/${id}/home/file?${query}`)
}

export async function writeHomeFile(id: string, path: string, content: string) {
  return api<{ path: string; bytes: number }>(`/api/guys/${id}/home/file`, {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  })
}

export async function uploadHomeFile(id: string, folder: string, file: File) {
  const form = new FormData()
  form.set("folder", folder)
  form.set("file", file)
  return api<{ path: string; bytes: number }>(`/api/guys/${id}/home/upload`, {
    method: "POST",
    body: form,
  })
}

export async function deleteHomeFile(id: string, path: string) {
  const query = new URLSearchParams({ path })
  return api<{ path: string; deleted: boolean }>(
    `/api/guys/${id}/home/file?${query}`,
    { method: "DELETE" }
  )
}

export async function createHomeSkill(
  id: string,
  name: string,
  content?: string
) {
  return api<{ path: string; bytes: number; name: string }>(
    `/api/guys/${id}/home/skills`,
    {
      method: "POST",
      body: JSON.stringify({ name, content }),
    }
  )
}

export async function downloadHomeFile(id: string, path: string) {
  const query = new URLSearchParams({ path, download: "1" })
  const response = await fetch(`/api/guys/${id}/home/file?${query}`)
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    throw new Error(errorMessage(data))
  }
  const blob = await response.blob()
  const name = path.split("/").pop() ?? "file"
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(typeof init?.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorMessage(data))
  }
  return data as T
}

function errorMessage(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error
  }
  return "Request failed"
}
