import { env, pipeline } from "@huggingface/transformers"
import type {
  AutomaticSpeechRecognitionOutput,
  AutomaticSpeechRecognitionPipeline,
  PretrainedModelOptions,
} from "@huggingface/transformers"

const MODEL = "onnx-community/whisper-base.en"

export type WhisperRequest = { id: number; audio: Float32Array }

export type WhisperMessage =
  | { type: "progress"; percent: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id: number; message: string }

env.allowLocalModels = false

let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function send(message: WhisperMessage) {
  self.postMessage(message)
}

async function hasWebGpu() {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } })
    .gpu
  return Boolean(await gpu?.requestAdapter().catch(() => null))
}

async function load() {
  const webgpu = await hasWebGpu()
  const device = webgpu ? "webgpu" : "wasm"
  const options: PretrainedModelOptions = webgpu
    ? { device, dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } }
    : { device, dtype: "q8" }

  const transcriber = await pipeline("automatic-speech-recognition", MODEL, {
    ...options,
    progress_callback: (event) => {
      if (event.status === "progress_total") {
        send({ type: "progress", percent: Math.round(event.progress) })
      }
    },
  })
  send({ type: "ready", device })
  return transcriber
}

self.onmessage = async (event: MessageEvent<WhisperRequest>) => {
  const { id, audio } = event.data
  try {
    loading ??= load()
    const transcriber = await loading
    const output = (await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
    })) as AutomaticSpeechRecognitionOutput
    send({ type: "result", id, text: output.text.trim() })
  } catch (error) {
    loading = null
    const message =
      error instanceof Error ? error.message : "Could not transcribe"
    send({ type: "error", id, message })
  }
}
