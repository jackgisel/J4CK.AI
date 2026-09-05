import { describe, expect, test } from "bun:test"

import { extractImage } from "./pipeline-providers"

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

describe("extractImage", () => {
  test("reads the openai images shape", async () => {
    const image = await extractImage({ data: [{ b64_json: PNG_BASE64 }] })
    expect(image.contentType).toBe("image/png")
    expect(image.bytes.byteLength).toBeGreaterThan(0)
  })

  test("reads a nested openai images shape", async () => {
    const image = await extractImage({
      result: { data: [{ b64_json: PNG_BASE64 }] },
    })
    expect(image.bytes.byteLength).toBeGreaterThan(0)
  })

  test("reads a bare base64 string", async () => {
    const image = await extractImage({ image: PNG_BASE64 })
    expect(image.bytes.byteLength).toBeGreaterThan(0)
  })

  test("reads a data url", async () => {
    const image = await extractImage(`data:image/webp;base64,${PNG_BASE64}`)
    expect(image.contentType).toBe("image/webp")
  })

  test("reads raw bytes", async () => {
    const image = await extractImage(new Uint8Array([1, 2, 3]))
    expect(image.bytes.byteLength).toBe(3)
  })

  test("explains an empty result", async () => {
    await expect(extractImage({})).rejects.toThrow("returned no image")
  })
})
