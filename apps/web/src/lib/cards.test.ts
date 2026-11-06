import { expect, test } from "vitest"

import { formatUsd, modelName } from "./cards"

test("formatUsd never rounds a real cost down to zero", () => {
  expect(formatUsd(0)).toBe("$0.00")
  expect(formatUsd(0.00423)).toBe("$0.0042")
  expect(formatUsd(1.236)).toBe("$1.24")
})

test("modelName drops the vendor", () => {
  expect(modelName("minimax/minimax-m3")).toBe("minimax-m3")
})
