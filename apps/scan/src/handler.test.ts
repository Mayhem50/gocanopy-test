import { describe, expect, it, vi } from "vitest"

import { createScanHandler, ScanReceiptRejectedError } from "./handler"
import type { ScanProviders } from "./providers/index"

describe("createScanHandler", () => {
  it("orchestrates providers through the injected factory output", async () => {
    const providers: ScanProviders = {
      imageProcessor: {
        normalizeImage: vi.fn(async () => ({
          contentHash:
            "b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7",
          originalImageExtension: ".png",
          originalImagePath:
            "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-original.png",
          normalizedImagePath: "/tmp/normalized.png",
        })),
      },
      ocr: {
        extractReceiptText: vi.fn(async () => ({
          ocrTextRaw: "VAT REG IE938241L",
          lines: [{ text: "VAT REG IE938241L", confidence: 0.99 }],
        })),
      },
      fieldExtractor: {
        extractReceiptFields: vi.fn(async () => ({
          merchant: {
            value: "Boots",
            confidence: 0.97,
          },
          vatId: {
            value: "IE938241L",
            confidence: 0.99,
          },
          purchasedOn: {
            value: "2026-06-08",
            confidence: 0.94,
          },
          totalAmount: {
            value: "15.30",
            confidence: 0.98,
          },
          vatAmount: {
            value: "2.30",
            confidence: 0.88,
          },
          currency: {
            value: "EUR",
            confidence: 0.98,
          },
          paymentMethod: {
            value: "card" as const,
            confidence: 0.95,
          },
          cardLast4: {
            value: "4471",
            confidence: 0.95,
          },
          items: [],
          errors: [],
          warnings: [],
        })),
      },
      projectionService: {
        projectReceipt: vi.fn(async () => undefined),
      },
      receiptStore: {
        saveReceipt: vi.fn(async (input) => ({
          receiptId: "receipt-1",
          contentHash: input.contentHash,
          originalImageExtension: input.originalImageExtension,
          originalImagePath:
            "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-original.png",
          normalizedImagePath:
            "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-normalized.png",
          ocrTextRaw: input.ocrTextRaw,
          extractedFields: input.extractedFields,
        })),
      },
    }

    const handler = createScanHandler(providers)
    const file = new File([Uint8Array.from([137, 80, 78, 71])], "receipt.png", {
      type: "image/png",
    })
    const receipt = await handler.handle(file)

    expect(providers.imageProcessor.normalizeImage).toHaveBeenCalledWith({
      sourceImageBuffer: Buffer.from(await file.arrayBuffer()),
      sourceImageFileName: "receipt.png",
    })
    expect(providers.ocr.extractReceiptText).toHaveBeenCalledWith({
      normalizedImagePath: "/tmp/normalized.png",
    })
    expect(providers.fieldExtractor.extractReceiptFields).toHaveBeenCalledWith({
      ocrTextRaw: "VAT REG IE938241L",
      lines: [{ text: "VAT REG IE938241L", confidence: 0.99 }],
    })
    expect(providers.receiptStore.saveReceipt).toHaveBeenCalledOnce()
    expect(providers.receiptStore.saveReceipt).toHaveBeenCalledWith({
      contentHash:
        "b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7",
      normalizedImagePath: "/tmp/normalized.png",
      originalImageExtension: ".png",
      originalImagePath:
        "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-original.png",
      ocrTextRaw: "VAT REG IE938241L",
      extractedFields: {
        merchant: {
          value: "Boots",
          confidence: 0.97,
        },
        vatId: {
          value: "IE938241L",
          confidence: 0.99,
        },
        purchasedOn: {
          value: "2026-06-08",
          confidence: 0.94,
        },
        totalAmount: {
          value: "15.30",
          confidence: 0.98,
        },
        vatAmount: {
          value: "2.30",
          confidence: 0.88,
        },
        currency: {
          value: "EUR",
          confidence: 0.98,
        },
        paymentMethod: {
          value: "card" as const,
          confidence: 0.95,
        },
        cardLast4: {
          value: "4471",
          confidence: 0.95,
        },
        items: [],
        errors: [],
        warnings: [],
      },
    })
    expect(providers.projectionService.projectReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId: "receipt-1",
      }),
    )
    expect(receipt.receiptId).toBe("receipt-1")
    expect(receipt.originalImageExtension).toBe(".png")
    expect(receipt.originalImagePath).toBe(
      "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-original.png",
    )
    expect(receipt.normalizedImagePath).toBe(
      "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-normalized.png",
    )
    expect(receipt.ocrTextRaw).toBe("VAT REG IE938241L")
    expect(receipt.extractedFields).toEqual({
      merchant: {
        value: "Boots",
        confidence: 0.97,
      },
      vatId: {
        value: "IE938241L",
        confidence: 0.99,
      },
      purchasedOn: {
        value: "2026-06-08",
        confidence: 0.94,
      },
      totalAmount: {
        value: "15.30",
        confidence: 0.98,
      },
      vatAmount: {
        value: "2.30",
        confidence: 0.88,
      },
      currency: {
        value: "EUR",
        confidence: 0.98,
      },
      paymentMethod: {
        value: "card" as const,
        confidence: 0.95,
      },
      cardLast4: {
        value: "4471",
        confidence: 0.95,
      },
      items: [],
      errors: [],
      warnings: [],
    })
    expect(receipt.contentHash).toBe(
      "b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7",
    )
  })

  it("processes uploaded receipts directly from the file buffer", async () => {
    const file = new File([Uint8Array.from([137, 80, 78, 71])], "receipt.png", {
      type: "image/png",
    })
    const providers: ScanProviders = {
      imageProcessor: {
        normalizeImage: vi.fn(async () => ({
          contentHash:
            "b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7",
          originalImageExtension: ".png",
          originalImagePath:
            "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-original.png",
          normalizedImagePath: "/tmp/normalized.png",
        })),
      },
      ocr: {
        extractReceiptText: vi.fn(async () => ({
          ocrTextRaw: "VAT REG IE938241L",
          lines: [{ text: "VAT REG IE938241L", confidence: 0.99 }],
        })),
      },
      fieldExtractor: {
        extractReceiptFields: vi.fn(async () => ({
          merchant: null,
          vatId: {
            value: "IE938241L",
            confidence: 0.99,
          },
          purchasedOn: {
            value: "2026-06-08",
            confidence: 0.94,
          },
          totalAmount: {
            value: "15.30",
            confidence: 0.98,
          },
          vatAmount: null,
          currency: {
            value: "EUR",
            confidence: 0.98,
          },
          paymentMethod: null,
          cardLast4: null,
          items: [],
          errors: [],
          warnings: [],
        })),
      },
      projectionService: {
        projectReceipt: vi.fn(async () => undefined),
      },
      receiptStore: {
        saveReceipt: vi.fn(async (input) => ({
          receiptId: "receipt-1",
          contentHash: input.contentHash,
          originalImageExtension: input.originalImageExtension,
          originalImagePath: input.originalImagePath,
          normalizedImagePath: input.normalizedImagePath,
          ocrTextRaw: input.ocrTextRaw,
          extractedFields: input.extractedFields,
        })),
      },
    }

    const handler = createScanHandler(providers)

    await handler.handle(file)

    expect(providers.imageProcessor.normalizeImage).toHaveBeenCalledWith({
      sourceImageBuffer: Buffer.from(await file.arrayBuffer()),
      sourceImageFileName: "receipt.png",
    })
  })

  it("rejects the receipt when required extracted fields are missing", async () => {
    const providers: ScanProviders = {
      imageProcessor: {
        normalizeImage: vi.fn(async () => ({
          contentHash:
            "b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7",
          originalImageExtension: ".png",
          originalImagePath:
            "/tmp/blob/b7ba2cec242b24876dc84847991ebefc39c952d09e7e744673d017669480dcc7-original.png",
          normalizedImagePath: "/tmp/normalized.png",
        })),
      },
      ocr: {
        extractReceiptText: vi.fn(async () => ({
          ocrTextRaw: "unknown",
          lines: [{ text: "unknown", confidence: 0.2 }],
        })),
      },
      fieldExtractor: {
        extractReceiptFields: vi.fn(async () => ({
          merchant: null,
          vatId: null,
          purchasedOn: null,
          totalAmount: null,
          vatAmount: null,
          currency: null,
          paymentMethod: null,
          cardLast4: null,
          items: [],
          errors: [
            "merchant_not_found",
            "vat_id_not_found",
            "purchased_on_not_found",
            "total_amount_not_found",
            "currency_not_found",
          ],
          warnings: [
            "vat_amount_not_found",
            "payment_method_not_found",
            "items_not_found",
          ],
        })),
      },
      projectionService: {
        projectReceipt: vi.fn(async () => undefined),
      },
      receiptStore: {
        saveReceipt: vi.fn(),
      },
    }

    const handler = createScanHandler(providers)

    const file = new File([Uint8Array.from([137, 80, 78, 71])], "receipt.png", {
      type: "image/png",
    })

    await expect(handler.handle(file)).rejects.toBeInstanceOf(
      ScanReceiptRejectedError,
    )
    expect(providers.receiptStore.saveReceipt).not.toHaveBeenCalled()
    expect(
      providers.projectionService.projectReceipt,
    ).not.toHaveBeenCalled()
  })
})
