import { describe, it, expect } from "vitest"
import { getMomentForMatch, MOMENTS, ALL_MOMENT_KEYS } from "./moments.js"

describe("moments module", () => {
  it("returns maradona_1986 for Argentina vs England", () => {
    expect(getMomentForMatch("Argentina", "England").key).toBe("maradona_1986")
  })

  it("is symmetric — home/away order doesn't matter", () => {
    const a = getMomentForMatch("Germany", "Brazil")
    const b = getMomentForMatch("Brazil", "Germany")
    expect(a.key).toBe(b.key)
  })

  it("uses home team fallback when no pair match", () => {
    expect(getMomentForMatch("Brazil", "Morocco").key).toBe("ronaldo_2002")
  })

  it("uses away team fallback when home team has no entry", () => {
    expect(getMomentForMatch("Morocco", "Germany").key).toBe("klose_2014")
  })

  it("falls back to maradona_1986 for unknown teams", () => {
    expect(getMomentForMatch("Iceland", "Ecuador").key).toBe("maradona_1986")
  })

  it("every moment has required fields", () => {
    Object.values(MOMENTS).forEach((m) => {
      expect(m.key).toBeTruthy()
      expect(m.title).toBeTruthy()
      expect(m.subtitle).toBeTruthy()
      expect(m.year).toBeGreaterThan(1960)
      expect(m.imageUrl).toMatch(/^https:\/\//)
    })
  })

  it("ALL_MOMENT_KEYS entries all exist in MOMENTS", () => {
    ALL_MOMENT_KEYS.forEach((k) => expect(MOMENTS[k]).toBeDefined())
  })
})
