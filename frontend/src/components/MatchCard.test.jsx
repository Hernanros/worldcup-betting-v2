import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import MatchCard from "./MatchCard.jsx"

const upcoming = {
  id: 1, home_team: "Argentina", away_team: "Brazil",
  kickoff_time: "2026-06-20T18:00:00Z", status: "upcoming",
  home_score: null, away_score: null, round: "group",
}

const live = {
  ...upcoming, status: "locked",
  home_score: 2, away_score: 1,
}

describe("MatchCard", () => {
  it("renders team names", () => {
    render(<MemoryRouter><MatchCard match={upcoming} /></MemoryRouter>)
    expect(screen.getByText("Argentina")).toBeInTheDocument()
    expect(screen.getByText("Brazil")).toBeInTheDocument()
  })

  it("shows score when available", () => {
    render(<MemoryRouter><MatchCard match={live} /></MemoryRouter>)
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("shows kickoff time for upcoming", () => {
    render(<MemoryRouter><MatchCard match={upcoming} /></MemoryRouter>)
    expect(screen.getByText(/Jun/)).toBeInTheDocument()
  })
})
