import { describe, expect, it } from "vitest"
import {
  CUTOFF_CONTINUE,
  cutoffHistory,
  readCutoff,
  splitCutoff,
  toolArgumentsReady,
} from "./chat-continue"

describe("cutoff continuation", () => {
  it("keeps the partial reply and asks to continue from the cut", () => {
    const origin = [{ role: "user" as const, content: "写下去" }]
    const history = cutoffHistory(origin, "雨下到第四级。")
    expect(history.at(-1)?.content).toBe(CUTOFF_CONTINUE)
    expect(splitCutoff(history)).toEqual({
      carried: "雨下到第四级。",
      origin,
    })
  })

  it("leaves a normal history untouched", () => {
    const history = [{ role: "user" as const, content: "写下去" }]
    expect(splitCutoff(history).origin).toEqual(history)
    expect(splitCutoff(history).carried).toBe("")
  })

  it("accepts only complete tool arguments", () => {
    expect(
      toolArgumentsReady([{ id: "1", name: "append_to_chapter", arguments: '{"text":"雨"}' }])
    ).toBe(true)
    expect(
      toolArgumentsReady([{ id: "1", name: "append_to_chapter", arguments: '{"text":' }])
    ).toBe(false)
  })

  it("reads a cutoff checkpoint and ignores a write approval", () => {
    const raw = JSON.stringify({
      kind: "cutoff",
      round: 1,
      history: [{ role: "user", content: "写下去" }],
      edits: [],
    })
    expect(readCutoff(raw)?.round).toBe(1)
    expect(readCutoff(JSON.stringify({ pending: [], round: 0, preface: "" }))).toBeNull()
  })
})
