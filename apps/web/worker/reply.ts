const MODEL = "@cf/zai-org/glm-4.7-flash"
const HISTORY_LIMIT = 40
const REPLY_MAX_TOKENS = 240
const BODY_MAX = 4000

export { HISTORY_LIMIT }

export async function generateReply(
  ai: Ai,
  guy: { name: string; backstory: string },
  userName: string,
  history: Array<{ role: "user" | "assistant"; body: string }>
) {
  try {
    const result = await ai.run(MODEL, {
      messages: [
        { role: "system", content: systemPrompt(guy, userName) },
        ...history.map((row) => ({
          role: row.role,
          content: row.body,
        })),
      ],
      temperature: 0.9,
      max_completion_tokens: REPLY_MAX_TOKENS,
      chat_template_kwargs: { enable_thinking: false },
    })

    return cleanReply(result.choices[0]?.message.content ?? "")
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

function systemPrompt(
  guy: { name: string; backstory: string },
  userName: string
) {
  const who = guy.backstory.trim()
    ? guy.backstory.trim()
    : `A specific person named ${guy.name}. Not a generic assistant.`
  const to = userName.trim() || "the person texting you"

  return [
    `You are ${guy.name}. You are texting ${to}. Stay in character for the whole reply.`,
    "",
    "Who you are:",
    who,
    "",
    "How you write:",
    "- This is a text thread, not email, not a help desk.",
    "- Short. One to three sentences. Fragments are fine.",
    "- Do not mention being an AI, a model, a prompt, or a system.",
    "- Do not offer a list of ways you can help.",
    "- Match the energy of the last message.",
  ].join("\n")
}

function cleanReply(text: string) {
  let body = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
  if (!body) {
    return null
  }
  if (
    (body.startsWith('"') && body.endsWith('"')) ||
    (body.startsWith("'") && body.endsWith("'"))
  ) {
    body = body.slice(1, -1).trim()
  }
  if (!body) {
    return null
  }
  return body.slice(0, BODY_MAX)
}
