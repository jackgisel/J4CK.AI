import { expect, test } from "bun:test"

import { HELP, parseArgs, userArgv } from "./args"

test("userArgv drops bun and the script path", () => {
  expect(userArgv(["bun", "/repo/apps/cli/src/index.ts", "login"])).toEqual([
    "login",
  ])
})

test("userArgv drops a duplicated compiled binary path", () => {
  expect(
    userArgv(["/usr/local/bin/j4ck", "/usr/local/bin/j4ck", "sync", "--keep"])
  ).toEqual(["sync", "--keep"])
})

test("userArgv keeps the command when the binary does not duplicate", () => {
  expect(userArgv(["/usr/local/bin/j4ck", "guys"])).toEqual(["guys"])
})

test("parseArgs reads link, sync keep, and service", () => {
  expect(
    parseArgs([
      "bun",
      "index.ts",
      "link",
      "booker",
      "~/Books",
      "--path",
      "files",
    ])
  ).toEqual({
    name: "link",
    guy: "booker",
    dir: "~/Books",
    path: "files",
  })
  expect(parseArgs(["j4ck", "j4ck", "sync", "--keep", "--guy", "abc"])).toEqual(
    {
      name: "sync",
      guy: "abc",
      remove: false,
    }
  )
  expect(parseArgs(["j4ck", "service", "install"])).toEqual({
    name: "service",
    action: "install",
  })
})

test("parseArgs prints help and rejects unknown flags", () => {
  expect(parseArgs(["j4ck", "help"])).toEqual({ name: "help" })
  expect(parseArgs(["j4ck"])).toEqual({ name: "help" })
  expect(parseArgs(["j4ck", "sync", "--wat"])).toEqual({
    error: "Unknown flag: --wat",
  })
  expect(HELP.startsWith("j4ck")).toBe(true)
})
