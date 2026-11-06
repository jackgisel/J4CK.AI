import { introspectWorkflow } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  createCard,
  json,
  move,
  readCard,
  signIn,
  waitForStatus,
} from "./helpers"
import { fakeOpenRouter, PLAN } from "./openrouter"

afterEach(() => {
  vi.restoreAllMocks()
})

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

  test("a card cannot be marked approved without running", async () => {
    fakeOpenRouter()
    const cookie = await signIn("approve@example.com")
    const card = await createCard(cookie)
    await move(card.id, "researching", cookie)
    await waitForStatus(card.id, "approval", cookie)

    const approved = await move(card.id, "approved", cookie)

    expect(approved.status).toBe(409)
    expect((await readCard(card.id, cookie)).status).toBe("approval")
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

  test("a failed run keeps the cost of the calls that succeeded", async () => {
    fakeOpenRouter({ failing: ["tokens"] })
    await using workflows = await introspectWorkflow(env.CARD_RESEARCH)
    await workflows.modifyAll(async (step) => {
      await step.disableRetryDelays()
    })
    const cookie = await signIn("failed-spend@example.com")
    const card = await createCard(cookie)

    await move(card.id, "researching", cookie)

    await vi.waitFor(
      async () => {
        expect(await readCard(card.id, cookie)).toMatchObject({
          status: "idea",
          error: expect.stringContaining("No credits"),
        })
      },
      { timeout: 4000, interval: 25 }
    )
    // The title and the plan each cost $0.01. The token call failed.
    expect((await readCard(card.id, cookie)).spentUsd).toBeCloseTo(0.02)
  })

  test.each(["approval", "approved", "running", "done", "nonsense"])(
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
