export type PlanStep = {
  title: string
  detail: string
}

export type Plan = {
  summary: string
  approach: string
  steps: PlanStep[]
  unknowns: string[]
}

export type StepTokens = {
  title: string
  inputTokens: number
  outputTokens: number
}

export type ModelPrice = {
  id: string
  inputPerM: number
  outputPerM: number
}

export type ModelEstimate = ModelPrice & {
  usd: number
  lowUsd: number
  highUsd: number
}

export type Estimate = {
  steps: StepTokens[]
  inputTokens: number
  outputTokens: number
  models: ModelEstimate[]
}

// Open-weight models to price each plan against, cheapest tier first. Each one
// has a Hugging Face id and supports structured output on OpenRouter.
export const ESTIMATE_MODELS = [
  "openai/gpt-oss-120b",
  "deepseek/deepseek-v4-flash",
  "minimax/minimax-m3.1-flash",
  "minimax/minimax-m3",
]

// Token counts from a model are a guess, so the card shows a range.
const LOW_FACTOR = 0.7
const HIGH_FACTOR = 2

type CatalogModel = {
  id?: string
  pricing?: { prompt?: string; completion?: string }
}

export function readPrices(catalog: unknown, ids = ESTIMATE_MODELS) {
  const data = (catalog as { data?: CatalogModel[] } | null)?.data ?? []
  const prices: ModelPrice[] = []
  for (const id of ids) {
    const pricing = data.find((model) => model.id === id)?.pricing
    const input = Number(pricing?.prompt)
    const output = Number(pricing?.completion)
    if (pricing && Number.isFinite(input) && Number.isFinite(output)) {
      prices.push({
        id,
        inputPerM: input * 1_000_000,
        outputPerM: output * 1_000_000,
      })
    }
  }
  return prices
}

export function priceEstimate(
  steps: StepTokens[],
  prices: ModelPrice[]
): Estimate {
  const inputTokens = sum(steps.map((step) => step.inputTokens))
  const outputTokens = sum(steps.map((step) => step.outputTokens))

  return {
    steps,
    inputTokens,
    outputTokens,
    models: prices.map((price) => {
      const usd =
        (inputTokens * price.inputPerM + outputTokens * price.outputPerM) /
        1_000_000
      return {
        ...price,
        usd,
        lowUsd: usd * LOW_FACTOR,
        highUsd: usd * HIGH_FACTOR,
      }
    }),
  }
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
