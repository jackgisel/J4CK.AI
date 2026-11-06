import { exports } from "cloudflare:workers"
import { expect, vi } from "vitest"

const ORIGIN = "http://j4ck.test"

export function request(path: string, init?: RequestInit) {
  return exports.default.fetch(new Request(`${ORIGIN}${path}`, init))
}

export function json(path: string, body: unknown, init?: RequestInit) {
  return request(path, {
    method: "POST",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
  })
}

// Runs the real magic-link flow: the Worker logs the link it would email, so
// the test follows that link and keeps the session cookie it sets.
export async function signIn(email: string) {
  const log = vi.spyOn(console, "info").mockImplementation(() => {})
  const sent = await json(
    "/api/auth/sign-in/magic-link",
    { email, callbackURL: "/" },
    { headers: { Origin: ORIGIN } }
  )
  if (!sent.ok) {
    throw new Error(`Magic link failed: ${sent.status}`)
  }

  const line = log.mock.calls.map(String).find((call) => call.includes(email))
  log.mockRestore()
  const link = line?.match(/https?:\S+/)?.[0]
  if (!link) {
    throw new Error("No magic link was logged")
  }

  const { pathname, search } = new URL(link)
  const verified = await request(`${pathname}${search}`, {
    redirect: "manual",
  })
  const cookie = verified.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")
  if (!cookie) {
    throw new Error(`No session cookie: ${verified.status}`)
  }
  return { Cookie: cookie }
}

export type Cookie = { Cookie: string }

export type Card = {
  id: string
  title: string
  status: string
  spentUsd: number
  runSpentUsd: number
  error: string | null
  plan: unknown
  estimate: { inputTokens: number; models: Array<{ usd: number }> } | null
  approvedAt: string | null
  run: {
    status: string
    estimateUsd: number | null
    stepCount: number
    stepsDone: number
    turns: number
    retries: number
    inputTokens: number
    cachedTokens: number
    outputTokens: number
    reasoningTokens: number
    costUsd: number
    searchUsd: number
    result: string | null
    error: string | null
    steps: Array<{ title: string; costUsd: number }>
    sources: Array<{ url: string; title: string }>
    finishedAt: string | null
  } | null
}

export async function createCard(cookie: Cookie) {
  const response = await json(
    "/api/cards",
    { transcript: "um book a venue for the offsite" },
    { headers: cookie }
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { card: Card }).card
}

export function move(id: string, status: string, cookie: Cookie) {
  return request(`/api/cards/${id}`, {
    method: "PATCH",
    headers: { ...cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
}

export async function readCard(id: string, cookie: Cookie) {
  const response = await request("/api/cards", { headers: cookie })
  const { cards } = (await response.json()) as { cards: Card[] }
  const card = cards.find((item) => item.id === id)
  if (!card) {
    throw new Error("Card is gone")
  }
  return card
}

export async function waitForStatus(
  id: string,
  status: string,
  cookie: Cookie
) {
  await vi.waitFor(
    async () => {
      expect((await readCard(id, cookie)).status).toBe(status)
    },
    { timeout: 4000, interval: 25 }
  )
  return readCard(id, cookie)
}
