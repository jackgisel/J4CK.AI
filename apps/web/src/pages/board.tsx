import { useCallback, useEffect, useState, type DragEvent } from "react"

import { BoardCard } from "@/components/board-card"
import { VoiceComposer } from "@/components/voice-composer"
import {
  type Card,
  type CardStatus,
  COLUMNS,
  createCard,
  deleteCard,
  listCards,
  moveCard,
} from "@/lib/cards"

const POLL_MS = 3000

export function BoardPage() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setCards(await listCards())
    } catch (caught) {
      setError(messageOf(caught, "Could not load the board"))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const researching = cards?.some((card) => card.status === "researching")
  useEffect(() => {
    if (!researching) {
      return
    }
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [researching, refresh])

  async function onCreate(transcript: string) {
    setError(null)
    try {
      const created = await createCard(transcript)
      setCards((rows) => [created, ...(rows ?? [])])
    } catch (caught) {
      setError(messageOf(caught, "Could not make the card"))
      throw caught
    }
  }

  async function onMove(card: Card, status: CardStatus) {
    setError(null)
    try {
      const updated = await moveCard(card.id, status)
      setCards((rows) =>
        (rows ?? []).map((row) => (row.id === card.id ? updated : row))
      )
    } catch (caught) {
      setError(messageOf(caught, "Could not move the card"))
      await refresh()
    }
  }

  async function onDelete(card: Card) {
    setError(null)
    try {
      await deleteCard(card.id)
      setCards((rows) => (rows ?? []).filter((row) => row.id !== card.id))
    } catch (caught) {
      setError(messageOf(caught, "Could not delete the card"))
    }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDropTarget(false)
    const card = cards?.find(
      (row) => row.id === event.dataTransfer.getData("text/plain")
    )
    if (card?.status === "idea") {
      void onMove(card, "researching")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <VoiceComposer onSubmit={onCreate} />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const rows = (cards ?? []).filter(
            (card) => card.status === column.status
          )
          const droppable = column.status === "researching"

          return (
            <section
              aria-label={column.title}
              className={`flex min-h-40 flex-col gap-2 overflow-y-auto rounded-xl bg-muted/50 p-2 ${
                droppable && dropTarget ? "ring-2 ring-ring" : ""
              }`}
              key={column.status}
              onDragLeave={droppable ? () => setDropTarget(false) : undefined}
              onDragOver={
                droppable
                  ? (event) => {
                      event.preventDefault()
                      setDropTarget(true)
                    }
                  : undefined
              }
              onDrop={droppable ? onDrop : undefined}
            >
              <h2 className="flex items-center justify-between px-1 pt-1 text-xs font-medium text-muted-foreground">
                {column.title}
                <span className="tabular-nums">{rows.length}</span>
              </h2>
              {rows.map((card) => (
                <BoardCard
                  card={card}
                  key={card.id}
                  onDelete={onDelete}
                  onMove={onMove}
                />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
