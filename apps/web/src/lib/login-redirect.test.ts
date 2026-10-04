import { expect, test } from "bun:test"

import { safeCallbackPath } from "./login-redirect"

test("safeCallbackPath allows in-site paths only", () => {
  expect(safeCallbackPath(null)).toBe("/tasks")
  expect(safeCallbackPath("/lists?open=abc")).toBe("/lists?open=abc")
  expect(safeCallbackPath("//evil.test")).toBe("/tasks")
  expect(safeCallbackPath("https://evil.test")).toBe("/tasks")
  expect(safeCallbackPath("lists")).toBe("/tasks")
})
