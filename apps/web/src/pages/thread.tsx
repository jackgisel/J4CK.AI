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
import { RequireSession } from "@/components/require-session"
import {
  formatMessageTime,
  listMessages,
  sendMessage,
  type Guy,
  type Message,
} from "@/lib/guys"

export function ThreadPage() {
  return (
    <RequireSession>
      <Thread />
    </RequireSession>
  )
}

function Thread() {
  const { id } = useParams()
  const [guy, setGuy] = useState<Guy | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) {
      return
    }
    let cancelled = false
    listMessages(id)
      .then((data) => {
        if (!cancelled) {
          setGuy(data.guy)
          setMessages(data.messages)
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
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

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
    if (!id || !text || submitting) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await sendMessage(id, text)
      setMessages((current) => [...current, created])
      setBody("")
      setSubmitting(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send")
      setSubmitting(false)
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
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/contacts/${guy.id}`}
          className="flex min-w-0 items-center gap-3 hover:opacity-80"
        >
          <GuyMark name={guy.name} color={guy.color} />
          <span className="truncate font-heading text-sm font-semibold tracking-wide uppercase">
            {guy.name}
          </span>
        </Link>
        <Button variant="ghost" size="sm" render={<Link to="/messages" />}>
          All
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing here yet. They can wait.
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
                className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
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
        <div ref={bottomRef} />
      </div>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          className="max-h-40"
          rows={3}
          placeholder={`Write ${guy.name}`}
          disabled={submitting}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={submitting || !body.trim()}>
          {submitting ? "Sending" : "Send"}
        </Button>
      </form>
    </div>
  )
}
