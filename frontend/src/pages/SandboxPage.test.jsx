import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { computePreview } from "./SandboxPage.jsx"

const MATCH_WITH_ODDS = {
  id: 1, home_team: "Argentina", away_team: "Brazil",
  status: "upcoming", kickoff_time: "2026-06-20T18:00:00Z",
  odds: { "1x2": [
    { name: "Home Win", price: 2.5 },
    { name: "Draw", price: 3.2 },
    { name: "Away Win", price: 2.8 },
  ]},
}

const MATCH_NO_ODDS = { ...MATCH_WITH_ODDS, odds: null }

describe("computePreview", () => {
  it("returns winning payout when home leads and outcome is home_win", () => {
    const r = computePreview(2, 1, 67, 300, "home_win", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(true)
    expect(r.payout).toBe(750)      // 300 * 2.5
    expect(r.netChange).toBe(450)   // 750 - 300
  })

  it("returns zero payout when losing", () => {
    const r = computePreview(0, 1, 67, 300, "home_win", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(false)
    expect(r.payout).toBe(0)
    expect(r.netChange).toBe(-300)
  })

  it("recognises draw correctly", () => {
    const r = computePreview(1, 1, 45, 100, "draw", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(true)
    expect(r.payout).toBe(320)      // 100 * 3.2
  })

  it("recognises away win", () => {
    const r = computePreview(0, 2, 80, 200, "away_win", MATCH_WITH_ODDS)
    expect(r.isCurrentlyWinning).toBe(true)
    expect(r.payout).toBe(560)      // 200 * 2.8
  })

  it("falls back to default odds when match has no odds", () => {
    const r = computePreview(2, 1, 60, 200, "home_win", MATCH_NO_ODDS)
    expect(r.oddsValue).toBe(2.5)
    expect(r.payout).toBe(500)      // 200 * 2.5
  })

  it("floors payout to integer", () => {
    const r = computePreview(0, 1, 50, 100, "away_win", MATCH_WITH_ODDS)
    expect(Number.isInteger(r.payout)).toBe(true)
  })
})
