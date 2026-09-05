import type { NodeOutput, PipelineGraph, PipelineNode } from "./pipeline-graph"
import { isImageModel, parentsOf } from "./pipeline-graph"

const IMAGE_MAX_BYTES = 12 * 1024 * 1024

type GatewayRun = (
  model: string,
  inputs: Record<string, unknown>,
  options?: { gateway?: { id: string } }
) => Promise<unknown>

export function artifactKey(
  userId: string,
  pipelineId: string,
  runId: string,
  nodeId: string
) {
  return `pipelines/${userId}/${pipelineId}/${runId}/${nodeId}`
}

export async function executeNode(
  env: Env,
  graph: PipelineGraph,
  node: PipelineNode,
  ctx: {
    userId: string
    pipelineId: string
    runId: string
    visit?: number
    inputs: Record<string, string>
    outputs: Record<string, NodeOutput>
  }
): Promise<NodeOutput> {
  const images = await loadParentImages(env, graph, node, ctx.outputs)
  const prompt = resolvePrompt(node, graph, ctx.inputs, ctx.outputs, ctx.visit)
  if (!prompt.trim() && images.length === 0) {
    throw new Error(`${node.data.label} has an empty input`)
  }

  if (isImageModel(node.data.model)) {
    const instructions = node.data.systemPrompt?.trim()
    const imagePrompt = [instructions, prompt].filter(Boolean).join("\n\n")
    if (!imagePrompt.trim()) {
      throw new Error(`${node.data.label} has an empty input`)
    }
    return runImage(env, node, imagePrompt, ctx)
  }

  return runChat(env, node, prompt || "Review the attached images.", images)
}

function resolvePrompt(
  node: PipelineNode,
  graph: PipelineGraph,
  inputs: Record<string, string>,
  outputs: Record<string, NodeOutput>,
  visit = 1
) {
  const parts: string[] = []
  const from = node.data.inputFrom
  if (from) {
    const output = outputs[from]
    if (output?.text) {
      parts.push(output.text)
    } else if (visit <= 1) {
      const text = inputs[node.id]?.trim()
      if (text) {
        parts.push(text)
      }
    }
  } else {
    const text = inputs[node.id]?.trim()
    if (text) {
      parts.push(text)
    }
  }

  for (const parent of parentsOf(graph, node.id)) {
    if (parent.id === from) {
      continue
    }
    const output = outputs[parent.id]
    if (!output?.text) {
      continue
    }
    if (output.artifactKey && parent.id !== node.id) {
      continue
    }
    parts.push(
      parent.id === node.id && visit > 1
        ? `Previous pass:\n${output.text}`
        : output.text
    )
  }

  if (visit > 1 && !parts.some((part) => part.startsWith("Previous pass:"))) {
    const previous = outputs[node.id]?.text
    if (previous) {
      parts.push(`Previous pass:\n${previous}`)
    }
  }

  return parts.join("\n\n")
}

async function runChat(
  env: Env,
  node: PipelineNode,
  prompt: string,
  images: Array<{ contentType: string; bytes: ArrayBuffer }>
): Promise<NodeOutput> {
  const model = node.data.model
  if (!model) {
    throw new Error(`${node.data.label} needs a model`)
  }

  const userContent: unknown[] = [{ type: "text", text: prompt }]
  for (const image of images) {
    const base64 = bufferToBase64(image.bytes)
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${image.contentType};base64,${base64}`,
      },
    })
  }

  const messages: Array<Record<string, unknown>> = []
  const system = node.data.systemPrompt?.trim()
  if (system) {
    messages.push({ role: "system", content: system })
  }
  messages.push({
    role: "user",
    content: images.length > 0 ? userContent : prompt,
  })

  const result = await runModel(env, model, { messages })
  const text = extractText(result)
  if (!text) {
    throw new Error(`${node.data.label} returned no text. ${hint(result)}`)
  }
  return { text }
}

async function runImage(
  env: Env,
  node: PipelineNode,
  prompt: string,
  ctx: {
    userId: string
    pipelineId: string
    runId: string
  }
): Promise<NodeOutput> {
  const model = node.data.model
  if (!model) {
    throw new Error(`${node.data.label} needs a model`)
  }

  const result = await runModel(env, model, { prompt })
  const image = await extractImage(result)
  const key = artifactKey(ctx.userId, ctx.pipelineId, ctx.runId, node.id)
  await env.BUCKET.put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
  })
  return { text: prompt, artifactKey: key, contentType: image.contentType }
}

async function loadParentImages(
  env: Env,
  graph: PipelineGraph,
  node: PipelineNode,
  outputs: Record<string, NodeOutput>
) {
  const images: Array<{ contentType: string; bytes: ArrayBuffer }> = []
  for (const parent of parentsOf(graph, node.id)) {
    const output = outputs[parent.id]
    if (!output?.artifactKey) {
      continue
    }
    const object = await env.BUCKET.get(output.artifactKey)
    if (!object) {
      continue
    }
    images.push({
      contentType:
        object.httpMetadata?.contentType || output.contentType || "image/png",
      bytes: await object.arrayBuffer(),
    })
  }
  return images
}

async function runModel(
  env: Env,
  model: string,
  inputs: Record<string, unknown>
) {
  const gatewayId = env.AI_GATEWAY_ID?.trim()
  const options = gatewayId ? { gateway: { id: gatewayId } } : undefined
  try {
    return await (env.AI.run as unknown as GatewayRun)(model, inputs, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model failed"
    throw new Error(
      gatewayId
        ? message
        : `${message}. Set AI_GATEWAY_ID and enable Unified Billing (or BYOK) on the gateway.`,
      { cause: error }
    )
  }
}

function extractText(result: unknown) {
  if (typeof result === "string") {
    return result.trim()
  }
  if (!result || typeof result !== "object") {
    return ""
  }
  const value = result as Record<string, unknown>
  if (typeof value.response === "string") {
    return value.response.trim()
  }
  if (typeof value.output_text === "string") {
    return value.output_text.trim()
  }
  if (typeof value.text === "string") {
    return value.text.trim()
  }
  const nested = value.result
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>
    if (typeof inner.response === "string") {
      return inner.response.trim()
    }
    if (typeof inner.text === "string") {
      return inner.text.trim()
    }
  }
  const choices = value.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const choice = choices[0] as Record<string, unknown>
    const message = choice.message
    if (message && typeof message === "object") {
      const content = (message as Record<string, unknown>).content
      if (typeof content === "string") {
        return content.trim()
      }
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (part && typeof part === "object" && "text" in part) {
              return String((part as { text: unknown }).text ?? "")
            }
            return ""
          })
          .join("")
          .trim()
      }
    }
  }
  return ""
}

export async function extractImage(result: unknown): Promise<{
  bytes: ArrayBuffer
  contentType: string
}> {
  const candidate = imageString(result)
  if (candidate) {
    if (candidate.startsWith("data:")) {
      return decodeDataUrl(candidate)
    }
    if (/^https?:\/\//.test(candidate)) {
      const response = await fetch(candidate)
      if (!response.ok) {
        throw new Error("Could not download generated image")
      }
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_MAX_BYTES) {
        throw new Error("Generated image was empty or too large")
      }
      return {
        bytes,
        contentType: response.headers.get("content-type") || "image/png",
      }
    }
    return decodeBase64(candidate, "image/png")
  }

  const raw = imageBytes(result)
  if (raw) {
    return raw
  }
  throw new Error(`Image model returned no image. ${hint(result)}`)
}

function imageString(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) {
    return result.trim()
  }
  if (!result || typeof result !== "object") {
    return null
  }
  const value = result as Record<string, unknown>
  const direct = firstString(value.image, value.b64_json)
  if (direct) {
    return direct
  }
  if (Array.isArray(value.images)) {
    const fromList = firstString(value.images[0])
    if (fromList) {
      return fromList
    }
  }
  // OpenAI images API: { data: [{ b64_json }] } or { data: [{ url }] }.
  if (
    Array.isArray(value.data) &&
    value.data[0] &&
    typeof value.data[0] === "object"
  ) {
    const entry = value.data[0] as Record<string, unknown>
    const fromData = firstString(entry.b64_json, entry.url, entry.image)
    if (fromData) {
      return fromData
    }
  }
  const nested = value.result ?? value.response
  if (nested && typeof nested === "object") {
    return imageString(nested)
  }
  return null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function imageBytes(
  result: unknown
): { bytes: ArrayBuffer; contentType: string } | null {
  if (result instanceof ArrayBuffer) {
    return { bytes: result, contentType: "image/png" }
  }
  if (ArrayBuffer.isView(result)) {
    const view = result as ArrayBufferView
    const copy = new Uint8Array(view.byteLength)
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    return {
      bytes: copy.buffer,
      contentType: "image/png",
    }
  }
  return null
}

function decodeDataUrl(url: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url)
  if (!match) {
    throw new Error("Bad image data URL")
  }
  return decodeBase64(match[2], match[1])
}

function decodeBase64(value: string, contentType: string) {
  let binary: string
  try {
    binary = atob(value.replace(/\s/g, ""))
  } catch {
    throw new Error("Image model returned data that was not an image")
  }
  if (binary.length === 0 || binary.length > IMAGE_MAX_BYTES) {
    throw new Error("Generated image was empty or too large")
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { bytes: bytes.buffer, contentType }
}

function bufferToBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function hint(result: unknown) {
  if (result && typeof result === "object" && "error" in result) {
    const error = (result as { error: unknown }).error
    if (typeof error === "string") {
      return error
    }
  }
  return "Check AI Gateway billing and model access."
}
