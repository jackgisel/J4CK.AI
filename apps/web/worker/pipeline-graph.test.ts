import { describe, expect, test } from "bun:test"

import {
  emptyGraph,
  executionPlan,
  inferEdgeKind,
  parseGraph,
  runInputs,
  starterGraph,
} from "./pipeline-graph"

describe("parseGraph", () => {
  test("allows an empty board", () => {
    const parsed = parseGraph(emptyGraph())
    expect(parsed).toEqual({ nodes: [], edges: [] })
  })

  test("keeps a legacy step without a face", () => {
    const parsed = parseGraph({
      nodes: [
        {
          id: "n1",
          type: "step",
          position: { x: 0, y: 0 },
          data: {
            label: "Claude Sonnet",
            model: "anthropic/claude-sonnet-4-5",
            systemPrompt: "Be brief.",
          },
        },
      ],
      edges: [],
    })
    expect("error" in parsed).toBe(false)
    if ("error" in parsed) {
      return
    }
    expect(parsed.nodes[0]?.data.color).toBe("#44403c")
    expect(parsed.nodes[0]?.data.avatarEyes).toBe("dots")
    expect(parsed.nodes[0]?.data.guyId).toBeNull()
  })

  test("promotes a back-edge to a loop", () => {
    const parsed = parseGraph({
      nodes: [
        node("a", { x: 0, y: 0 }),
        node("b", { x: 120, y: 0 }),
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a" },
      ],
    })
    expect("error" in parsed).toBe(false)
    if ("error" in parsed) {
      return
    }
    expect(parsed.edges.find((edge) => edge.id === "e1")?.kind).toBe("flow")
    expect(parsed.edges.find((edge) => edge.id === "e2")?.kind).toBe("loop")
  })

  test("allows a self loop", () => {
    const parsed = parseGraph({
      nodes: [node("solo", { x: 0, y: 0 })],
      edges: [{ id: "loop", source: "solo", target: "solo" }],
    })
    expect("error" in parsed).toBe(false)
    if ("error" in parsed) {
      return
    }
    expect(parsed.edges[0]?.kind).toBe("loop")
    expect(runInputs(parsed).map((field) => field.key)).toEqual(["solo"])
  })

  test("parses the starter board", () => {
    const parsed = parseGraph(starterGraph())
    expect("error" in parsed).toBe(false)
    if ("error" in parsed) {
      return
    }
    expect(parsed.nodes).toHaveLength(5)
    expect(parsed.edges.some((edge) => edge.kind === "loop")).toBe(true)
    expect(runInputs(parsed).map((field) => field.key)).toEqual(["claude1"])
  })
})

describe("executionPlan", () => {
  test("runs a line once", () => {
    const parsed = parseGraph({
      nodes: [node("a", { x: 0, y: 0 }), node("b", { x: 80, y: 0 })],
      edges: [{ id: "e", source: "a", target: "b", kind: "flow" }],
    })
    if ("error" in parsed) {
      throw new Error(parsed.error)
    }
    const plan = executionPlan(parsed)
    if ("error" in plan) {
      throw new Error(plan.error)
    }
    expect(plan.flat().map((step) => `${step.node.id}:${step.visit}`)).toEqual([
      "a:1",
      "b:1",
    ])
  })

  test("unrolls a self loop", () => {
    const parsed = parseGraph({
      nodes: [
        {
          ...node("solo", { x: 0, y: 0 }),
          data: { ...node("solo", { x: 0, y: 0 }).data, maxLoops: 3 },
        },
      ],
      edges: [{ id: "loop", source: "solo", target: "solo", kind: "loop" }],
    })
    if ("error" in parsed) {
      throw new Error(parsed.error)
    }
    const plan = executionPlan(parsed)
    if ("error" in plan) {
      throw new Error(plan.error)
    }
    expect(plan.flat().map((step) => step.visit)).toEqual([1, 2, 3])
  })

  test("replays a cycle after the first pass", () => {
    const parsed = parseGraph({
      nodes: [
        node("a", { x: 0, y: 0 }),
        {
          ...node("b", { x: 80, y: 0 }),
          data: { ...node("b", { x: 80, y: 0 }).data, maxLoops: 2 },
        },
      ],
      edges: [
        { id: "fwd", source: "a", target: "b", kind: "flow" },
        { id: "back", source: "b", target: "a", kind: "loop", max: 2 },
      ],
    })
    if ("error" in parsed) {
      throw new Error(parsed.error)
    }
    const plan = executionPlan(parsed)
    if ("error" in plan) {
      throw new Error(plan.error)
    }
    expect(plan.flat().map((step) => `${step.node.id}:${step.visit}`)).toEqual([
      "a:1",
      "b:1",
      "a:2",
      "b:2",
    ])
  })
})

describe("inferEdgeKind", () => {
  test("marks a self arrow as a loop", () => {
    const edge = inferEdgeKind(
      { id: "e", source: "a", target: "a", kind: "flow" },
      []
    )
    expect(edge.kind).toBe("loop")
  })
})

function node(id: string, position: { x: number; y: number }) {
  return {
    id,
    type: "step" as const,
    position,
    data: {
      label: id,
      model: "anthropic/claude-sonnet-4-5",
      systemPrompt: "",
      color: "#0f766e",
      avatarEyes: "dots" as const,
      avatarFacialHair: "none" as const,
      avatarHat: "none" as const,
    },
  }
}
