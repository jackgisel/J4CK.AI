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
  createdAt: string
  updatedAt: string
  lastMessage: Message | null
}

export type GuyInput = {
  name: string
  color: string
  backstory: string
}

export function guyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return "?"
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
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

export async function listGuys() {
  const data = await api<{ guys: Guy[] }>("/api/guys")
  return data.guys
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
  const data = await api<{ message: Message }>(`/api/guys/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
  return data.message
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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
