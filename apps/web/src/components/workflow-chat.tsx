import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { GuyMark } from "@/components/guy-mark"
import {
  catchUp,
  listMessages,
  sendMessage,
  shouldCatchUp,
  spawnGuy,
  type Guy,
  type Message,
} from "@/lib/guys"

export function WorkflowChat({
  guy,
  boardLabel,
  onSpawned,
  onClear,
}: {
  guy: Guy | null
  boardLabel?: string | null
  onSpawned: (guy: Guy, model: string) => void
  onClear: () => void
}) {
  if (guy) {
    return <GuyThread key={guy.id} guy={guy} onNew={onClear} />
  }
  return <SpawnThread boardLabel={boardLabel} onSpawned={onSpawned} />
}

function SpawnThread({
  boardLabel,
  onSpawned,
}: {
  boardLabel?: string | null
  onSpawned: (guy: Guy, model: string) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }, [pending, busy])

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = prompt.trim()
    if (!text || busy) {
      return
    }
    setBusy(true)
    setError(null)
    setPrompt("")
    setPending(text)
    try {
      const spawned = await spawnGuy(text)
      onSpawned(spawned.guy, spawned.model)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not invent them")
      setPrompt(text)
      setPending(null)
      setBusy(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void onSubmit()
    }
  }

  return (
    <ChatShell
      scrollerRef={scrollerRef}
      error={error}
      value={prompt}
      onChange={setPrompt}
      onKeyDown={onKeyDown}
      onSubmit={onSubmit}
      placeholder="Who should show up?"
      disabled={busy}
      submitting={busy}
    >
      {!pending && !busy ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {boardLabel
            ? `${boardLabel} is just a face on this board. Describe them here and they become a guy you can talk to.`
            : "Describe a little bot. A name, a job, a mood. They show up on the board with a face. Then talk to them here."}
        </p>
      ) : null}
      {pending ? <Bubble role="user" body={pending} /> : null}
      {busy ? <TypingMark label="Inventing" /> : null}
    </ChatShell>
  )
}

function GuyThread({ guy, onNew }: { guy: Guy; onNew: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listMessages(guy.id)
      .then(async (data) => {
        if (cancelled) {
          return
        }
        setMessages(data.messages)
        const last = data.messages.at(-1)
        if (!shouldCatchUp(last)) {
          return
        }
        setWaiting(true)
        try {
          const replies = await catchUp(guy.id)
          if (cancelled) {
            return
          }
          setMessages((current) => mergeMessages(current, replies))
        } catch {
          if (!cancelled) {
            setError("They did not answer")
          }
        } finally {
          if (!cancelled) {
            setWaiting(false)
          }
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load")
        }
      })
    return () => {
      cancelled = true
    }
  }, [guy.id])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }, [messages.length, waiting])

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = body.trim()
    if (!text || submitting || waiting) {
      return
    }
    const pendingId = `pending-${crypto.randomUUID()}`
    setSubmitting(true)
    setWaiting(true)
    setError(null)
    setBody("")
    setMessages((current) => [
      ...current,
      {
        id: pendingId,
        guyId: guy.id,
        role: "user",
        body: text,
        createdAt: new Date().toISOString(),
      },
    ])
    try {
      const { message: created, replies } = await sendMessage(guy.id, text)
      setMessages((current) => {
        const withoutPending = current.filter((row) => row.id !== pendingId)
        return mergeMessages([...withoutPending, created], replies)
      })
    } catch (caught) {
      setMessages((current) => current.filter((row) => row.id !== pendingId))
      setBody(text)
      setError(caught instanceof Error ? caught.message : "Could not send")
    } finally {
      setSubmitting(false)
      setWaiting(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void onSubmit()
    }
  }

  return (
    <ChatShell
      scrollerRef={scrollerRef}
      error={error}
      value={body}
      onChange={setBody}
      onKeyDown={onKeyDown}
      onSubmit={onSubmit}
      placeholder={`Write ${guy.name}`}
      disabled={submitting || waiting}
      submitting={submitting}
      header={
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <GuyMark
              color={guy.color}
              avatarEyes={guy.avatarEyes}
              avatarFacialHair={guy.avatarFacialHair}
              avatarHat={guy.avatarHat}
              className="size-8"
            />
            <span className="truncate font-heading text-sm font-semibold tracking-wide uppercase">
              {guy.name}
            </span>
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={onNew}>
            New
          </Button>
        </div>
      }
    >
      {messages.length === 0 && !waiting ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Write them. They write back. The board is how they run.
        </p>
      ) : (
        messages.map((row) => (
          <Fragment key={row.id}>
            <Bubble role={row.role} body={row.body} />
          </Fragment>
        ))
      )}
      {waiting ? <TypingMark label={`${guy.name} is writing`} /> : null}
    </ChatShell>
  )
}

function ChatShell({
  header,
  children,
  scrollerRef,
  error,
  value,
  onChange,
  onKeyDown,
  onSubmit,
  placeholder,
  disabled,
  submitting,
}: {
  header?: ReactNode
  children: ReactNode
  scrollerRef: RefObject<HTMLDivElement | null>
  error: string | null
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: (event?: FormEvent) => void
  placeholder: string
  disabled: boolean
  submitting: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {header ?? (
        <div className="border-b border-border px-4 py-3">
          <p className="font-heading text-sm font-semibold tracking-wide uppercase">
            New guy
          </p>
        </div>
      )}
      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {children}
      </div>
      <form
        className="flex shrink-0 flex-col gap-2 border-t border-border bg-background px-4 py-3"
        onSubmit={onSubmit}
      >
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={onKeyDown}
            className="min-h-9 max-h-32 flex-1 py-2"
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
          />
          <Button type="submit" size="sm" disabled={disabled || !value.trim()}>
            {submitting ? "…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Bubble({ role, body }: { role: "user" | "assistant"; body: string }) {
  return (
    <div
      className={`flex flex-col gap-1 ${role === "user" ? "items-end" : "items-start"}`}
    >
      <p
        className={`max-w-[90%] whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {body}
      </p>
    </div>
  )
}

function TypingMark({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="bg-muted px-3 py-2.5 text-muted-foreground" aria-label={label}>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-300ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current" />
        </span>
      </p>
    </div>
  )
}

function mergeMessages(current: Message[], extra: Message[]) {
  const seen = new Set(current.map((row) => row.id))
  const next = [...current]
  for (const row of extra) {
    if (!seen.has(row.id)) {
      next.push(row)
      seen.add(row.id)
    }
  }
  return next
}
