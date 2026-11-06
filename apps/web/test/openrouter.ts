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

// Stands in for OpenRouter so no test can reach it or spend credits. Each chat
// call costs $0.01, which lets tests add up what a card spent.
export function fakeOpenRouter(options: { failing?: string[] } = {}) {
  const failing = new Set(options.failing)

  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === MODELS_URL) {
        return Response.json(CATALOG)
      }
      if (url !== CHAT_URL) {
        throw new Error(`Unexpected request to ${url}`)
      }

      const body = JSON.parse(String(init?.body))
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
}
