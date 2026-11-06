import { api } from "@/lib/api"

export type CardStatus =
  | "idea"
  | "researching"
  | "approval"
  | "approved"
  | "running"
  | "done"

export type PlanStep = {
  title: string
  detail: string
}

export type Plan = {
  summary: string
  approach: string
  steps: PlanStep[]
  unknowns: string[]
}

export type ModelEstimate = {
  id: string
  inputPerM: number
  outputPerM: number
  usd: number
  lowUsd: number
  highUsd: number
}

export type Estimate = {
  inputTokens: number
  outputTokens: number
  models: ModelEstimate[]
}

export type RunStatus =
  | "running"
  | "finished"
  | "capped"
  | "turn_limit"
  | "failed"

export type Run = {
  id: string
  model: string
  status: RunStatus
  budgetUsd: number
  estimateUsd: number | null
  estimateInputTokens: number | null
  estimateOutputTokens: number | null
  stepCount: number
  stepsDone: number
  turns: number
  retries: number
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  reasoningTokens: number
  costUsd: number
  searchUsd: number
  result: string | null
  error: string | null
  steps: Array<{ title: string; costUsd: number }>
  sources: Array<{ url: string; title: string }>
  startedAt: string
  finishedAt: string | null
}

export type Card = {
  id: string
  title: string
  transcript: string
  status: CardStatus
  plan: Plan | null
  estimate: Estimate | null
  spentUsd: number
  runSpentUsd: number
  runLimit: { model: string; budgetUsd: number }
  run: Run | null
  error: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export const COLUMNS: Array<{ statuses: CardStatus[]; title: string }> = [
  { statuses: ["idea"], title: "Idea" },
  { statuses: ["researching"], title: "Researching" },
  { statuses: ["approval"], title: "Needs approval" },
  { statuses: ["approved", "running"], title: "Approved" },
  { statuses: ["done"], title: "Done" },
]

export async function listCards() {
  const data = await api<{ cards: Card[] }>("/api/cards")
  return data.cards
}

export async function createCard(transcript: string) {
  const data = await api<{ card: Card }>("/api/cards", {
    method: "POST",
    body: JSON.stringify({ transcript }),
  })
  return data.card
}

export async function moveCard(id: string, status: CardStatus) {
  const data = await api<{ card: Card }>(`/api/cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
  return data.card
}

export async function deleteCard(id: string) {
  await api<void>(`/api/cards/${id}`, { method: "DELETE" })
}

export function formatUsd(value: number) {
  if (value > 0 && value < 0.01) {
    return `$${Number(value.toPrecision(2))}`
  }
  return `$${value.toFixed(2)}`
}

export function modelName(id: string) {
  return id.split("/").pop() ?? id
}

export function formatDuration(from: string, to: string) {
  const seconds = Math.round((Date.parse(to) - Date.parse(from)) / 1000)
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
