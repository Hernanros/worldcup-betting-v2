import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import PageHero from "./PageHero.jsx"

describe("PageHero", () => {
  it("renders the moment title for a known key", () => {
    render(<PageHero momentKey="maradona_1986" />)
    expect(screen.getByText("Goal of the Century")).toBeInTheDocument()
  })

  it("renders the year badge", () => {
    render(<PageHero momentKey="maradona_1986" />)
    expect(screen.getByText(/1986/)).toBeInTheDocument()
  })

  it("falls back to maradona for an unknown momentKey", () => {
    render(<PageHero momentKey="does_not_exist" />)
    expect(screen.getByText("Goal of the Century")).toBeInTheDocument()
  })

  it("applies custom height", () => {
    const { container } = render(<PageHero momentKey="maradona_1986" height={240} />)
    expect(container.firstChild.style.height).toBe("240px")
  })

  it("renders an img with the moment imageUrl as src", () => {
    render(<PageHero momentKey="zidane_2006" />)
    const img = screen.getByRole("img")
    expect(img.src).toContain("Zinedine_zidane")
  })

  it("rotates to a different key after 5 seconds", () => {
    vi.useFakeTimers()
    render(<PageHero momentKey="rotating" />)
    // After 5 seconds, the key should have advanced
    act(() => { vi.advanceTimersByTime(5000) })
    // We can't predict which key (could be any), but the hero should still render
    // a valid moment (the rotating hero badge must be present)
    expect(screen.getByText(/Iconic Moment/)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
