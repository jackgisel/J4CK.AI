import { vi } from "vitest"

import type { Plan } from "../worker/card-estimate"

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODELS_URL = "https://openrouter.ai/api/v1/models"

export const PLAN: Plan = {
  summary: "Book the venue",
  approach: "Compare three venues",
  steps: [
    { title: "Search", detail: "Find venues" },
    { title: "Compare", detail: "Rank them" },
  ],
  unknowns: ["Budget"],
}

const REPLIES: Record<string, unknown> = {
  title: { title: "Book the venue" },
  plan: PLAN,
  tokens: {
    steps: [
      { title: "Search", inputTokens: 600_000, outputTokens: 100_000 },
      { title: "Compare", inputTokens: 400_000, outputTokens: 100_000 },
    ],
  },
}

const CATALOG = {
  data: [
    {
      id: "deepseek/deepseek-v4-flash",
      pricing: { prompt: "0.0000001", completion: "0.0000002" },
    },
  ],
}

type RunReply = {
  content?: string
  finishReason?: string
  status?: number
}

type RunCall = {
  messages: Array<{ role: string; content: string }>
  provider: { sort?: string; order?: string[]; require_parameters?: boolean }
  tools?: unknown[]
}

export type FakeRun = {
  // Played back in order, then every later turn is a plain success.
  replies?: RunReply[]
  costUsd?: number
  searchUsd?: number
}

// Stands in for OpenRouter so no test can reach it or spend credits. Each chat
// call costs $0.01, which lets tests add up what a card spent. A run's calls
// have no response_format and land in `calls`, so tests can read what was sent.
export function fakeOpenRouter(
  options: { failing?: string[]; run?: FakeRun } = {}
) {
  const failing = new Set(options.failing)
  const replies = [...(options.run?.replies ?? [])]
  const calls: RunCall[] = []

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url === MODELS_URL) {
      return Response.json(CATALOG)
    }
    if (url !== CHAT_URL) {
      throw new Error(`Unexpected request to ${url}`)
    }

    const body = JSON.parse(String(init?.body))
    if (!body.response_format) {
      calls.push(body)
      return runReply(replies.shift(), options.run, calls.length)
    }
    const name: string = body.response_format.json_schema.name
    if (failing.has(name)) {
      return Response.json(
        { error: { message: "No credits" } },
        { status: 402 }
      )
    }
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(REPLIES[name]) },
        },
      ],
      usage: { cost: 0.01 },
    })
  })

  return calls
}

function runReply(reply: RunReply = {}, run: FakeRun = {}, call = 0) {
  if (reply.status) {
    return Response.json(
      { error: { message: "No credits" } },
      { status: reply.status }
    )
  }

  const costUsd = run.costUsd ?? 0.02
  const searchUsd = run.searchUsd ?? 0.007
  return Response.json({
    provider: "Relace",
    choices: [
      {
        finish_reason: reply.finishReason ?? "stop",
        message: {
          content: reply.content ?? `Output of call ${call}`,
          annotations: [
            {
              type: "url_citation",
              url_citation: { url: "https://example.com/a", title: "Source A" },
            },
            {
              type: "url_citation",
              url_citation: { url: "javascript:alert(1)", title: "Bad" },
            },
          ],
        },
      },
    ],
    usage: {
      cost: costUsd,
      prompt_tokens: 1000,
      completion_tokens: 200,
      prompt_tokens_details: { cached_tokens: 400 },
      completion_tokens_details: { reasoning_tokens: 50 },
      cost_details: { upstream_inference_cost: costUsd - searchUsd },
      server_tool_use_details: { web_search_requests: 2 },
    },
  })
}
