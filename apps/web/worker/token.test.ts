import { expect, test } from "bun:test"

import {
  bearerToken,
  generateToken,
  hashToken,
  isCliToken,
  tokenPrefix,
} from "./token"

test("generateToken makes a 48-hex j4ck_ secret", () => {
  const token = generateToken()
  expect(isCliToken(token)).toBe(true)
  expect(tokenPrefix(token).startsWith("j4ck_")).toBe(true)
})

test("hashToken is stable SHA-256 hex", async () => {
  const token = "j4ck_" + "ab".repeat(24)
  const hash = await hashToken(token)
  expect(hash).toHaveLength(64)
  expect(await hashToken(token)).toBe(hash)
  expect(await hashToken(token.slice(0, -1) + "c")).not.toBe(hash)
})

test("bearerToken reads a CLI secret and ignores other schemes", () => {
  const token = "j4ck_" + "11".repeat(24)
  expect(bearerToken(`Bearer ${token}`)).toBe(token)
  expect(bearerToken(`bearer ${token}`)).toBe(token)
  expect(bearerToken("Bearer session-cookie")).toBe(null)
  expect(bearerToken("Basic abc")).toBe(null)
  expect(bearerToken(null)).toBe(null)
})
