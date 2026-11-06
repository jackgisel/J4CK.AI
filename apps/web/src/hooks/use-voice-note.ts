import { useCallback, useEffect, useRef, useState } from "react"

import { toWhisperAudio } from "@/lib/audio"
import type { WhisperMessage, WhisperRequest } from "@/lib/whisper.worker"

export type VoiceState = "idle" | "recording" | "transcribing"

type Pending = {
  resolve: (text: string) => void
  reject: (error: Error) => void
}

export function useVoiceNote(onText: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle")
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const worker = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, Pending>())
  const nextId = useRef(0)

  useEffect(() => {
    return () => {
      recorder.current?.stream.getTracks().forEach((track) => {
        track.stop()
      })
      worker.current?.terminate()
    }
  }, [])

  const transcribe = useCallback((audio: Float32Array) => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL("../lib/whisper.worker.ts", import.meta.url),
        { type: "module" }
      )
      worker.current.onmessage = (event: MessageEvent<WhisperMessage>) => {
        const message = event.data
        if (message.type === "progress") {
          setProgress(message.percent)
        } else if (message.type === "ready") {
          setProgress(null)
        } else if (message.type === "result") {
          pending.current.get(message.id)?.resolve(message.text)
          pending.current.delete(message.id)
        } else {
          pending.current.get(message.id)?.reject(new Error(message.message))
          pending.current.delete(message.id)
        }
      }
    }

    const id = nextId.current++
    const request: WhisperRequest = { id, audio }
    return new Promise<string>((resolve, reject) => {
      pending.current.set(id, { resolve, reject })
      worker.current?.postMessage(request, [audio.buffer])
    })
  }, [])

  const finish = useCallback(
    async (recording: Blob) => {
      setState("transcribing")
      try {
        const text = await transcribe(await toWhisperAudio(recording))
        if (text) {
          onText(text)
        } else {
          setError("Did not catch that. Try again.")
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not transcribe"
        )
      } finally {
        setProgress(null)
        setState("idle")
      }
    },
    [onText, transcribe]
  )

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      const chunks: Blob[] = []
      media.ondataavailable = (event) => chunks.push(event.data)
      media.onstop = () => {
        stream.getTracks().forEach((track) => {
          track.stop()
        })
        void finish(new Blob(chunks, { type: media.mimeType }))
      }
      recorder.current = media
      media.start()
      setState("recording")
    } catch {
      setError("Microphone access is blocked.")
    }
  }, [finish])

  const stop = useCallback(() => {
    recorder.current?.stop()
    recorder.current = null
  }, [])

  return { state, progress, error, start, stop }
}
