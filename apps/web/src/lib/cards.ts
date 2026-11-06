import { api } from "@/lib/api"

export type CardStatus = "idea" | "researching" | "approval" | "approved"

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

export type Card = {
  id: string
  title: string
  transcript: string
  status: CardStatus
  plan: Plan | null
  estimate: Estimate | null
  spentUsd: number
  error: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export const COLUMNS: Array<{ status: CardStatus; title: string }> = [
  { status: "idea", title: "Idea" },
  { status: "researching", title: "Researching" },
  { status: "approval", title: "Needs approval" },
  { status: "approved", title: "Approved" },
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
