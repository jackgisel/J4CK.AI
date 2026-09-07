import { CHAT_MODELS, IMAGE_MODELS, MODELS, isImageModel } from "@/lib/pipelines"

export { CHAT_MODELS, IMAGE_MODELS, MODELS, isImageModel }

export const DEFAULT_MODEL: string = IMAGE_MODELS[0].id

export type StudioMessage = {
  id: string
  role: "user" | "assistant"
  model: string
  body: string
  image: boolean
  contentType: string | null
  createdAt: string
}

export function studioImageUrl(id: string) {
  return `/api/studio/messages/${id}/image`
}

export async function listStudioMessages() {
  const data = await api<{ messages: StudioMessage[] }>("/api/studio/messages")
  return data.messages
}

export async function sendStudioPrompt(body: string, model: string) {
  return api<{ message: StudioMessage; reply: StudioMessage }>(
    "/api/studio/messages",
    {
      method: "POST",
      body: JSON.stringify({ body, model }),
    }
  )
}

export async function clearStudio() {
  await api<void>("/api/studio/messages", { method: "DELETE" })
}

export async function copyImage(id: string) {
  const response = await fetch(studioImageUrl(id))
  if (!response.ok) {
    throw new Error("Could not load the image")
  }
  const blob = await response.blob()
  // Chrome and Safari only take PNG on the clipboard, so anything else
  // goes through a canvas first.
  const png = blob.type === "image/png" ? blob : await toPng(blob)
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })])
}

export async function downloadImage(id: string, name: string) {
  const response = await fetch(studioImageUrl(id))
  if (!response.ok) {
    throw new Error("Could not load the image")
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function imageFileName(message: StudioMessage) {
  const slug = message.body
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return `${slug || "image"}.png`
}

async function toPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not read the image")
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result)
        return
      }
      reject(new Error("Could not read the image"))
    }, "image/png")
  })
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
