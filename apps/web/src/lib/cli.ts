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
    throw new Error(errorMessage(data, response.status))
  }
  return data as T
}

function errorMessage(data: unknown, status: number) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error
  }
  if (status === 410) {
    return "That link expired. Run j4ck login again."
  }
  return "Request failed"
}

export type DeviceStatus = {
  status: "pending" | "expired" | "approved"
  hostname?: string
}

export type CliTokenRow = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export type CreatedCliToken = CliTokenRow & { token: string }

export async function getDevice(id: string) {
  return api<DeviceStatus>(`/api/cli/device/${id}`)
}

export async function approveDevice(id: string, name?: string) {
  return api<{ status: "approved"; hostname: string; name?: string }>(
    `/api/cli/device/${id}/approve`,
    {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    }
  )
}

export async function listCliTokens() {
  const data = await api<{ tokens: CliTokenRow[] }>("/api/cli/tokens")
  return data.tokens
}

export async function createCliToken(name: string) {
  return api<CreatedCliToken>("/api/cli/tokens", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function deleteCliToken(id: string) {
  await api<void>(`/api/cli/tokens/${id}`, { method: "DELETE" })
}
