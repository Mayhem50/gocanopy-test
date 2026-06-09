import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import { App } from "./App"

describe("App", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/projection/charts/spend-mix")) {
        return new Response(
          JSON.stringify({
            ok: true,
            spendMix: {
              slices: [],
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      if (url.endsWith("/projection/merchant-transactions")) {
        return new Response(
          JSON.stringify({
            merchantTransactions: {
              rows: [],
            },
            ok: true,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      throw new Error(`unmocked_fetch_${url}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the dashboard shell and both upload actions", async () => {
    render(<App />)

    expect(
      await screen.findByRole("heading", {
        name: /front dashboard with one receipt flow and one bank account flow/i,
      }),
    ).toBeDefined()
    expect(
      screen.getByRole("heading", { name: /upload receipts/i }),
    ).toBeDefined()
    expect(
      screen.getByRole("heading", { name: /upload bank account/i }),
    ).toBeDefined()
  })

  it("configures receipt upload for png and jpeg, and account upload for csv", async () => {
    const { container } = render(<App />)

    await screen.findByRole("heading", {
      name: /front dashboard with one receipt flow and one bank account flow/i,
    })

    const fileInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    )

    expect(fileInputs).toHaveLength(2)
    expect(fileInputs[0]?.accept).toBe(".png,.jpeg,.jpg,image/png,image/jpeg")
    expect(fileInputs[0]?.multiple).toBe(false)
    expect(fileInputs[1]?.accept).toBe(".csv,text/csv")
    expect(fileInputs[1]?.multiple).toBe(false)
  })
})
