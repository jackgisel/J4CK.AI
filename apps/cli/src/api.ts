export type Guy = {
  id: string
  name: string
}

export type HomeFile = {
  path: string
  size: number
  etag: string
  uploaded: string
}

export type Written = {
  path: string
  bytes: number
  etag: string
  uploaded: string
}

export class SiteError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "SiteError"
    this.status = status
  }
}

export class Site {
  origin: string
  token: string

  constructor(origin: string, token: string) {
    this.origin = origin
    this.token = token
  }

  async me() {
    return this.json<{ id: string; name: string; email: string }>("/api/cli/me")
  }

  async guys() {
    const data = await this.json<{ guys: Guy[] }>("/api/guys")
    return data.guys
  }

  async listHome(guyId: string, path: string) {
    const query = new URLSearchParams({ deep: "1" })
    if (path) {
      query.set("path", path)
    }
    const data = await this.json<{ files: HomeFile[] }>(
      `/api/guys/${guyId}/home?${query}`
    )
    return data.files
  }

  async download(guyId: string, path: string) {
    const query = new URLSearchParams({ path, download: "1" })
    const response = await this.fetch(`/api/guys/${guyId}/home/file?${query}`)
    if (!response.ok) {
      throw await this.fail(response)
    }
    const etag = stripQuotes(response.headers.get("etag") ?? "")
    const bytes = new Uint8Array(await response.arrayBuffer())
    return { bytes, etag }
  }

  async upload(guyId: string, path: string, bytes: Uint8Array, type: string) {
    const form = new FormData()
    form.set("path", path)
    form.set(
      "file",
      new Blob([bytes], { type: type || "application/octet-stream" }),
      path.split("/").pop() ?? "file"
    )
    return this.json<Written>(`/api/guys/${guyId}/home/upload`, {
      method: "POST",
      body: form,
    })
  }

  async deleteFile(guyId: string, path: string) {
    const query = new URLSearchParams({ path })
    return this.json<{ path: string; deleted: boolean }>(
      `/api/guys/${guyId}/home/file?${query}`,
      { method: "DELETE" }
    )
  }

  async startDevice(hostname: string) {
    return this.json<{ id: string; verifyUrl: string; expiresIn: number }>(
      "/api/cli/device",
      {
        method: "POST",
        body: JSON.stringify({ hostname }),
      },
      false
    )
  }

  async claimDevice(id: string) {
    return this.json<{
      status: "pending" | "expired" | "approved"
      token?: string
    }>(`/api/cli/device/${id}/token`, { method: "POST" }, false)
  }

  private async json<T>(
    path: string,
    init?: RequestInit,
    auth = true
  ): Promise<T> {
    const response = await this.fetch(path, init, auth)
    if (response.status === 204) {
      return undefined as T
    }
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      throw this.errorFrom(data, response.status)
    }
    return data as T
  }

  private fetch(path: string, init?: RequestInit, auth = true) {
    const headers = new Headers(init?.headers)
    if (typeof init?.body === "string" && !headers.has("content-type")) {
      headers.set("content-type", "application/json")
    }
    if (auth && this.token) {
      headers.set("authorization", `Bearer ${this.token}`)
    }
    return fetch(`${this.origin}${path}`, { ...init, headers })
  }

  private async fail(response: Response) {
    const data: unknown = await response.json().catch(() => null)
    return this.errorFrom(data, response.status)
  }

  private errorFrom(data: unknown, status: number) {
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return new SiteError(data.error, status)
    }
    if (status === 401) {
      return new SiteError("Not signed in. Run j4ck login.", status)
    }
    return new SiteError(`Request failed (${status})`, status)
  }
}

function stripQuotes(value: string) {
  return value.replaceAll('"', "")
}
