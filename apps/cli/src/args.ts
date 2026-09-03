export const DEFAULT_ORIGIN = "https://j4ck.ai"
export const DEFAULT_PREFIX = "files"
export const DEFAULT_WATCH_MS = 20_000

export type Command =
  | { name: "help" }
  | { name: "login"; origin: string; token: string | null }
  | { name: "logout" }
  | { name: "whoami" }
  | { name: "guys" }
  | { name: "link"; guy: string; dir: string; path: string }
  | { name: "unlink"; guy: string }
  | { name: "links" }
  | { name: "sync"; guy: string | null; remove: boolean }
  | { name: "pull"; guy: string | null; remove: boolean }
  | { name: "push"; guy: string | null; remove: boolean }
  | { name: "watch"; guy: string | null; remove: boolean; intervalMs: number }
  | { name: "service"; action: "install" | "uninstall" | "status" }

export function userArgv(argv: string[]) {
  const exe = argv[0] ?? ""
  const rest = argv.slice(1)
  const first = rest[0] ?? ""
  if (
    first === exe ||
    first.endsWith(".ts") ||
    first.endsWith(".js") ||
    first.endsWith("/j4ck") ||
    first === "j4ck"
  ) {
    return rest.slice(1)
  }
  return rest
}

export function parseArgs(argv: string[]): Command | { error: string } {
  const args = userArgv(argv)
  const flags = takeFlags(args)
  if ("error" in flags) {
    return flags
  }
  const [command, ...rest] = flags.rest
  if (
    !command ||
    command === "help" ||
    command === "-h" ||
    command === "--help"
  ) {
    return { name: "help" }
  }
  if (command === "login") {
    return {
      name: "login",
      origin: flags.origin || DEFAULT_ORIGIN,
      token: flags.token,
    }
  }
  if (command === "logout") {
    return { name: "logout" }
  }
  if (command === "whoami") {
    return { name: "whoami" }
  }
  if (command === "guys") {
    return { name: "guys" }
  }
  if (command === "links") {
    return { name: "links" }
  }
  if (command === "link") {
    const guy = rest[0] ?? ""
    const dir = rest[1] ?? ""
    if (!guy || !dir) {
      return { error: "Usage: j4ck link <guy> <dir>" }
    }
    return {
      name: "link",
      guy,
      dir,
      path: flags.path || DEFAULT_PREFIX,
    }
  }
  if (command === "unlink") {
    const guy = rest[0] ?? ""
    if (!guy) {
      return { error: "Usage: j4ck unlink <guy>" }
    }
    return { name: "unlink", guy }
  }
  if (command === "sync" || command === "pull" || command === "push") {
    return { name: command, guy: flags.guy, remove: flags.remove }
  }
  if (command === "watch") {
    return {
      name: "watch",
      guy: flags.guy,
      remove: flags.remove,
      intervalMs: flags.intervalMs,
    }
  }
  if (command === "service") {
    const action = rest[0]
    if (action !== "install" && action !== "uninstall" && action !== "status") {
      return { error: "Usage: j4ck service install|uninstall|status" }
    }
    return { name: "service", action }
  }
  return { error: `Unknown command: ${command}` }
}

function takeFlags(args: string[]):
  | { error: string }
  | {
      rest: string[]
      origin: string
      token: string | null
      guy: string | null
      path: string
      remove: boolean
      intervalMs: number
    } {
  const rest: string[] = []
  let origin = ""
  let token: string | null = null
  let guy: string | null = null
  let path = ""
  let remove = true
  let intervalMs = DEFAULT_WATCH_MS
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? ""
    if (arg === "--keep") {
      remove = false
      continue
    }
    if (arg === "--delete") {
      remove = true
      continue
    }
    if (arg === "--origin") {
      origin = stripSlash(args[i + 1] ?? "")
      i += 1
      continue
    }
    if (arg.startsWith("--origin=")) {
      origin = stripSlash(arg.slice("--origin=".length))
      continue
    }
    if (arg === "--token") {
      token = args[i + 1] ?? ""
      i += 1
      continue
    }
    if (arg.startsWith("--token=")) {
      token = arg.slice("--token=".length)
      continue
    }
    if (arg === "--guy") {
      guy = args[i + 1] ?? ""
      i += 1
      continue
    }
    if (arg.startsWith("--guy=")) {
      guy = arg.slice("--guy=".length)
      continue
    }
    if (arg === "--path") {
      path = (args[i + 1] ?? "").replace(/^\/+/, "").replace(/\/+$/, "")
      i += 1
      continue
    }
    if (arg === "--interval") {
      const raw = Number(args[i + 1])
      i += 1
      if (!Number.isFinite(raw) || raw < 5) {
        return { error: "--interval must be at least 5 seconds" as const }
      }
      intervalMs = Math.round(raw * 1000)
      continue
    }
    if (arg.startsWith("-") && arg !== "-h" && arg !== "--help") {
      return { error: `Unknown flag: ${arg}` }
    }
    rest.push(arg)
  }
  return { rest, origin, token, guy, path, remove, intervalMs }
}

function stripSlash(value: string) {
  return value.replace(/\/+$/, "")
}

export const HELP = `j4ck — keep a Mac folder in sync with a guy's cabinet on j4ck.ai

Usage:
  j4ck login [--origin https://j4ck.ai] [--token j4ck_…]
  j4ck logout
  j4ck whoami
  j4ck guys
  j4ck link <guy> <dir> [--path files]
  j4ck unlink <guy>
  j4ck links
  j4ck sync [--guy <id-or-name>] [--keep]
  j4ck pull [--guy <id-or-name>] [--keep]
  j4ck push [--guy <id-or-name>] [--keep]
  j4ck watch [--guy <id-or-name>] [--keep] [--interval 20]
  j4ck service install|uninstall|status

login opens the site so you can approve this Mac.
link maps a local folder to that guy's files/ cabinet.
sync pulls and pushes. watch does that whenever either side changes.
service install writes a LaunchAgent (macOS) so watch starts at login.

--keep skips deletions. Default sync removes files that disappeared on the other side.
`
