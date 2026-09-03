import { describe, expect, test } from "bun:test"

import { fallbackInventedGuy, parseInventedGuy } from "./invent-guy"

describe("parseInventedGuy", () => {
  test("reads a json blob", () => {
    const guy = parseInventedGuy(
      JSON.stringify({
        name: "June",
        color: "#1e3a5f",
        avatarEyes: "sleepy",
        avatarFacialHair: "none",
        avatarHat: "none",
        backstory: "Cuts copy in half.",
        model: "chat",
        greeting: "Send it.",
      }),
      "a copy editor named June"
    )
    expect(guy.name).toBe("June")
    expect(guy.color).toBe("#1e3a5f")
    expect(guy.avatarEyes).toBe("sleepy")
    expect(guy.greeting).toBe("Send it.")
    expect(guy.model).toBe("chat")
  })

  test("falls back when the model rambles", () => {
    const guy = parseInventedGuy("nope", "an illustrator named Iris who paints brutalist halls")
    expect(guy.name).toBe("Iris")
    expect(guy.model).toBe("image")
    expect(guy.backstory).toContain("illustrator")
  })
})

describe("fallbackInventedGuy", () => {
  test("picks a name from the prompt", () => {
    const guy = fallbackInventedGuy("a stubborn editor named Ed")
    expect(guy.name).toBe("Ed")
    expect(guy.model).toBe("chat")
  })
})
