import { introspectWorkflow } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { afterEach, describe, expect, test, vi } from "vitest"

import { json, request, signIn } from "./helpers"
import { fakeOpenRouter, PLAN } from "./openrouter"

type Card = {
  id: string
  title: string
  status: string
  spentUsd: number
  error: string | null
  plan: unknown
  estimate: { inputTokens: number; models: Array<{ usd: number }> } | null
  approvedAt: string | null
}

afterEach(() => {
  vi.restoreAllMocks()
})

async function createCard(cookie: { Cookie: string }) {
  const response = await json(
    "/api/cards",
    { transcript: "um book a venue for the offsite" },
    { headers: cookie }
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { card: Card }).card
}

function move(id: string, status: string, cookie: { Cookie: string }) {
  return request(`/api/cards/${id}`, {
    method: "PATCH",
    headers: { ...cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
}

async function readCard(id: string, cookie: { Cookie: string }) {
  const response = await request("/api/cards", { headers: cookie })
  const { cards } = (await response.json()) as { cards: Card[] }
  const card = cards.find((item) => item.id === id)
  if (!card) {
    throw new Error("Card is gone")
  }
  return card
}

async function waitForStatus(
  id: string,
  status: string,
  cookie: { Cookie: string }
) {
  await vi.waitFor(
    async () => {
      expect((await readCard(id, cookie)).status).toBe(status)
    },
    { timeout: 4000, interval: 25 }
  )
  return readCard(id, cookie)
}

describe("creating a card", () => {
  test("needs a session", async () => {
    const response = await json("/api/cards", { transcript: "hello" })

    expect(response.status).toBe(401)
  })

  test("rejects an empty transcript", async () => {
    const cookie = await signIn("empty@example.com")
    const response = await json(
      "/api/cards",
      { transcript: "   " },
      { headers: cookie }
    )

    expect(response.status).toBe(400)
  })

  test("titles the card and records what the title cost", async () => {
    fakeOpenRouter()
    const cookie = await signIn("title@example.com")

    const card = await createCard(cookie)

    expect(card).toMatchObject({
      title: "Book the venue",
      status: "idea",
      spentUsd: 0.01,
    })
  })

  test("still saves the card when the title call fails", async () => {
    fakeOpenRouter({ failing: ["title"] })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const cookie = await signIn("fallback@example.com")

    const card = await createCard(cookie)

    expect(card).toMatchObject({
      title: "um book a venue for the offsite",
      spentUsd: 0,
    })
  })
})

describe("moving a card", () => {
  test("research ends at approval with a plan and a priced estimate", async () => {
    fakeOpenRouter()
    const cookie = await signIn("research@example.com")
    const card = await createCard(cookie)

    const moved = await move(card.id, "researching", cookie)
    expect(moved.status).toBe(200)

    const done = await waitForStatus(card.id, "approval", cookie)
    expect(done.plan).toEqual(PLAN)
    expect(done.estimate?.inputTokens).toBe(1_000_000)
    // 1M input at $0.10/M plus 200k output at $0.20/M.
    expect(done.estimate?.models[0]?.usd).toBeCloseTo(0.14)
    // The title, the plan and the token estimate each cost $0.01.
    expect(done.spentUsd).toBeCloseTo(0.03)
  })

  test("approval is the only way out of the approval column forward", async () => {
    fakeOpenRouter()
    const cookie = await signIn("approve@example.com")
    const card = await createCard(cookie)
    await move(card.id, "researching", cookie)
    await waitForStatus(card.id, "approval", cookie)

    const approved = await move(card.id, "approved", cookie)

    expect(approved.status).toBe(200)
    const saved = await readCard(card.id, cookie)
    expect(saved.status).toBe("approved")
    expect(saved.approvedAt).not.toBeNull()
  })

  test("rejecting sends the card back and clears the plan", async () => {
    fakeOpenRouter()
    const cookie = await signIn("reject@example.com")
    const card = await createCard(cookie)
    await move(card.id, "researching", cookie)
    await waitForStatus(card.id, "approval", cookie)

    await move(card.id, "idea", cookie)

    expect(await readCard(card.id, cookie)).toMatchObject({
      status: "idea",
      plan: null,
      estimate: null,
    })
  })

  test("a failed research step sends the card back with the error", async () => {
    fakeOpenRouter()
    await using workflows = await introspectWorkflow(env.CARD_RESEARCH)
    await workflows.modifyAll(async (step) => {
      await step.mockStepError(
        { name: "research" },
        new Error("OpenRouter failed: No credits"),
        3
      )
      await step.disableRetryDelays()
    })
    const cookie = await signIn("failure@example.com")
    const card = await createCard(cookie)

    await move(card.id, "researching", cookie)

    await vi.waitFor(
      async () => {
        expect(await readCard(card.id, cookie)).toMatchObject({
          status: "idea",
          error: expect.stringContaining("No credits"),
          plan: null,
        })
      },
      { timeout: 4000, interval: 25 }
    )
  })

  test.each(["approval", "approved", "nonsense"])(
    "an idea cannot jump to %s",
    async (status) => {
      fakeOpenRouter()
      const cookie = await signIn(`jump-${status}@example.com`)
      const card = await createCard(cookie)

      const response = await move(card.id, status, cookie)

      expect(response.status).toBe(409)
      expect((await readCard(card.id, cookie)).status).toBe("idea")
    }
  )

  test("another user cannot move a card", async () => {
    fakeOpenRouter()
    const owner = await signIn("card-owner@example.com")
    const other = await signIn("card-other@example.com")
    const card = await createCard(owner)

    const response = await move(card.id, "researching", other)

    expect(response.status).toBe(404)
    expect((await readCard(card.id, owner)).status).toBe("idea")
  })
})
