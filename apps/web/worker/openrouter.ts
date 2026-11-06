const API_URL = "https://openrouter.ai/api/v1"

export const MODELS_URL = `${API_URL}/models`

type JsonRequest = {
  model: string
  name: string
  system: string
  prompt: string
  schema: Record<string, unknown>
  maxTokens: number
  skipReasoning?: boolean
  signal?: AbortSignal
}

type ChatResponse = {
  error?: { message?: string }
  choices?: Array<{
    finish_reason?: string
    message?: { content?: string | null }
  }>
  usage?: { cost?: number }
}

export type JsonResult<T> = {
  value: T
  costUsd: number
}

// Reasoning tokens count against maxTokens, so budgets need room above the
// size of the JSON itself. usage.cost is what OpenRouter charged for the call.
export async function completeJson<T>(
  env: Env,
  request: JsonRequest
): Promise<JsonResult<T>> {
  const apiKey = env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set")
  }

  const response = await fetch(`${API_URL}/chat/completions`, {
    method: "POST",
    signal: request.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://j4ck.ai",
      "X-Title": "j4ck.ai",
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      ...(request.skipReasoning ? { reasoning: { enabled: false } } : {}),
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
      provider: { sort: "price", require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.name,
          strict: true,
          schema: request.schema,
        },
      },
    }),
  })

  const data = (await response.json().catch(() => null)) as ChatResponse | null
  if (!response.ok || !data || data.error) {
    const detail = data?.error?.message ?? `HTTP ${response.status}`
    throw new Error(`OpenRouter failed: ${detail}`)
  }

  const choice = data.choices?.[0]
  if (choice?.finish_reason === "length") {
    throw new Error(`${request.name} ran out of tokens`)
  }

  try {
    return {
      value: JSON.parse(choice?.message?.content ?? "") as T,
      costUsd: data.usage?.cost ?? 0,
    }
  } catch {
    throw new Error(`${request.name} did not return JSON`)
  }
}
