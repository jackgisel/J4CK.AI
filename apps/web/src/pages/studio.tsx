import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { MODELS, modelLabel } from "@/lib/pipelines"
import {
  clearStudio,
  copyImage,
  DEFAULT_MODEL,
  downloadImage,
  imageFileName,
  isImageModel,
  listStudioMessages,
  sendStudioPrompt,
  studioImageUrl,
  type StudioMessage,
} from "@/lib/studio"

export function StudioPage() {
  const [messages, setMessages] = useState<StudioMessage[]>([])
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(true)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listStudioMessages()
      .then((rows) => {
        if (cancelled) {
          return
        }
        setMessages(rows)
        const last = rows.at(-1)
        if (last) {
          setModel(last.model)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }
    scroller.scrollTop = scroller.scrollHeight
  }, [messages.length, waiting])

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = prompt.trim()
    if (!text || waiting) {
      return
    }

    const pendingId = `pending-${crypto.randomUUID()}`
    setWaiting(true)
    setError(null)
    setPrompt("")
    setMessages((current) => [
      ...current,
      {
        id: pendingId,
        role: "user",
        model,
        body: text,
        image: false,
        contentType: null,
        createdAt: new Date().toISOString(),
      },
    ])

    try {
      const { message, reply } = await sendStudioPrompt(text, model)
      setMessages((current) => [
        ...current.filter((row) => row.id !== pendingId),
        message,
        reply,
      ])
    } catch (caught) {
      setMessages((current) => current.filter((row) => row.id !== pendingId))
      setPrompt(text)
      setError(caught instanceof Error ? caught.message : "Could not send")
    } finally {
      setWaiting(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void onSubmit()
    }
  }

  async function onClear() {
    if (messages.length === 0 || waiting) {
      return
    }
    const previous = messages
    setMessages([])
    setError(null)
    try {
      await clearStudio()
    } catch (caught) {
      setMessages(previous)
      setError(caught instanceof Error ? caught.message : "Could not clear")
    }
  }

  const makesImages = isImageModel(model)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 px-4 pt-4 lg:px-6 lg:pt-6">
        <span className="font-heading text-sm font-semibold tracking-wide uppercase">
          Studio
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onClear()}
          disabled={messages.length === 0 || waiting}
        >
          Clear
        </Button>
      </div>

      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 lg:px-6"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Paste a prompt. Pick a model. Get a picture back.
          </p>
        ) : (
          messages.map((row) => <Bubble key={row.id} message={row} />)
        )}
        {waiting ? (
          <div className="flex flex-col items-start">
            <p
              className="bg-muted px-3 py-2.5 text-muted-foreground"
              aria-label={makesImages ? "Drawing" : "Writing"}
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

      <form
        className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 lg:px-6"
        onSubmit={onSubmit}
      >
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <Select
            value={model}
            onValueChange={(value) => setModel(value ?? DEFAULT_MODEL)}
          >
            <SelectTrigger
              size="sm"
              className="w-36 shrink-0 gap-1 px-1.5 text-xs **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              aria-label="Model"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((item) => (
                <SelectItem key={item.id} value={item.id} className="text-xs">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-9 flex-1 py-2"
            rows={1}
            placeholder={makesImages ? "Describe the photo" : "Ask anything"}
            disabled={waiting}
          />
          <Button type="submit" size="sm" disabled={waiting || !prompt.trim()}>
            {waiting ? (makesImages ? "Drawing…" : "Thinking…") : "Send"}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Bubble({ message }: { message: StudioMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="max-w-[85%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-primary text-primary-foreground">
          {message.body}
        </p>
        <Meta>{`${modelLabel(message.model)} · ${formatClock(message.createdAt)}`}</Meta>
      </div>
    )
  }

  if (message.image) {
    return <ImageBubble message={message} />
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <p className="max-w-[85%] bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {message.body}
      </p>
      <Meta>{`${modelLabel(message.model)} · ${formatClock(message.createdAt)}`}</Meta>
    </div>
  )
}

function ImageBubble({ message }: { message: StudioMessage }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const onCopy = useCallback(async () => {
    setFailed(null)
    try {
      await copyImage(message.id)
      setCopied(true)
    } catch (caught) {
      setFailed(caught instanceof Error ? caught.message : "Could not copy")
    }
  }, [message.id])

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  async function onDownload() {
    setFailed(null)
    try {
      await downloadImage(message.id, imageFileName(message))
    } catch (caught) {
      setFailed(
        caught instanceof Error ? caught.message : "Could not download"
      )
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <img
        src={studioImageUrl(message.id)}
        alt={message.body}
        className="max-h-[28rem] w-auto max-w-full border border-border bg-muted object-contain"
      />
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => void onCopy()}>
          <CopyIcon />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void onDownload()}>
          <DownloadIcon />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          render={
            <a
              href={studioImageUrl(message.id)}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <ExternalLinkIcon />
          Open
        </Button>
      </div>
      {failed ? (
        <p className="text-sm text-destructive" role="alert">
          {failed}
        </p>
      ) : null}
      <Meta>{`${modelLabel(message.model)} · ${formatClock(message.createdAt)}`}</Meta>
    </div>
  )
}

function Meta({ children }: { children: string }) {
  return (
    <span className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}
