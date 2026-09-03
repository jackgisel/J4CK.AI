import { expect, test } from "bun:test"

import { launchAgentPlist } from "./service"

test("launchAgentPlist writes a KeepAlive watch job", () => {
  const xml = launchAgentPlist({
    programArguments: ["/usr/local/bin/j4ck", "watch"],
    home: "/Users/jack",
    logPath: "/Users/jack/Library/Logs/j4ck-sync.log",
  })
  expect(xml).toContain("<string>ai.j4ck.sync</string>")
  expect(xml).toContain("<string>/usr/local/bin/j4ck</string>")
  expect(xml).toContain("<string>watch</string>")
  expect(xml).toContain("<key>KeepAlive</key>")
  expect(xml).toContain("<string>/Users/jack</string>")
})

test("launchAgentPlist escapes xml in paths", () => {
  const xml = launchAgentPlist({
    programArguments: ["/tmp/a&b", "watch"],
    home: "/Users/a<b",
    logPath: "/tmp/out.log",
  })
  expect(xml).toContain("/tmp/a&amp;b")
  expect(xml).toContain("/Users/a&lt;b")
})
