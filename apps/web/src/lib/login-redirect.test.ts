import { expect, test } from "bun:test"

import { safeCallbackPath } from "./login-redirect"

test("safeCallbackPath allows in-site paths only", () => {
  expect(safeCallbackPath(null)).toBe("/dashboard")
  expect(safeCallbackPath("/cli?device=abc")).toBe("/cli?device=abc")
  expect(safeCallbackPath("//evil.test")).toBe("/dashboard")
  expect(safeCallbackPath("https://evil.test")).toBe("/dashboard")
  expect(safeCallbackPath("cli")).toBe("/dashboard")
})
