const WHISPER_SAMPLE_RATE = 16_000

// Whisper needs 16 kHz mono. Browsers record at their own rate, and Safari
// ignores a requested AudioContext rate, so an offline render does the resample.
export async function toWhisperAudio(recording: Blob) {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer())
    const length = Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE)
    const offline = new OfflineAudioContext(1, length, WHISPER_SAMPLE_RATE)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return rendered.getChannelData(0)
  } finally {
    await context.close()
  }
}
