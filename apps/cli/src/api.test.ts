import { expect, test } from "bun:test"

import { Site, SiteError } from "./api"

const TOKEN = "j4ck_" + "ab".repeat(24)

function startMock() {
  return Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const auth = request.headers.get("authorization")
      if (url.pathname === "/api/cli/device" && request.method === "POST") {
        const body = (await request.json()) as { hostname?: string }
        return Response.json(
          {
            id: "dev-1",
            verifyUrl: "http://127.0.0.1/cli?device=dev-1",
            expiresIn: 600,
            hostname: body.hostname,
          },
          { status: 201 }
        )
      }
      if (url.pathname === "/api/cli/me") {
        if (auth !== `Bearer ${TOKEN}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 })
        }
        return Response.json({
          id: "user-1",
          name: "Jack",
          email: "jack@j4ck.ai",
        })
      }
      if (url.pathname === "/api/guys" && auth === `Bearer ${TOKEN}`) {
        return Response.json({
          guys: [{ id: "guy-1", name: "Booker" }],
        })
      }
      if (
        url.pathname === "/api/guys/guy-1/home" &&
        url.searchParams.get("deep") === "1"
      ) {
        return Response.json({
          path: "files",
          dirs: [],
          files: [
            {
              path: "files/ledger.md",
              size: 4,
              etag: "abc",
              uploaded: "2026-08-28T00:00:00.000Z",
            },
          ],
        })
      }
      return Response.json({ error: "missing" }, { status: 404 })
    },
  })
}

test("Site talks to pairing and cabinet endpoints with a bearer token", async () => {
  const server = startMock()
  try {
    const origin = `http://127.0.0.1:${server.port}`
    const anon = new Site(origin, "")
    const device = await anon.startDevice("Jack-Mac")
    expect(device.id).toBe("dev-1")
    expect(device.verifyUrl).toContain("device=dev-1")

    const signedOut = new Site(origin, "j4ck_" + "00".repeat(24))
    try {
      await signedOut.me()
      throw new Error("expected 401")
    } catch (error) {
      expect(error).toBeInstanceOf(SiteError)
      expect((error as SiteError).status).toBe(401)
    }

    const site = new Site(origin, TOKEN)
    const me = await site.me()
    expect(me.email).toBe("jack@j4ck.ai")
    const guys = await site.guys()
    expect(guys[0]?.name).toBe("Booker")
    const files = await site.listHome("guy-1", "files")
    expect(files[0]?.path).toBe("files/ledger.md")
    expect(files[0]?.etag).toBe("abc")
  } finally {
    server.stop(true)
  }
})
