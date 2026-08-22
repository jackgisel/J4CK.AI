import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { Link, useParams } from "react-router"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { GuyMark } from "@/components/guy-mark"
import {
  formatMessageTime,
  listMessages,
  catchUp,
  sendMessage,
  shouldCatchUp,
  type Guy,
  type Message,
} from "@/lib/guys"

export function ThreadPage() {
  return <Thread />
}

function Thread() {
  const { id } = useParams()
  const [guy, setGuy] = useState<Guy | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) {
      return
    }
    let cancelled = false
    listMessages(id)
      .then(async (data) => {
        if (cancelled) {
          return
        }
        setGuy(data.guy)
        setMessages(data.messages)
        const last = data.messages.at(-1)
        if (!shouldCatchUp(last)) {
          return
        }
        setWaiting(true)
        try {
          const replies = await catchUp(id)
          if (cancelled) {
            return
          }
          await revealReplies(replies, (next) => {
            if (!cancelled) {
              setMessages((current) =>
                current.some((row) => row.id === next.id)
                  ? current
                  : [...current, next]
              )
            }
          })
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
        if (cancelled) {
          return
        }
        const message =
          caught instanceof Error ? caught.message : "Could not load"
        if (message === "Not found") {
          setMissing(true)
          return
        }
        setLoadError(message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }
    scroller.scrollTop = scroller.scrollHeight
  }, [messages.length, waiting])

  if (missing || !id) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Missing
        </h1>
        <p className="text-base text-muted-foreground">
          No thread with that id.
        </p>
        <div>
          <Button variant="outline" render={<Link to="/messages" />}>
            Messages
          </Button>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    )
  }

  if (!guy) {
    return <p className="text-sm text-muted-foreground">Loading</p>
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = body.trim()
    if (!id || !text || submitting || waiting) {
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
        guyId: id,
        role: "user",
        body: text,
        createdAt: new Date().toISOString(),
      },
    ])
    try {
      const { message: created, replies } = await sendMessage(id, text)
      setMessages((current) => {
        const withoutPending = current.filter((row) => row.id !== pendingId)
        return [...withoutPending, created]
      })
      setSubmitting(false)
      if (replies.length === 0) {
        setError("They did not answer")
        setWaiting(false)
        return
      }
      await revealReplies(replies, (next) => {
        setMessages((current) => [...current, next])
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
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <Link
          to={`/contacts/${guy.id}`}
          className="flex min-w-0 items-center gap-3 hover:opacity-80"
        >
          <GuyMark
            color={guy.color}
            avatarEyes={guy.avatarEyes}
            avatarFacialHair={guy.avatarFacialHair}
            avatarHat={guy.avatarHat}
          />
          <span className="truncate font-heading text-sm font-semibold tracking-wide uppercase">
            {guy.name}
          </span>
        </Link>
        <Button variant="ghost" size="sm" render={<Link to="/messages" />}>
          All
        </Button>
      </div>
      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain"
      >
        {messages.length === 0 && !waiting ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Write them. They write back.
          </p>
        ) : (
          messages.map((row) => (
            <div
              key={row.id}
              className={`flex flex-col gap-1 ${
                row.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <p
                className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
                  row.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {row.body}
              </p>
              <span className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                {formatMessageTime(row.createdAt)}
              </span>
            </div>
          ))
        )}
        {waiting ? (
          <div className="flex flex-col items-start gap-1">
            <p
              className="bg-muted px-3 py-2.5 text-muted-foreground"
              aria-label={`${guy.name} is writing`}
            >
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-300ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </span>
            </p>
          </div>
        ) : null}
      </div>
      <form className="flex shrink-0 flex-col gap-3" onSubmit={onSubmit}>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          className="max-h-40"
          rows={3}
          placeholder={`Write ${guy.name}`}
          disabled={submitting || waiting}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={submitting || waiting || !body.trim()}>
          {submitting ? "Sending" : "Send"}
        </Button>
      </form>
    </div>
  )
}

async function revealReplies(
  replies: Message[],
  append: (row: Message) => void
) {
  for (const [index, reply] of replies.entries()) {
    if (index > 0) {
      await pause(typingDelay(reply.body))
    }
    append(reply)
  }
}

function typingDelay(body: string) {
  return Math.min(1400, 280 + body.length * 18)
}

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
