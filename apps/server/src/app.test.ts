import { describe, expect, it } from "vitest"

import { createApp } from "./app"

describe("createApp", () => {
  it("returns the server metadata on GET /", async () => {
    const app = createApp()
    const response = await app.request("http://localhost/")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "gocanopy-server",
    })
  })

  it("returns healthy on GET /health", async () => {
    const app = createApp()
    const response = await app.request("http://localhost/health")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it("binds the scan receipt route on POST /scan/receipts", async () => {
    const app = createApp()
    const formData = new FormData()
    const response = await app.request("http://localhost/scan/receipts", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_input",
    })
  })

  it("binds the bank statement route on POST /bank/statements", async () => {
    const app = createApp()
    const response = await app.request("http://localhost/bank/statements", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_input",
    })
  })

  it("binds the receipt projection route on POST /projection/receipts", async () => {
    const app = createApp()
    const response = await app.request("http://localhost/projection/receipts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_input",
    })
  })

  it("binds the spend mix route on GET /projection/charts/spend-mix", async () => {
    const app = createApp()
    const response = await app.request(
      "http://localhost/projection/charts/spend-mix",
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      spendMix: {
        slices: expect.any(Array),
      },
    })
  })

  it("binds the merchant transactions route on GET /projection/merchant-transactions", async () => {
    const app = createApp()
    const response = await app.request(
      "http://localhost/projection/merchant-transactions",
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      merchantTransactions: {
        rows: expect.any(Array),
      },
      ok: true,
    })
  })

  it("binds the statement projection route on POST /projection/statements", async () => {
    const app = createApp()
    const response = await app.request(
      "http://localhost/projection/statements",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_input",
    })
  })
})
