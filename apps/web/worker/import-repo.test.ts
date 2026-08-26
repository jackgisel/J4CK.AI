import { describe, expect, test } from "bun:test"

import {
  backstoryFromIdentity,
  importGitHubRepo,
  inspectRepoLayout,
  mapRepoPath,
  parseGitHubUrl,
  skillSlug,
} from "./import-repo"
import type { GuyHome } from "./home"

describe("parseGitHubUrl", () => {
  test("accepts https, ssh, and owner/repo", () => {
    expect(parseGitHubUrl("https://github.com/jack/books")).toEqual({
      owner: "jack",
      repo: "books",
      subdir: "",
    })
    expect(parseGitHubUrl("https://github.com/jack/books.git")).toEqual({
      owner: "jack",
      repo: "books",
      subdir: "",
    })
    expect(parseGitHubUrl("jack/books")).toEqual({
      owner: "jack",
      repo: "books",
      subdir: "",
    })
    expect(parseGitHubUrl("git@github.com:jack/books.git")).toEqual({
      owner: "jack",
      repo: "books",
      subdir: "",
    })
    expect(
      parseGitHubUrl("https://github.com/jack/books/tree/main/ledger")
    ).toEqual({
      owner: "jack",
      repo: "books",
      ref: "main",
      subdir: "ledger",
    })
  })

  test("rejects non-github urls", () => {
    expect(parseGitHubUrl("https://gitlab.com/jack/books")).toEqual({
      error: "Use a GitHub URL (https://github.com/owner/repo)",
    })
  })
})

describe("mapRepoPath", () => {
  test("maps a Cursor bookkeeping workspace into a guy home", () => {
    const paths = [
      ".cursor/skills/bookkeeping/SKILL.md",
      ".cursor/skills/bookkeeping/examples.md",
      "expenses.md",
      "receipts/2026-08-01.pdf",
      "package.json",
      "node_modules/left-pad/index.js",
    ]
    const layout = inspectRepoLayout(paths)
    expect(layout.hasCursorSkills).toBe(true)
    expect(layout.hasFilesDir).toBe(false)
    expect(mapRepoPath(paths[0]!, layout, "books")).toBe(
      "skills/bookkeeping/SKILL.md"
    )
    expect(mapRepoPath(paths[1]!, layout, "books")).toBe(
      "skills/bookkeeping/examples.md"
    )
    expect(mapRepoPath(paths[2]!, layout, "books")).toBe("files/expenses.md")
    expect(mapRepoPath(paths[3]!, layout, "books")).toBe(
      "files/receipts/2026-08-01.pdf"
    )
    expect(mapRepoPath(paths[4]!, layout, "books")).toEqual({ skip: "ignored" })
    expect(mapRepoPath(paths[5]!, layout, "books")).toEqual({ skip: "ignored" })
  })

  test("maps a guy-shaped skills repo without scooping extra files", () => {
    const paths = [
      "skills/files/SKILL.md",
      "files/expenses.md",
      "identity.md",
      "hooks/on-message.md",
      "README.md",
    ]
    const layout = inspectRepoLayout(paths)
    expect(layout.hasSkillsDir).toBe(true)
    expect(layout.hasFilesDir).toBe(true)
    expect(mapRepoPath("skills/files/SKILL.md", layout, "books")).toBe(
      "skills/files/SKILL.md"
    )
    expect(mapRepoPath("files/expenses.md", layout, "books")).toBe(
      "files/expenses.md"
    )
    expect(mapRepoPath("identity.md", layout, "books")).toBe("identity.md")
    expect(mapRepoPath("README.md", layout, "books")).toEqual({
      skip: "outside skills and files",
    })
  })

  test("treats a root SKILL.md repo as one skill", () => {
    const layout = inspectRepoLayout(["SKILL.md", "scripts/parse.py"])
    expect(layout.hasRootSkill).toBe(true)
    expect(mapRepoPath("SKILL.md", layout, "receipts")).toBe(
      "skills/receipts/SKILL.md"
    )
    expect(mapRepoPath("scripts/parse.py", layout, "receipts")).toBe(
      "skills/receipts/scripts/parse.py"
    )
  })

  test("slugs skill folder names", () => {
    expect(skillSlug("Bookkeeping")).toBe("bookkeeping")
    expect(skillSlug("1bad")).toBe(null)
    const layout = inspectRepoLayout([".cursor/skills/Receipts/SKILL.md"])
    expect(
      mapRepoPath(".cursor/skills/Receipts/SKILL.md", layout, "books")
    ).toBe("skills/receipts/SKILL.md")
  })
})

describe("backstoryFromIdentity", () => {
  test("drops the heading", () => {
    expect(backstoryFromIdentity("# Books\n\nKeeps the ledger honest.\n")).toBe(
      "Keeps the ledger honest."
    )
  })
})

describe("importGitHubRepo", () => {
  test("copies mapped files into the home", async () => {
    const files = {
      ".cursor/skills/bookkeeping/SKILL.md":
        "---\nname: bookkeeping\ndescription: Track spend.\n---\n\nWrite to files/expenses.md.\n",
      "expenses.md": "- 2026-08-21 subway 50.00 meals\n",
    }
    const bucket = memoryBucket()
    const home: GuyHome = {
      userId: "user-1",
      guyId: "guy-1",
      name: "Books",
      backstory: "",
    }
    const result = await importGitHubRepo(
      bucket,
      home,
      { url: "https://github.com/jack/books" },
      githubFetch(files)
    )
    if ("error" in result) {
      throw new Error(result.error)
    }
    expect(result.skills).toEqual(["bookkeeping"])
    expect(result.imported.map((row) => row.path).sort()).toEqual([
      "files/expenses.md",
      "skills/bookkeeping/SKILL.md",
    ])
    expect(bucket.objects.get("guys/user-1/guy-1/files/expenses.md")).toContain(
      "subway"
    )
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function githubFetch(files: Record<string, string>): typeof fetch {
  const entries = Object.entries(files)
  return async (input) => {
    const url = String(input)
    if (/\/repos\/[^/]+\/[^/]+$/.test(url)) {
      return json({
        default_branch: "main",
        html_url: "https://github.com/jack/books",
      })
    }
    if (url.includes("/git/trees/")) {
      return json({
        sha: "abc123",
        truncated: false,
        tree: entries.map(([path, content], index) => ({
          path,
          type: "blob",
          sha: `sha${index}`,
          size: content.length,
          mode: "100644",
        })),
      })
    }
    const blob = url.match(/\/git\/blobs\/sha(\d+)$/)
    if (blob) {
      const content = entries[Number(blob[1])]?.[1] ?? ""
      return json({ content: btoa(content), encoding: "base64" })
    }
    return new Response("missing", { status: 404 })
  }
}

function memoryBucket() {
  const objects = new Map<string, string | ArrayBuffer>()
  return {
    objects,
    async put(
      key: string,
      value: string | ArrayBuffer | ArrayBufferView,
      _options?: { httpMetadata?: { contentType?: string } }
    ) {
      if (typeof value === "string") {
        objects.set(key, value)
        return
      }
      if (ArrayBuffer.isView(value)) {
        const copy = new ArrayBuffer(value.byteLength)
        new Uint8Array(copy).set(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        )
        objects.set(key, copy)
        return
      }
      objects.set(key, value)
    },
    async get(key: string) {
      const value = objects.get(key)
      if (value === undefined) {
        return null
      }
      const size = typeof value === "string" ? value.length : value.byteLength
      return {
        size,
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
        async text() {
          return typeof value === "string"
            ? value
            : new TextDecoder().decode(value)
        },
      }
    },
    async head(key: string) {
      return objects.has(key) ? { size: 1 } : null
    },
    async list(opts: { prefix: string; delimiter?: string; limit?: number }) {
      const keys = [...objects.keys()].filter((key) =>
        key.startsWith(opts.prefix)
      )
      if (opts.delimiter) {
        const delimitedPrefixes = new Set<string>()
        const listed: Array<{ key: string; size: number }> = []
        for (const key of keys) {
          const rest = key.slice(opts.prefix.length)
          const slash = rest.indexOf("/")
          if (slash >= 0) {
            delimitedPrefixes.add(opts.prefix + rest.slice(0, slash + 1))
          } else {
            listed.push({ key, size: 1 })
          }
        }
        return {
          objects: listed,
          delimitedPrefixes: [...delimitedPrefixes],
          truncated: false,
        }
      }
      return {
        objects: keys.map((key) => ({ key, size: 1 })),
        truncated: false,
      }
    },
  } as unknown as R2Bucket & { objects: Map<string, string | ArrayBuffer> }
}
