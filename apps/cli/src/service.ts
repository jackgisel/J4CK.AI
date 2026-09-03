import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const LABEL = "ai.j4ck.sync"

export function launchAgentPath(home = homedir()) {
  return join(home, "Library", "LaunchAgents", `${LABEL}.plist`)
}

export function launchAgentLabel() {
  return LABEL
}

export function watchProgramArguments() {
  const exe = process.execPath
  const script = process.argv[1] ?? ""
  if (script.endsWith(".ts") || script.endsWith(".js")) {
    return [exe, script, "watch"]
  }
  return [process.argv[0] || exe, "watch"]
}

export function launchAgentPlist(input: {
  programArguments: string[]
  home: string
  logPath: string
}) {
  const args = input.programArguments
    .map((arg) => `    <string>${escapeXml(arg)}</string>`)
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(input.home)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(input.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(input.logPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${escapeXml(input.home)}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`
}

export function logPath(home = homedir()) {
  return join(home, "Library", "Logs", "j4ck-sync.log")
}

export async function writeLaunchAgent(home = homedir()) {
  const path = launchAgentPath(home)
  await mkdir(dirname(path), { recursive: true })
  await mkdir(dirname(logPath(home)), { recursive: true })
  await writeFile(
    path,
    launchAgentPlist({
      programArguments: watchProgramArguments(),
      home,
      logPath: logPath(home),
    })
  )
  return path
}

export async function removeLaunchAgent(home = homedir()) {
  await unlink(launchAgentPath(home)).catch(() => undefined)
}

export async function launchAgentInstalled(home = homedir()) {
  try {
    await readFile(launchAgentPath(home))
    return true
  } catch {
    return false
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
