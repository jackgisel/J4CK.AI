import { exports } from "cloudflare:workers"
import { vi } from "vitest"

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
