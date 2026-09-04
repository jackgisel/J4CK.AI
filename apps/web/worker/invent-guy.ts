import {
  AVATAR_EYES,
  AVATAR_FACIAL_HAIR,
  AVATAR_HATS,
  GUY_COLORS,
  type AvatarEyes,
  type AvatarFacialHair,
  type AvatarHat,
} from "./pipeline-graph"

const MODEL = "@cf/zai-org/glm-4.7-flash"
const NAME_MAX = 80
const BACKSTORY_MAX = 8000
const GREETING_MAX = 400

export type InventedGuy = {
  name: string
  color: string
  avatarEyes: AvatarEyes
  avatarFacialHair: AvatarFacialHair
  avatarHat: AvatarHat
  backstory: string
  model: "chat" | "image"
  greeting: string
}

export async function inventGuy(ai: Ai, prompt: string): Promise<InventedGuy> {
  try {
    const result = await ai.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_completion_tokens: 700,
      chat_template_kwargs: { enable_thinking: false },
    })
    const text = extractText(result)
    if (text) {
      return parseInventedGuy(text, prompt)
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "invent_guy_failed",
        error: error instanceof Error ? error.message : "unknown",
      })
    )
  }
  return fallbackInventedGuy(prompt)
}

export function parseInventedGuy(raw: string, prompt: string): InventedGuy {
  const fallback = fallbackInventedGuy(prompt)
  const json = extractJson(raw)
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return fallback
  }
  const value = json as Record<string, unknown>
  const name =
    typeof value.name === "string" && value.name.trim()
      ? value.name.trim().slice(0, NAME_MAX)
      : fallback.name
  const color =
    typeof value.color === "string" && GUY_COLORS.includes(value.color.toLowerCase() as (typeof GUY_COLORS)[number])
      ? value.color.toLowerCase()
      : fallback.color
  const backstory =
    typeof value.backstory === "string" && value.backstory.trim()
      ? value.backstory.trim().slice(0, BACKSTORY_MAX)
      : fallback.backstory
  const greeting =
    typeof value.greeting === "string" && value.greeting.trim()
      ? value.greeting.trim().slice(0, GREETING_MAX)
      : fallback.greeting
  const model =
    value.model === "image" || looksLikeImage(prompt) ? "image" : "chat"

  return {
    name,
    color,
    avatarEyes: pickTrait(value.avatarEyes, AVATAR_EYES, fallback.avatarEyes),
    avatarFacialHair: pickTrait(
      value.avatarFacialHair,
      AVATAR_FACIAL_HAIR,
      fallback.avatarFacialHair
    ),
    avatarHat: pickTrait(value.avatarHat, AVATAR_HATS, fallback.avatarHat),
    backstory,
    model,
    greeting,
  }
}

export function fallbackInventedGuy(prompt: string): InventedGuy {
  const text = prompt.trim()
  const named = text.match(/\b(?:named|called)\s+([A-Z][a-zA-Z'-]{1,24})\b/)
  const capital = text.match(/\b([A-Z][a-zA-Z'-]{2,18})\b/)
  const name = (named?.[1] || capital?.[1] || "Guy").slice(0, NAME_MAX)
  const index = hash(text) % GUY_COLORS.length
  const eyes = AVATAR_EYES[hash(`${text}:eyes`) % AVATAR_EYES.length]
  const hair =
    AVATAR_FACIAL_HAIR[hash(`${text}:hair`) % AVATAR_FACIAL_HAIR.length]
  const hat = AVATAR_HATS[hash(`${text}:hat`) % AVATAR_HATS.length]
  const image = looksLikeImage(text)

  return {
    name,
    color: GUY_COLORS[index] ?? GUY_COLORS[0],
    avatarEyes: eyes ?? "dots",
    avatarFacialHair: hair ?? "none",
    avatarHat: hat ?? "none",
    backstory: text.slice(0, BACKSTORY_MAX) || "A person you invented.",
    model: image ? "image" : "chat",
    greeting: image
      ? "Show me what to draw."
      : `I'm ${name}. Tell me how I should work.`,
  }
}

const SYSTEM = `You invent a little bot person. The user describes who they want.
Reply with JSON only, no markdown.
{
  "name": "short first name",
  "color": one of ${GUY_COLORS.join(", ")},
  "avatarEyes": one of ${AVATAR_EYES.join(", ")},
  "avatarFacialHair": one of ${AVATAR_FACIAL_HAIR.join(", ")},
  "avatarHat": one of ${AVATAR_HATS.join(", ")},
  "backstory": "2-6 sentences. Who they are and how they work when they run on a board.",
  "model": "chat" or "image",
  "greeting": "one short in-character line"
}
Use model "image" only if they draw, paint, or generate pictures. Otherwise "chat".`

function looksLikeImage(prompt: string) {
  return /image|draw|illustrat|picture|photo|paint|render|thumbnail/i.test(
    prompt
  )
}

function pickTrait<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T
  }
  return fallback
}

function extractJson(raw: string) {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  try {
    return JSON.parse(body) as unknown
  } catch {
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start < 0 || end <= start) {
      return null
    }
    try {
      return JSON.parse(body.slice(start, end + 1)) as unknown
    } catch {
      return null
    }
  }
}

function extractText(result: unknown) {
  if (typeof result === "string") {
    return result.trim()
  }
  if (!result || typeof result !== "object") {
    return ""
  }
  const value = result as Record<string, unknown>
  if (typeof value.response === "string") {
    return value.response.trim()
  }
  const choices = value.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const choice = choices[0] as Record<string, unknown>
    const message = choice.message
    if (message && typeof message === "object") {
      const content = (message as Record<string, unknown>).content
      if (typeof content === "string") {
        return content.trim()
      }
    }
  }
  return ""
}

function hash(value: string) {
  let total = 0
  for (let i = 0; i < value.length; i += 1) {
    total = (total * 31 + value.charCodeAt(i)) >>> 0
  }
  return total
}
