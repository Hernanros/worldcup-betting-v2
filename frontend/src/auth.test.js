import { describe, it, expect, beforeEach } from "vitest"
import { setAuth, getToken, getPlayer, clearAuth, isLoggedIn } from "./auth.js"

describe("auth helpers", () => {
  beforeEach(() => clearAuth())

  it("stores and retrieves token", () => {
    setAuth("tok123", { id: 1, name: "Alice" })
    expect(getToken()).toBe("tok123")
  })

  it("stores and retrieves player", () => {
    setAuth("tok", { id: 2, name: "Bob", token_balance: 500 })
    expect(getPlayer().name).toBe("Bob")
    expect(getPlayer().token_balance).toBe(500)
  })

  it("isLoggedIn reflects token presence", () => {
    expect(isLoggedIn()).toBe(false)
    setAuth("tok", { id: 1, name: "X" })
    expect(isLoggedIn()).toBe(true)
  })

  it("clearAuth removes both keys", () => {
    setAuth("tok", { id: 1, name: "Y" })
    clearAuth()
    expect(getToken()).toBeNull()
    expect(getPlayer()).toBeNull()
  })
})
