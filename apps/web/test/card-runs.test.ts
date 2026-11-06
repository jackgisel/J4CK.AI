import { introspectWorkflow } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { afterEach, describe, expect, test, vi } from "vitest"

import { saveTurn } from "../worker/card-run"
import {
  type Card,
  type Cookie,
  createCard,
  move,
  readCard,
  request,
  signIn,
  waitForStatus,
} from "./helpers"
import { type FakeRun, fakeOpenRouter } from "./openrouter"

afterEach(() => {
  vi.restoreAllMocks()
})

// Takes a card through research to the approval column.
async function proposedCard(email: string, run?: FakeRun) {
  const calls = fakeOpenRouter({ run })
  const cookie = await signIn(email)
  const card = await createCard(cookie)
  await move(card.id, "researching", cookie)
  await waitForStatus(card.id, "approval", cookie)
  return { calls, cookie, id: card.id }
}

async function waitForRunEnd(id: string, cookie: Cookie) {
  let card: Card | undefined
  await vi.waitFor(
    async () => {
      card = await readCard(id, cookie)
      expect(card.run?.finishedAt).toBeTruthy()
    },
    { timeout: 4000, interval: 25 }
  )
  if (!card?.run) {
    throw new Error("Run never ended")
  }
  return { card, run: card.run }
}

describe("running a card", () => {
  test("approving works through the plan and records what it cost", async () => {
    const { calls, cookie, id } = await proposedCard("run@example.com")

    const moved = await move(id, "running", cookie)
    expect(moved.status).toBe(200)

    const card = await waitForStatus(id, "done", cookie)
    expect(card.approvedAt).not.toBeNull()
    // Two plan steps and the write-up, at $0.02 each.
    expect(card.run).toMatchObject({
      status: "finished",
      stepCount: 3,
      stepsDone: 3,
      turns: 3,
      retries: 0,
      inputTokens: 3000,
      cachedTokens: 1200,
      outputTokens: 600,
      reasoningTokens: 150,
      result: "Output of call 3",
      error: null,
    })
    expect(card.run?.costUsd).toBeCloseTo(0.06)
    expect(card.run?.searchUsd).toBeCloseTo(0.021)
    expect(card.run?.estimateUsd).toBeCloseTo(0.14)
    expect(card.run?.steps.map((step) => step.title)).toEqual([
      "Search",
      "Compare",
      "Final result",
    ])
    // Research spend stays apart, so the two can be compared.
    expect(card.spentUsd).toBeCloseTo(0.03)
    expect(card.runSpentUsd).toBeCloseTo(0.06)
    expect(calls).toHaveLength(3)
  })

  test("each step sees the last one, on the same provider", async () => {
    const { calls, cookie, id } = await proposedCard("context@example.com")

    await move(id, "running", cookie)
    await waitForStatus(id, "done", cookie)

    const [first, second, final] = calls
    expect(first?.messages.at(-1)?.content).toContain("Step 1 of 3: Search")
    expect(first?.messages.at(-1)?.content).toContain("book a venue")
    expect(second?.messages.at(-2)?.content).toBe("Output of call 1")
    expect(second?.messages.at(-1)?.content).toContain("Step 2 of 3: Compare")
    expect(first?.provider).toEqual({
      sort: "price",
      require_parameters: true,
    })
    expect(second?.provider).toEqual({
      order: ["Relace"],
      require_parameters: true,
    })
    expect(first?.tools).toHaveLength(1)
    // The write-up works from notes, so it has no reason to pay for a search.
    expect(final?.tools).toBeUndefined()
  })

  test("only real links reach the board as sources", async () => {
    const { cookie, id } = await proposedCard("sources@example.com")

    await move(id, "running", cookie)
    const card = await waitForStatus(id, "done", cookie)

    expect(card.run?.sources).toEqual([
      { url: "https://example.com/a", title: "Source A" },
    ])
  })

  test("the cap stops a run before a call that could pass it", async () => {
    const { calls, cookie, id } = await proposedCard("cap@example.com", {
      costUsd: 0.97,
      searchUsd: 0,
    })

    await move(id, "running", cookie)
    const { card, run } = await waitForRunEnd(id, cookie)

    expect(calls).toHaveLength(1)
    expect(run.status).toBe("capped")
    expect(run.costUsd).toBeCloseTo(0.97)
    expect(run.result).toBe("Output of call 1")
    expect(card.status).toBe("approved")
    expect(card.error).toContain("$1.00 cap")
  })

  test("a cut-off reply continues and pays for both turns", async () => {
    const { calls, cookie, id } = await proposedCard("length@example.com", {
      replies: [{ content: "Part one", finishReason: "length" }],
    })

    await move(id, "running", cookie)
    const card = await waitForStatus(id, "done", cookie)

    expect(calls).toHaveLength(4)
    expect(calls[1]?.messages.at(-2)?.content).toBe("Part one")
    expect(calls[1]?.messages.at(-1)?.content).toContain("Continue")
    expect(card.run?.turns).toBe(4)
    expect(card.run?.costUsd).toBeCloseTo(0.08)
  })

  test("a step that never finishes stops the run and keeps the cost", async () => {
    const cut = { content: "", finishReason: "length" }
    const { calls, cookie, id } = await proposedCard("limit@example.com", {
      replies: [cut, cut, cut],
    })

    await move(id, "running", cookie)
    const { card, run } = await waitForRunEnd(id, cookie)

    expect(calls).toHaveLength(3)
    expect(run.status).toBe("turn_limit")
    expect(run.costUsd).toBeCloseTo(0.06)
    expect(card.status).toBe("approved")
    expect(card.error).toContain("did not finish")
  })

  test("a server error retries and shows up in the record", async () => {
    await using workflows = await introspectWorkflow(env.CARD_RUN)
    await workflows.modifyAll(async (step) => {
      await step.disableRetryDelays()
    })
    const { calls, cookie, id } = await proposedCard("retry@example.com", {
      replies: [{ status: 500 }],
    })

    await move(id, "running", cookie)
    const card = await waitForStatus(id, "done", cookie)

    expect(calls).toHaveLength(4)
    expect(card.run).toMatchObject({ turns: 3, retries: 1 })
  })

  test("a failed save does not pay for the call again", async () => {
    await using workflows = await introspectWorkflow(env.CARD_RUN)
    await workflows.modifyAll(async (step) => {
      await step.mockStepError(
        { name: "save step 1 turn 1" },
        new Error("D1 is down"),
        1
      )
      await step.disableRetryDelays()
    })
    const { calls, cookie, id } = await proposedCard("save@example.com")

    await move(id, "running", cookie)
    const card = await waitForStatus(id, "done", cookie)

    expect(calls).toHaveLength(3)
    expect(card.run?.turns).toBe(3)
    expect(card.run?.costUsd).toBeCloseTo(0.06)
  })

  test("saving a turn twice counts it once", async () => {
    const { cookie, id } = await proposedCard("twice@example.com")
    await move(id, "running", cookie)
    await waitForStatus(id, "done", cookie)
    const row = await env.DB.prepare("select id from run where card_id = ?")
      .bind(id)
      .first<{ id: string }>()

    await saveTurn(env, {
      runId: row?.id ?? "",
      stepIndex: 0,
      stepTitle: "Search",
      turn: 1,
      reply: {
        text: "Again",
        finishReason: "stop",
        provider: "Relace",
        inputTokens: 1000,
        cachedTokens: 400,
        outputTokens: 200,
        reasoningTokens: 50,
        searches: 2,
        costUsd: 0.02,
        searchUsd: 0.007,
        citations: [],
        retries: 0,
        durationMs: 10,
      },
      stepsDone: 3,
    })

    const card = await readCard(id, cookie)
    expect(card.run?.turns).toBe(3)
    expect(card.run?.costUsd).toBeCloseTo(0.06)
  })

  test("no credits fails at once, and the card can run again", async () => {
    const { calls, cookie, id } = await proposedCard("credits@example.com", {
      replies: [{ status: 402 }],
    })

    await move(id, "running", cookie)
    const { card, run } = await waitForRunEnd(id, cookie)

    expect(calls).toHaveLength(1)
    expect(run.status).toBe("failed")
    expect(card).toMatchObject({
      status: "approved",
      error: "OpenRouter failed: No credits",
    })

    const again = await move(id, "running", cookie)

    expect(again.status).toBe(200)
    const done = await waitForStatus(id, "done", cookie)
    expect(done.error).toBeNull()
    expect(done.run?.status).toBe("finished")
  })

  test("a card approved before runs existed can start one", async () => {
    const { cookie, id } = await proposedCard("legacy@example.com")
    await env.DB.prepare("update card set status = 'approved' where id = ?")
      .bind(id)
      .run()

    const moved = await move(id, "running", cookie)

    expect(moved.status).toBe(200)
    await waitForStatus(id, "done", cookie)
  })

  test("two clicks start one run", async () => {
    const { cookie, id } = await proposedCard("double@example.com")

    const responses = await Promise.all([
      move(id, "running", cookie),
      move(id, "running", cookie),
    ])

    expect(responses.map((item) => item.status).sort()).toEqual([200, 409])
    await waitForStatus(id, "done", cookie)
    const runs = await env.DB.prepare(
      "select count(*) as n from run where card_id = ?"
    )
      .bind(id)
      .first<{ n: number }>()
    expect(runs?.n).toBe(1)
  })

  test("a finished card has nowhere left to go", async () => {
    const { cookie, id } = await proposedCard("finished@example.com")
    await move(id, "running", cookie)
    await waitForStatus(id, "done", cookie)

    expect((await move(id, "running", cookie)).status).toBe(409)
  })

  test("another user cannot start a run", async () => {
    const { cookie, id } = await proposedCard("run-owner@example.com")
    const other = await signIn("run-other@example.com")

    const response = await move(id, "running", other)

    expect(response.status).toBe(404)
    expect((await readCard(id, cookie)).status).toBe("approval")
  })

  test("a running card cannot be deleted", async () => {
    const { cookie, id } = await proposedCard("busy@example.com")
    await env.DB.prepare("update card set status = 'running' where id = ?")
      .bind(id)
      .run()

    const response = await request(`/api/cards/${id}`, {
      method: "DELETE",
      headers: cookie,
    })

    expect(response.status).toBe(404)
  })
})
