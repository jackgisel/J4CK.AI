#!/usr/bin/env bun

import { spawn } from "node:child_process"
import { watch } from "node:fs"
import { mkdir } from "node:fs/promises"
import { hostname } from "node:os"
import { resolve } from "node:path"

import { HELP, parseArgs, type Command } from "./args"
import { Site, SiteError } from "./api"
import { syncLink, summarize } from "./apply"
import {
  clearConfig,
  emptyConfig,
  loadConfig,
  saveConfig,
  type Config,
  type Link,
} from "./config"
import {
  launchAgentInstalled,
  launchAgentPath,
  logPath,
  removeLaunchAgent,
  writeLaunchAgent,
} from "./service"

async function main() {
  const command = parseArgs(process.argv)
  if ("error" in command) {
    console.error(command.error)
    process.exitCode = 1
    return
  }
  await run(command)
}

async function run(command: Command) {
  if (command.name === "help") {
    process.stdout.write(HELP)
    return
  }
  if (command.name === "login") {
    await login(command.origin, command.token)
    return
  }
  if (command.name === "logout") {
    await clearConfig()
    console.log("Signed out.")
    return
  }
  if (command.name === "service") {
    await runService(command.action)
    return
  }

  const config = await requireConfig()
  const site = new Site(config.origin, config.token)

  if (command.name === "whoami") {
    const me = await site.me()
    console.log(`${me.email} @ ${config.origin}`)
    return
  }
  if (command.name === "guys") {
    const guys = await site.guys()
    if (guys.length === 0) {
      console.log("No guys yet.")
      return
    }
    for (const guy of guys) {
      console.log(`${guy.name}\t${guy.id}`)
    }
    return
  }
  if (command.name === "links") {
    if (config.links.length === 0) {
      console.log("No folders linked. j4ck link <guy> <dir>")
      return
    }
    for (const link of config.links) {
      console.log(`${link.guyName}\t${link.dir}\t${link.path}/`)
    }
    return
  }
  if (command.name === "link") {
    await linkGuy(site, config, command.guy, command.dir, command.path)
    return
  }
  if (command.name === "unlink") {
    const next = config.links.filter((link) => !matchesGuy(link, command.guy))
    if (next.length === config.links.length) {
      throw new Error(`No link for ${command.guy}`)
    }
    await saveConfig({ ...config, links: next })
    console.log(`Unlinked ${command.guy}`)
    return
  }
  if (
    command.name === "sync" ||
    command.name === "pull" ||
    command.name === "push"
  ) {
    const links = pickLinks(config, command.guy)
    for (const link of links) {
      console.log(`${link.guyName} ${link.dir}`)
      const counts = await syncLink(site, link, command.name, command.remove)
      console.log(summarize(counts))
    }
    return
  }
  if (command.name === "watch") {
    await watchLinks(
      site,
      pickLinks(config, command.guy),
      command.remove,
      command.intervalMs
    )
  }
}

async function login(origin: string, token: string | null) {
  const site = new Site(origin, token ?? "")
  if (token) {
    const me = await new Site(origin, token).me()
    await saveSession(origin, token, me.email)
    console.log(`Signed in as ${me.email}`)
    return
  }

  const started = await site.startDevice(hostname() || "Mac")
  console.log(`Open this URL and approve this Mac:\n${started.verifyUrl}`)
  openUrl(started.verifyUrl)

  const deadline = Date.now() + started.expiresIn * 1000
  while (Date.now() < deadline) {
    await sleep(2000)
    const claimed = await site.claimDevice(started.id)
    if (claimed.status === "expired") {
      throw new Error("That login expired. Run j4ck login again.")
    }
    if (claimed.status === "approved" && claimed.token) {
      const me = await new Site(origin, claimed.token).me()
      await saveSession(origin, claimed.token, me.email)
      console.log(`Signed in as ${me.email}`)
      return
    }
  }
  throw new Error("Timed out waiting for approval.")
}

async function saveSession(origin: string, token: string, email: string) {
  const existing = (await loadConfig()) ?? emptyConfig(origin)
  await saveConfig({
    ...existing,
    origin,
    token,
    email,
  })
}

async function linkGuy(
  site: Site,
  config: Config,
  guyQuery: string,
  dir: string,
  path: string
) {
  const guy = await findGuy(site, guyQuery)
  const abs = resolve(dir)
  await mkdir(abs, { recursive: true })
  const link: Link = {
    guyId: guy.id,
    guyName: guy.name,
    dir: abs,
    path,
  }
  const links = config.links.filter((row) => row.guyId !== guy.id)
  links.push(link)
  await saveConfig({ ...config, links })
  console.log(`Linked ${guy.name} → ${abs} (${path}/)`)
}

async function findGuy(site: Site, query: string) {
  const guys = await site.guys()
  const exact = guys.find((guy) => guy.id === query)
  if (exact) {
    return exact
  }
  const name = query.trim().toLowerCase()
  const matches = guys.filter((guy) => guy.name.toLowerCase() === name)
  if (matches.length === 1 && matches[0]) {
    return matches[0]
  }
  if (matches.length > 1) {
    throw new Error(`Several guys named ${query}. Use the id from j4ck guys.`)
  }
  throw new Error(`No guy matching ${query}`)
}

function pickLinks(config: Config, guy: string | null) {
  if (config.links.length === 0) {
    throw new Error("No folders linked. j4ck link <guy> <dir>")
  }
  if (!guy) {
    return config.links
  }
  const links = config.links.filter((link) => matchesGuy(link, guy))
  if (links.length === 0) {
    throw new Error(`No link for ${guy}`)
  }
  return links
}

function matchesGuy(link: Link, query: string) {
  return (
    link.guyId === query || link.guyName.toLowerCase() === query.toLowerCase()
  )
}

async function watchLinks(
  site: Site,
  links: Link[],
  remove: boolean,
  intervalMs: number
) {
  let pending = false
  let running = false

  async function tick(reason: string) {
    if (running) {
      pending = true
      return
    }
    running = true
    try {
      console.log(`sync (${reason})`)
      for (const link of links) {
        const counts = await syncLink(site, link, "sync", remove)
        console.log(`${link.guyName}: ${summarize(counts)}`)
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
    } finally {
      running = false
      if (pending) {
        pending = false
        await tick("queued")
      }
    }
  }

  await tick("start")

  const timers: ReturnType<typeof setInterval>[] = []
  const watchers = links.map((link) => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    const watcher = watch(link.dir, { recursive: true }, () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        void tick(`local ${link.guyName}`)
      }, 400)
    })
    watcher.on("error", (error) => {
      console.error(error.message)
    })
    return watcher
  })

  timers.push(
    setInterval(() => {
      void tick("remote")
    }, intervalMs)
  )

  console.log(
    `Watching ${links.length} folder${links.length === 1 ? "" : "s"}. Ctrl-C to stop.`
  )

  await new Promise<void>((resolvePromise) => {
    const stop = () => {
      for (const watcher of watchers) {
        watcher.close()
      }
      for (const timer of timers) {
        clearInterval(timer)
      }
      resolvePromise()
    }
    process.on("SIGINT", stop)
    process.on("SIGTERM", stop)
  })
}

async function runService(action: "install" | "uninstall" | "status") {
  if (action === "status") {
    const installed = await launchAgentInstalled()
    console.log(
      installed
        ? `LaunchAgent installed at ${launchAgentPath()}\nLogs: ${logPath()}`
        : "LaunchAgent not installed."
    )
    return
  }
  if (process.platform !== "darwin") {
    throw new Error("j4ck service is for macOS LaunchAgents.")
  }
  if (action === "uninstall") {
    await bootout()
    await removeLaunchAgent()
    console.log("Removed the Login item.")
    return
  }
  const path = await writeLaunchAgent()
  await bootout()
  await bootstrap(path)
  console.log(`Installed LaunchAgent at ${path}`)
  console.log(`Logs: ${logPath()}`)
}

function bootstrap(path: string) {
  const uid = process.getuid?.() ?? 0
  return runCommand("launchctl", ["bootstrap", `gui/${uid}`, path])
}

function bootout() {
  const uid = process.getuid?.() ?? 0
  return runCommand("launchctl", [
    "bootout",
    `gui/${uid}/${"ai.j4ck.sync"}`,
  ]).catch(() => undefined)
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "ignore" })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(new Error(`${command} ${args.join(" ")} failed (${code})`))
    })
  })
}

function openUrl(url: string) {
  if (process.platform !== "darwin") {
    return
  }
  spawn("open", [url], { stdio: "ignore", detached: true }).unref()
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms)
  })
}

async function requireConfig() {
  const config = await loadConfig()
  if (!config?.token) {
    throw new Error("Not signed in. Run j4ck login.")
  }
  return config
}

main().catch((error: unknown) => {
  const message =
    error instanceof SiteError || error instanceof Error
      ? error.message
      : "Failed"
  console.error(message)
  process.exitCode = 1
})
