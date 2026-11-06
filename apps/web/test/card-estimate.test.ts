import { expect, test } from "vitest"

import { priceEstimate, readPrices } from "../worker/card-estimate"

test("readPrices converts per-token strings and skips unknown models", () => {
  const prices = readPrices(
    {
      data: [
        { id: "a", pricing: { prompt: "0.000001", completion: "0.000002" } },
        { id: "b", pricing: { prompt: "nope", completion: "0.000002" } },
      ],
    },
    ["a", "b", "c"]
  )

  expect(prices).toEqual([{ id: "a", inputPerM: 1, outputPerM: 2 }])
})

test("readPrices survives a malformed catalog", () => {
  expect(readPrices(null)).toEqual([])
})

test("priceEstimate totals every step and gives a range", () => {
  const estimate = priceEstimate(
    [
      { title: "one", inputTokens: 1_000_000, outputTokens: 0 },
      { title: "two", inputTokens: 1_000_000, outputTokens: 500_000 },
    ],
    [{ id: "a", inputPerM: 1, outputPerM: 2 }]
  )

  expect(estimate.inputTokens).toBe(2_000_000)
  expect(estimate.outputTokens).toBe(500_000)
  expect(estimate.models[0]).toMatchObject({ usd: 3 })
  expect(estimate.models[0]?.lowUsd).toBeCloseTo(2.1)
  expect(estimate.models[0]?.highUsd).toBeCloseTo(6)
})
