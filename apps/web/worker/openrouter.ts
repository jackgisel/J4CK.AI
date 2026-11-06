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

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type TextRequest = {
  model: string
  messages: ChatMessage[]
  maxTokens: number
  // How many web searches the model may run inside this call. OpenRouter runs
  // them and adds the fee to usage.cost.
  searches: number
  // Keeps every call of a run on one provider so prompt caching still hits.
  provider?: string
  signal?: AbortSignal
}

type TextResponse = ChatResponse & {
  provider?: string
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string | null
      annotations?: Array<{
        type?: string
        url_citation?: { url?: string; title?: string }
      }>
    }
  }>
  usage?: {
    cost?: number
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
    completion_tokens_details?: { reasoning_tokens?: number }
    cost_details?: { upstream_inference_cost?: number }
    server_tool_use_details?: { web_search_requests?: number }
  }
}

export type Citation = {
  url: string
  title: string
}

export type TextResult = {
  text: string
  finishReason: string
  provider: string | null
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  reasoningTokens: number
  searches: number
  // Null when OpenRouter left it out, so a caller cannot mistake it for free.
  costUsd: number | null
  searchUsd: number
  citations: Citation[]
}

export class OpenRouterError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Reasoning tokens count against maxTokens, so budgets need room above the
// size of the JSON itself. usage.cost is what OpenRouter charged for the call.
export async function completeJson<T>(
  env: Env,
  request: JsonRequest
): Promise<JsonResult<T>> {
  const data = await post<ChatResponse>(
    env,
    {
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
    },
    request.signal
  )

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

// Returns every reply OpenRouter charged for, even a cut-off or empty one, so
// the caller can record its cost before deciding what to do with it.
export async function completeText(
  env: Env,
  request: TextRequest
): Promise<TextResult> {
  const data = await post<TextResponse>(
    env,
    {
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages,
      // Without require_parameters a fallback could drop the search tool, and
      // the model would answer from memory with nothing to show for it.
      provider: {
        ...(request.provider
          ? { order: [request.provider] }
          : { sort: "price" }),
        require_parameters: true,
      },
      ...(request.searches > 0
        ? {
            tools: [
              {
                type: "openrouter:web_search",
                parameters: { max_uses: request.searches, max_results: 5 },
              },
            ],
          }
        : {}),
    },
    request.signal
  )

  const choice = data.choices?.[0]
  const usage = data.usage
  const cost = usage?.cost ?? null
  const upstream = usage?.cost_details?.upstream_inference_cost

  return {
    text: choice?.message?.content?.trim() ?? "",
    finishReason: choice?.finish_reason ?? "unknown",
    provider: data.provider ?? null,
    inputTokens: usage?.prompt_tokens ?? 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    searches: usage?.server_tool_use_details?.web_search_requests ?? 0,
    costUsd: cost,
    // Search fees are the part of usage.cost that no provider was paid for.
    searchUsd:
      cost !== null && upstream !== undefined
        ? Math.max(0, cost - upstream)
        : 0,
    citations: readCitations(choice?.message?.annotations),
  }
}

async function post<T extends { error?: { message?: string } }>(
  env: Env,
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  const apiKey = env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set")
  }

  const response = await fetch(`${API_URL}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://j4ck.ai",
      "X-Title": "j4ck.ai",
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => null)) as T | null
  if (!response.ok || !data || data.error) {
    const detail = data?.error?.message ?? `HTTP ${response.status}`
    throw new OpenRouterError(`OpenRouter failed: ${detail}`, response.status)
  }
  return data
}

function readCitations(
  annotations: NonNullable<
    NonNullable<TextResponse["choices"]>[number]["message"]
  >["annotations"]
) {
  const seen = new Map<string, Citation>()
  for (const annotation of annotations ?? []) {
    const url = annotation.url_citation?.url
    // These URLs come from search results and end up as links on the board.
    if (url?.match(/^https?:\/\//) && !seen.has(url)) {
      seen.set(url, { url, title: annotation.url_citation?.title || url })
    }
  }
  return [...seen.values()]
}
