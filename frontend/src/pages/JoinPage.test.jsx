import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import JoinPage from "./JoinPage"

// Mock @react-oauth/google — provides a fake GoogleLogin button
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess, onError }) => (
    <button
      data-testid="google-login-btn"
      onClick={() => onSuccess({ credential: "fake-id-token" })}
    >
      Sign in with Google
    </button>
  ),
}))

// Mock api.js
vi.mock("../api.js", () => ({
  api: {
    post: vi.fn(),
  },
}))

// Mock auth.js
vi.mock("../auth.js", () => ({
  setAuth: vi.fn(),
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { api } from "../api.js"
import { setAuth } from "../auth.js"

function renderJoinPage() {
  return render(
    <MemoryRouter>
      <JoinPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("JoinPage — Google OAuth flow", () => {
  it("renders the Google login button", () => {
    renderJoinPage()
    expect(screen.getByTestId("google-login-btn")).toBeInTheDocument()
  })

  it("renders the admin login toggle link", () => {
    renderJoinPage()
    expect(screen.getByText(/admin login/i)).toBeInTheDocument()
  })

  it("returning player: clicking Google button calls API and redirects", async () => {
    api.post.mockResolvedValue({
      status: "ok",
      token: "jwt-abc",
      player: { id: 1, name: "Hernan", token_balance: 1000 },
      league: { id: 1, name: "Test League" },
    })

    renderJoinPage()
    fireEvent.click(screen.getByTestId("google-login-btn"))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/api/auth/google", { id_token: "fake-id-token" })
      expect(setAuth).toHaveBeenCalledWith("jwt-abc", expect.objectContaining({ name: "Hernan" }), expect.objectContaining({ name: "Test League" }))
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  it("new player: API returns new_player status → shows invite code form", async () => {
    api.post.mockResolvedValue({
      status: "new_player",
      google_name: "Hernan Rosenblum",
      google_email: "hernan@gmail.com",
    })

    renderJoinPage()
    fireEvent.click(screen.getByTestId("google-login-btn"))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/invite code/i)).toBeInTheDocument()
      // Pre-filled display name field
      expect(screen.getByDisplayValue("Hernan Rosenblum")).toBeInTheDocument()
    })
  })

  it("new player: submitting invite code registers and redirects", async () => {
    // First call → new_player
    api.post.mockResolvedValueOnce({
      status: "new_player",
      google_name: "Hernan Rosenblum",
      google_email: "hernan@gmail.com",
    })
    // Second call → ok
    api.post.mockResolvedValueOnce({
      status: "ok",
      token: "jwt-xyz",
      player: { id: 2, name: "Hernan Rosenblum", token_balance: 1000 },
      league: { id: 1, name: "Test League" },
    })

    renderJoinPage()
    fireEvent.click(screen.getByTestId("google-login-btn"))

    await waitFor(() => screen.getByPlaceholderText(/invite code/i))

    fireEvent.change(screen.getByPlaceholderText(/invite code/i), {
      target: { value: "friends2026" },
    })
    fireEvent.click(screen.getByRole("button", { name: /join the game/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenLastCalledWith("/api/auth/google", {
        id_token: "fake-id-token",
        invite_code: "friends2026",
        display_name: "Hernan Rosenblum",
      })
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  it("admin toggle reveals the name+code form", () => {
    renderJoinPage()
    // Admin form not visible initially
    expect(screen.queryByPlaceholderText(/your name/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/admin login/i))

    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/admin code/i)).toBeInTheDocument()
  })
})
