import { env } from "cloudflare:workers"
import { afterEach, describe, expect, test, vi } from "vitest"

import { createAuth } from "../worker/auth"
import { signIn } from "./helpers"

const ORIGIN = "http://j4ck.test"

afterEach(() => {
  vi.restoreAllMocks()
})

function closedAuth() {
  const closed = { ...env, ALLOW_SIGN_UP: undefined }
  return createAuth(closed, new Request(ORIGIN))
}

function askForLink(auth: ReturnType<typeof createAuth>, email: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ email, callbackURL: "/" }),
    })
  )
}

async function countUsers(email: string) {
  const row = await env.DB.prepare(
    "SELECT count(*) AS total FROM user WHERE email = ?"
  )
    .bind(email)
    .first<{ total: number }>()
  return row?.total
}

describe("with sign-up closed", () => {
  test("a stranger gets the same response but no email", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {})

    const response = await askForLink(closedAuth(), "stranger@example.com")

    expect(response.status).toBe(200)
    expect(log).not.toHaveBeenCalled()
    expect(await countUsers("stranger@example.com")).toBe(0)
  })

  test("an existing account still gets a link", async () => {
    await signIn("member@example.com")
    const log = vi.spyOn(console, "info").mockImplementation(() => {})

    await askForLink(closedAuth(), "Member@Example.com")

    expect(log).toHaveBeenCalledOnce()
  })

  test("a link cannot create an account", async () => {
    const auth = createAuth(env, new Request(ORIGIN))
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    await askForLink(auth, "latecomer@example.com")
    const link = String(log.mock.calls[0]?.[0]).match(/https?:\S+/)?.[0]

    const response = await closedAuth().handler(
      new Request(String(link), { redirect: "manual" })
    )

    expect(response.headers.getSetCookie()).toEqual([])
    expect(await countUsers("latecomer@example.com")).toBe(0)
  })
})
