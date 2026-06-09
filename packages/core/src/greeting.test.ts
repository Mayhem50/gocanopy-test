import { describe, expect, it } from "vitest"

import { createGreeting } from "./greeting.js"

describe("createGreeting", () => {
  it("greets the provided name", () => {
    expect(createGreeting({ name: "Canopy" })).toBe("Hello, Canopy.")
  })

  it("falls back when the name is blank", () => {
    expect(createGreeting({ name: "   " })).toBe("Hello, GoCanopy.")
  })
})
