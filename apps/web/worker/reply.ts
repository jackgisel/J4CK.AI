import {
  deleteFile,
  ensureHome,
  listFiles,
  listSkills,
  readFile,
  readHook,
  writeFile,
  type GuyHome,
} from "./home"

const MODEL = "@cf/zai-org/glm-4.7-flash"
const HISTORY_LIMIT = 40
const REPLY_MAX_TOKENS = 480
const BODY_MAX = 4000
const TEXT_MAX = 3
const STEP_MAX = 8

export { HISTORY_LIMIT }

export type HistoryRow = { role: "user" | "assistant"; body: string }

export type ChatTool = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ToolBridge = {
  tools: ChatTool[]
  run: (name: string, args: Record<string, unknown>) => Promise<string | null>
}

const TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and folders in your home directory.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            description: "Folder relative to home. Empty string for the root.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a file from your home directory. Binary files return size and type, not bytes.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: {
          path: { type: "string", description: "File path relative to home." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or replace a file in your home directory.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: {
          path: { type: "string", description: "File path relative to home." },
          content: { type: "string", description: "Full file contents." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from your home directory.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: {
          path: { type: "string", description: "File path relative to home." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_texts",
      description:
        "Send 1 to 3 texts in the thread. This ends your turn. Write files first if you are sending a file or a breakdown.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["texts"],
        properties: {
          texts: {
            type: "array",
            minItems: 1,
            maxItems: TEXT_MAX,
            items: { type: "string" },
          },
        },
      },
    },
  },
]

export async function generateReply(
  ai: Ai,
  bucket: R2Bucket,
  home: GuyHome,
  userName: string,
  history: HistoryRow[],
  extra?: ToolBridge
) {
  return runTurn(ai, bucket, home, userName, history, "reply", extra)
}

export async function generateFollowThrough(
  ai: Ai,
  bucket: R2Bucket,
  home: GuyHome,
  userName: string,
  history: HistoryRow[],
  extra?: ToolBridge
) {
  return runTurn(ai, bucket, home, userName, history, "follow_through", extra)
}

export async function generateIdle(
  ai: Ai,
  bucket: R2Bucket,
  home: GuyHome,
  userName: string,
  history: HistoryRow[],
  extra?: ToolBridge
) {
  return runTurn(ai, bucket, home, userName, history, "idle", extra)
}

export function isDanglingPromise(body: string) {
  const text = body.trim()
  if (!text || text.length > 280) {
    return false
  }
  return /\b((i['’]?ll|i will|i['’]?m (gonna|going to)) (send|get|check|look|pull|grab|forward|add|do)|let me|hang on|one sec|give me a|on it|checking|coming)\b/i.test(
    text
  )
}

async function runTurn(
  ai: Ai,
  bucket: R2Bucket,
  home: GuyHome,
  userName: string,
  history: HistoryRow[],
  mode: "reply" | "follow_through" | "idle",
  extra?: ToolBridge
) {
  try {
    await ensureHome(bucket, home)
    const hookName = mode === "idle" ? "on-idle" : "on-message"
    const [hook, skills] = await Promise.all([
      readHook(bucket, home, hookName),
      listSkills(bucket, home),
    ])
    const tools = extra?.tools?.length ? [...TOOLS, ...extra.tools] : TOOLS
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt(home, userName, hook, skills, mode, extra),
      },
      ...history.map((row) => ({
        role: row.role,
        content: row.body,
      })),
    ]

    for (let step = 0; step < STEP_MAX; step += 1) {
      const result = await ai.run(MODEL, {
        messages,
        tools,
        temperature: 0.9,
        max_completion_tokens: REPLY_MAX_TOKENS,
        chat_template_kwargs: { enable_thinking: false },
      })

      const choice = result.choices[0]?.message
      if (!choice) {
        return null
      }

      const calls = (choice.tool_calls ?? []).filter(
        (call): call is ChatCompletionMessageFunctionToolCall =>
          call.type === "function"
      )
      if (calls.length === 0) {
        if (mode === "idle") {
          return null
        }
        return splitTexts(cleanReply(choice.content ?? ""))
      }

      messages.push({
        role: "assistant",
        content: choice.content,
        tool_calls: calls,
      })

      let sent: string[] | null = null
      for (const call of calls) {
        const output = await runTool(bucket, home, call.function, extra)
        if (output.sent) {
          sent = output.sent
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: output.content,
        })
      }
      if (sent) {
        return sent
      }
    }

    return null
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "guy_reply_failed",
        error: error instanceof Error ? error.message : "unknown",
      })
    )
    return null
  }
}

async function runTool(
  bucket: R2Bucket,
  home: GuyHome,
  call: { name: string; arguments: string },
  extra?: ToolBridge
) {
  const args = parseArgs(call.arguments)
  try {
    if (call.name === "list_files") {
      const listed = await listFiles(bucket, home, stringArg(args.path))
      return { content: JSON.stringify(listed) }
    }
    if (call.name === "read_file") {
      const file = await readFile(bucket, home, stringArg(args.path))
      return { content: JSON.stringify(file) }
    }
    if (call.name === "write_file") {
      const written = await writeFile(
        bucket,
        home,
        stringArg(args.path),
        stringArg(args.content)
      )
      return { content: JSON.stringify(written) }
    }
    if (call.name === "delete_file") {
      const deleted = await deleteFile(bucket, home, stringArg(args.path))
      return { content: JSON.stringify(deleted) }
    }
    if (call.name === "send_texts") {
      const texts = Array.isArray(args.texts)
        ? args.texts
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => value.slice(0, BODY_MAX))
            .slice(0, TEXT_MAX)
        : []
      if (texts.length === 0) {
        return { content: JSON.stringify({ error: "texts is required" }) }
      }
      return {
        content: JSON.stringify({ sent: texts.length }),
        sent: texts,
      }
    }
    if (extra) {
      const content = await extra.run(call.name, args)
      if (content) {
        return { content }
      }
    }
    return { content: JSON.stringify({ error: `Unknown tool ${call.name}` }) }
  } catch (error) {
    return {
      content: JSON.stringify({
        error: error instanceof Error ? error.message : "Tool failed",
      }),
    }
  }
}

function parseArgs(raw: string) {
  try {
    const value: unknown = JSON.parse(raw || "{}")
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  } catch {
    return {}
  }
}

function stringArg(value: unknown) {
  return typeof value === "string" ? value : ""
}

function systemPrompt(
  home: GuyHome,
  userName: string,
  hook: string,
  skills: string[],
  mode: "reply" | "follow_through" | "idle",
  extra?: ToolBridge
) {
  const who = home.backstory.trim()
    ? home.backstory.trim()
    : `A specific person named ${home.name}. Not a generic assistant.`
  const to = userName.trim() || "the person texting you"
  const skillLine =
    skills.length > 0
      ? `Installed skills: ${skills.join(", ")}. Read skills/<name>/SKILL.md before using one.`
      : "No skills installed yet. Skills live at skills/<name>/SKILL.md."
  const extraLine =
    extra && extra.tools.length > 0
      ? `Connected servers added extra tools: ${extra.tools.map((tool) => tool.function.name).join(", ")}.`
      : ""

  const modeLine =
    mode === "follow_through"
      ? "You already said you would do something. Do it. Write the file if needed, then send_texts with the actual thing. Do not promise again."
      : mode === "idle"
        ? "The thread is quiet. Only send_texts if something is actually unfinished: a promised file, a ledger line, a breakdown. If the books are already current, send nothing."
        : "You are in a live text thread."

  return [
    `You are ${home.name}. You are texting ${to}. Stay in character.`,
    "",
    "Who you are:",
    who,
    "",
    "You have a private home folder. identity.md is you. files/ is your working cabinet. skills/ is extra playbooks. hooks/ are standing orders. mcp.json is for later.",
    skillLine,
    extraLine,
    "",
    "Tools:",
    "- list_files, read_file, write_file, delete_file for your folder.",
    "- send_texts to talk. That ends the turn.",
    "- If a file is binary, you only get size and type. Do not pretend you read it.",
    "- If you would send a breakdown, receipt list, credentials, or a file, write it under files/ first, then send_texts with the contents.",
    "",
    modeLine,
    "",
    "How you write:",
    "- Short texts. Fragments are fine.",
    "- Never mention being an AI, a model, a prompt, tools, or a system.",
    "- Do not offer a list of ways you can help.",
    "- Match the energy of the last message.",
    hook.trim() ? `Standing orders:\n${hook.trim()}` : "",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
}

function cleanReply(text: string) {
  let body = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
  if (!body) {
    return ""
  }
  if (
    (body.startsWith('"') && body.endsWith('"')) ||
    (body.startsWith("'") && body.endsWith("'"))
  ) {
    body = body.slice(1, -1).trim()
  }
  return body
}

function splitTexts(text: string) {
  if (!text) {
    return null
  }
  const parts = text
    .split(/^\s*-{3,}\s*$/m)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.slice(0, BODY_MAX))
    .slice(0, TEXT_MAX)

  return parts.length > 0 ? parts : null
}
