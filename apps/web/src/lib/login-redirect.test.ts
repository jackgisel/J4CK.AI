import { expect, test } from "vitest"

import { safeCallbackPath } from "./login-redirect"

test("safeCallbackPath allows in-site paths only", () => {
  expect(safeCallbackPath(null)).toBe("/board")
  expect(safeCallbackPath("/lists?open=abc")).toBe("/lists?open=abc")
  expect(safeCallbackPath("//evil.test")).toBe("/board")
  expect(safeCallbackPath("https://evil.test")).toBe("/board")
  expect(safeCallbackPath("lists")).toBe("/board")
})
