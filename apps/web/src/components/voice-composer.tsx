import { useCallback, useState, type FormEvent } from "react"
import { MicIcon, SquareIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { useVoiceNote } from "@/hooks/use-voice-note"

export function VoiceComposer({
  onSubmit,
}: {
  onSubmit: (transcript: string) => Promise<void>
}) {
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const append = useCallback((text: string) => {
    setDraft((current) => (current ? `${current} ${text}` : text))
  }, [])
  const voice = useVoiceNote(append)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const transcript = draft.trim()
    if (!transcript) {
      return
    }
    setSaving(true)
    try {
      await onSubmit(transcript)
      setDraft("")
    } finally {
      setSaving(false)
    }
  }

  const recording = voice.state === "recording"
  const transcribing = voice.state === "transcribing"

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <div className="flex items-start gap-2">
        <Button
          aria-label={recording ? "Stop recording" : "Start recording"}
          aria-pressed={recording}
          disabled={transcribing}
          onClick={recording ? voice.stop : voice.start}
          size="icon"
          type="button"
          variant={recording ? "destructive" : "outline"}
        >
          {recording ? <SquareIcon /> : <MicIcon />}
        </Button>
        <Textarea
          aria-label="Describe a task"
          className="min-h-10 flex-1"
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Talk or type a task"
          rows={2}
          value={draft}
        />
        <Button disabled={saving || !draft.trim()} type="submit">
          {saving ? "Saving…" : "Make card"}
        </Button>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {statusText(voice.state, voice.progress)}
      </p>
      {voice.error ? (
        <p className="text-sm text-destructive" role="alert">
          {voice.error}
        </p>
      ) : null}
    </form>
  )
}

function statusText(state: string, progress: number | null) {
  if (state === "recording") {
    return "Listening. Press stop when you finish."
  }
  if (state === "transcribing") {
    return progress === null
      ? "Transcribing in your browser…"
      : `Downloading the speech model once, ${progress}%`
  }
  return "Speech stays on this device. Only the text you save leaves it."
}
