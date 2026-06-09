import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { bindProjectionRoutes } from "./index"
import type { ProjectionHandler } from "./types"

describe("bindProjectionRoutes", () => {
  it("binds the spend mix route", async () => {
    const app = new Hono()
    const handler: ProjectionHandler = {
      getMerchantTransactions: vi.fn(async () => ({
        rows: [],
      })),
      getSpendMix: vi.fn(async () => ({
        slices: [
          {
            amount: 42.5,
            label: "Restaurant",
          },
          {
            amount: 17.2,
            label: "Unlabeled",
          },
        ],
      })),
      projectReceipt: vi.fn(async () => ({
        summary: {
          ambiguousCount: 1,
          bankOnlyCount: 0,
          candidateCount: 2,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 1,
          merchantCount: 1,
        },
        trigger: "receipt" as const,
      })),
      projectStatement: vi.fn(async () => ({
        summary: {
          ambiguousCount: 0,
          bankOnlyCount: 0,
          candidateCount: 0,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 0,
          merchantCount: 0,
        },
        trigger: "statement" as const,
      })),
    }

    bindProjectionRoutes(app, handler)

    const response = await app.request(
      "http://localhost/projection/charts/spend-mix",
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      spendMix: {
        slices: [
          {
            amount: 42.5,
            label: "Restaurant",
          },
          {
            amount: 17.2,
            label: "Unlabeled",
          },
        ],
      },
    })
    expect(handler.getSpendMix).toHaveBeenCalledOnce()
  })

  it("binds the merchant transactions route", async () => {
    const app = new Hono()
    const handler: ProjectionHandler = {
      getMerchantTransactions: vi.fn(async () => ({
        rows: [
          {
            amount: 42.5,
            currency: "EUR",
            effectiveDate: "2026-06-09",
            label: "Restaurant",
            matchStatus: "reconciled" as const,
            merchantTransactionId: "merchant-1",
            merchantName: "Caffe Nero",
          },
        ],
      })),
      getSpendMix: vi.fn(async () => ({
        slices: [],
      })),
      projectReceipt: vi.fn(async () => ({
        summary: {
          ambiguousCount: 1,
          bankOnlyCount: 0,
          candidateCount: 2,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 1,
          merchantCount: 1,
        },
        trigger: "receipt" as const,
      })),
      projectStatement: vi.fn(async () => ({
        summary: {
          ambiguousCount: 0,
          bankOnlyCount: 0,
          candidateCount: 0,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 0,
          merchantCount: 0,
        },
        trigger: "statement" as const,
      })),
    }

    bindProjectionRoutes(app, handler)

    const response = await app.request(
      "http://localhost/projection/merchant-transactions",
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      merchantTransactions: {
        rows: [
          {
            amount: 42.5,
            currency: "EUR",
            effectiveDate: "2026-06-09",
            label: "Restaurant",
            matchStatus: "reconciled",
            merchantTransactionId: "merchant-1",
            merchantName: "Caffe Nero",
          },
        ],
      },
      ok: true,
    })
    expect(handler.getMerchantTransactions).toHaveBeenCalledOnce()
  })

  it("binds the receipt projection route", async () => {
    const app = new Hono()
    const handler: ProjectionHandler = {
      getMerchantTransactions: vi.fn(async () => ({
        rows: [],
      })),
      getSpendMix: vi.fn(async () => ({
        slices: [],
      })),
      projectReceipt: vi.fn(async () => ({
        summary: {
          ambiguousCount: 1,
          bankOnlyCount: 0,
          candidateCount: 2,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 1,
          merchantCount: 1,
        },
        trigger: "receipt" as const,
      })),
      projectStatement: vi.fn(async () => ({
        summary: {
          ambiguousCount: 0,
          bankOnlyCount: 0,
          candidateCount: 0,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 0,
          merchantCount: 0,
        },
        trigger: "statement" as const,
      })),
    }

    bindProjectionRoutes(app, handler)

    const response = await app.request(
      "http://localhost/projection/receipts",
      {
        body: JSON.stringify({
          receiptId: "receipt-1",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      projection: {
        summary: {
          ambiguousCount: 1,
          bankOnlyCount: 0,
          candidateCount: 2,
          cashCount: 0,
          receiptOnlyCount: 0,
          reconciledCount: 1,
          merchantCount: 1,
        },
        trigger: "receipt",
      },
    })
    expect(handler.projectReceipt).toHaveBeenCalledWith({
      receiptId: "receipt-1",
    })
  })

  it("validates statement projection input", async () => {
    const app = new Hono()
    const handler: ProjectionHandler = {
      getMerchantTransactions: vi.fn(),
      getSpendMix: vi.fn(),
      projectReceipt: vi.fn(),
      projectStatement: vi.fn(),
    }

    bindProjectionRoutes(app, handler)

    const response = await app.request(
      "http://localhost/projection/statements",
      {
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_input",
      ok: false,
    })
    expect(handler.projectStatement).not.toHaveBeenCalled()
  })
})
