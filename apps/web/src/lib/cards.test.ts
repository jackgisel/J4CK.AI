import { expect, test } from "vitest"

import { formatDuration, formatUsd, modelName } from "./cards"

test("formatUsd never rounds a real cost down to zero", () => {
  expect(formatUsd(0)).toBe("$0.00")
  expect(formatUsd(0.00423)).toBe("$0.0042")
  expect(formatUsd(1.236)).toBe("$1.24")
})

test("modelName drops the vendor", () => {
  expect(modelName("minimax/minimax-m3")).toBe("minimax-m3")
})

test("formatDuration switches to minutes past a minute", () => {
  const start = "2026-11-06T18:00:00.000Z"

  expect(formatDuration(start, "2026-11-06T18:00:42.000Z")).toBe("42s")
  expect(formatDuration(start, "2026-11-06T18:03:05.000Z")).toBe("3m 5s")
})
