import { describe, expect, test } from "vitest"

import { json, request, signIn } from "./helpers"

describe("public api", () => {
  test("health reports a reachable database", async () => {
    const response = await request("/api/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, db: true })
  })

  test("the bucket listing is gone", async () => {
    const response = await request("/api/r2")

    expect(response.status).toBe(404)
  })

  test.each(["/api/tasks", "/api/lists"])(
    "%s rejects a request with no session",
    async (path) => {
      const response = await request(path)

      expect(response.status).toBe(401)
    }
  )
})

describe("signed-in api", () => {
  test("a magic link opens a session", async () => {
    const cookie = await signIn("session@example.com")
    const response = await request("/api/auth/get-session", {
      headers: cookie,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      user: { email: "session@example.com" },
    })
  })

  test("a task round-trips through the database", async () => {
    const cookie = await signIn("tasks@example.com")
    const created = await json(
      "/api/tasks",
      { title: "Ship the board" },
      { headers: cookie }
    )
    expect(created.status).toBe(201)

    const listed = await request("/api/tasks", { headers: cookie })

    expect(await listed.json()).toMatchObject({
      tasks: [{ title: "Ship the board", done: false }],
    })
  })

  test("one user cannot read or change another user's task", async () => {
    const owner = await signIn("owner@example.com")
    const other = await signIn("other@example.com")
    const created = await json(
      "/api/tasks",
      { title: "Private" },
      { headers: owner }
    )
    const { task } = (await created.json()) as { task: { id: string } }

    const listed = await request("/api/tasks", { headers: other })
    const patched = await request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { ...other, "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    })

    expect(await listed.json()).toEqual({ tasks: [] })
    expect(patched.status).toBe(404)
  })
})
