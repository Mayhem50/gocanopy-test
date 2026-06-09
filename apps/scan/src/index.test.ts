import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { ScanReceiptRejectedError, type ScanHandler } from "./handler"
import { bindScanRoutes } from "./index"

describe("bindScanRoutes", () => {
  it("accepts multipart receipt uploads and forwards the file to the handler", async () => {
    const app = new Hono()
    const handle = vi.fn<ScanHandler["handle"]>(async () => ({
      receiptId: "receipt-1",
      contentHash: "hash-1",
      originalImageExtension: ".png",
      originalImagePath: "/tmp/original.png",
      normalizedImagePath: "/tmp/normalized.png",
      ocrTextRaw: "receipt text",
      extractedFields: {
        merchant: null,
        vatId: null,
        purchasedOn: null,
        totalAmount: null,
        vatAmount: null,
        currency: null,
        paymentMethod: null,
        cardLast4: null,
        items: [],
        errors: [],
        warnings: [],
      },
    }))

    bindScanRoutes(app, { handle })

    const formData = new FormData()
    formData.set(
      "receipt",
      new File([Uint8Array.from([137, 80, 78, 71])], "receipt.png", {
        type: "image/png",
      }),
    )

    const response = await app.request("http://localhost/scan/receipts", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      receipt: { receiptId: "receipt-1" },
    })
    expect(handle).toHaveBeenCalledOnce()
    expect(handle.mock.calls[0]?.[0]).toBeInstanceOf(File)
  })

  it("returns a rejected receipt response when scan extraction fails", async () => {
    const app = new Hono()
    const handle = vi.fn<ScanHandler["handle"]>(async () => {
      throw new ScanReceiptRejectedError({
        merchant: null,
        vatId: null,
        purchasedOn: null,
        totalAmount: null,
        vatAmount: null,
        currency: null,
        paymentMethod: null,
        cardLast4: null,
        items: [],
        errors: ["vat_id_missing"],
        warnings: [],
      })
    })

    bindScanRoutes(app, { handle })

    const formData = new FormData()
    formData.set(
      "receipt",
      new File([Uint8Array.from([255, 216, 255, 224])], "receipt.jpg", {
        type: "image/jpeg",
      }),
    )

    const response = await app.request("http://localhost/scan/receipts", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "receipt_rejected",
      errors: ["vat_id_missing"],
    })
    expect(handle).toHaveBeenCalledOnce()
  })

  it("rejects unsupported multipart receipt types", async () => {
    const app = new Hono()
    const handle = vi.fn<ScanHandler["handle"]>()

    bindScanRoutes(app, { handle })

    const formData = new FormData()
    formData.set(
      "receipt",
      new File(["not-an-image"], "receipt.txt", {
        type: "text/plain",
      }),
    )

    const response = await app.request("http://localhost/scan/receipts", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_input",
      issues: [
        {
          field: "receipt",
          message: "unsupported_receipt_type",
        },
      ],
    })
    expect(handle).not.toHaveBeenCalled()
  })

  it("returns invalid_input when the body is not multipart form data", async () => {
    const app = new Hono()
    const handle = vi.fn<ScanHandler["handle"]>()

    bindScanRoutes(app, { handle })

    const response = await app.request("http://localhost/scan/receipts", {
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
      issues: [
        {
          field: "receipt",
          message: "receipt_file_required",
        },
      ],
    })
    expect(handle).not.toHaveBeenCalled()
  })
})
