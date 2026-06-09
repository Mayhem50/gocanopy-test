import { describe, expect, it } from "vitest"

import { createReceiptFieldExtractor } from "./field-extractor"

describe("createReceiptFieldExtractor", () => {
  it("extracts structured receipt fields with confidence", async () => {
    const provider = createReceiptFieldExtractor()
    const result = await provider.extractReceiptFields({
      ocrTextRaw:
        "Boots\nVAT REG IE938241L\n2026-06-08\nVitamin C 15.30\nVAT EUR 2.30\nVISA ending 4471\nEUR 15.30",
      lines: [
        { text: "Boots", confidence: 0.97 },
        { text: "VAT REG IE938241L", confidence: 0.99 },
        { text: "2026-06-08", confidence: 0.94 },
        { text: "Vitamin C 15.30", confidence: 0.86 },
        { text: "VAT EUR 2.30", confidence: 0.9 },
        { text: "VISA ending 4471", confidence: 0.95 },
        { text: "EUR 15.30", confidence: 0.98 },
      ],
    })

    expect(result).toEqual({
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
        confidence: 0.9,
      },
      currency: {
        value: "EUR",
        confidence: 0.98,
      },
      paymentMethod: {
        value: "card",
        confidence: 0.95,
      },
      cardLast4: {
        value: "4471",
        confidence: 0.95,
      },
      items: [
        {
          description: "Vitamin C",
          quantity: null,
          unitPrice: null,
          amount: {
            value: "15.30",
            confidence: 0.86,
          },
          confidence: 0.86,
        },
      ],
      errors: [],
      warnings: [],
    })
  })

  it("returns errors for missing required fields and warnings for optional fields", async () => {
    const provider = createReceiptFieldExtractor()
    const result = await provider.extractReceiptFields({
      ocrTextRaw: "UNKNOWN",
      lines: [{ text: "VAT REG IE938241L", confidence: 0.99 }],
    })

    expect(result.merchant).toBeNull()
    expect(result.vatId).toEqual({
      value: "IE938241L",
      confidence: 0.99,
    })
    expect(result.purchasedOn).toBeNull()
    expect(result.totalAmount).toBeNull()
    expect(result.vatAmount).toBeNull()
    expect(result.currency).toBeNull()
    expect(result.paymentMethod).toBeNull()
    expect(result.cardLast4).toBeNull()
    expect(result.items).toEqual([])
    expect(result.errors).toEqual([
      "merchant_not_found",
      "purchased_on_not_found",
      "total_amount_not_found",
      "currency_not_found",
    ])
    expect(result.warnings).toEqual([
      "vat_amount_not_found",
      "payment_method_not_found",
      "items_not_found",
    ])
  })

  it("supports OCR fallback lines from raw text without mistaking APPROVED for a VAT id", async () => {
    const provider = createReceiptFieldExtractor()
    const lines = [
      "Boots",
      "Henry Street, Dublin 1",
      "08/06/2026   13:55",
      "Vitamin D3 1000IU           7.49",
      "Toothpaste                  3.81",
      "Plasters Asst               4.00",
      "Subtotal                    15.30",
      "VAT @ 23%                       0.00",
      "TOTAL EUR                 15.30",
      "CARD VISA ****4471",
      "APPROVED - AUTH 077741",
      "R7 VAT REG IE938247L",
      "Thank you",
    ]
    const result = await provider.extractReceiptFields({
      ocrTextRaw: lines.join("\n"),
      lines: lines.map((text) => ({ text, confidence: null })),
    })

    expect(result.merchant).toEqual({
      value: "Boots",
      confidence: null,
    })
    expect(result.vatId).toEqual({
      value: "IE938247L",
      confidence: null,
    })
    expect(result.purchasedOn).toEqual({
      value: "2026-06-08",
      confidence: null,
    })
    expect(result.totalAmount).toEqual({
      value: "15.30",
      confidence: null,
    })
    expect(result.currency).toEqual({
      value: "EUR",
      confidence: null,
    })
    expect(result.paymentMethod).toEqual({
      value: "card",
      confidence: null,
    })
    expect(result.cardLast4).toEqual({
      value: "4471",
      confidence: null,
    })
    expect(result.items).toEqual([
      {
        description: "Vitamin D3 1000IU",
        quantity: null,
        unitPrice: null,
        amount: {
          value: "7.49",
          confidence: null,
        },
        confidence: null,
      },
      {
        description: "Toothpaste",
        quantity: null,
        unitPrice: null,
        amount: {
          value: "3.81",
          confidence: null,
        },
        confidence: null,
      },
      {
        description: "Plasters Asst",
        quantity: null,
        unitPrice: null,
        amount: {
          value: "4.00",
          confidence: null,
        },
        confidence: null,
      },
    ])
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual(["vat_amount_not_found"])
  })

  it("normalizes two-digit years to the 2000s", async () => {
    const provider = createReceiptFieldExtractor()
    const result = await provider.extractReceiptFields({
      ocrTextRaw: "TESCO\n04/06/26 18:03\nVAT REG IE938243L\nTOTAL EUR 20.15",
      lines: [
        { text: "TESCO", confidence: null },
        { text: "04/06/26 18:03", confidence: null },
        { text: "VAT REG IE938243L", confidence: null },
        { text: "TOTAL EUR 20.15", confidence: null },
      ],
    })

    expect(result.purchasedOn).toEqual({
      value: "2026-06-04",
      confidence: null,
    })
  })

  it("supports month names in dates", async () => {
    const provider = createReceiptFieldExtractor()
    const result = await provider.extractReceiptFields({
      ocrTextRaw:
        "BRAY FARMERS MARKET\n06 Jun 2026\nVAT REG IE938246L\nTOTAL EUR 7.00",
      lines: [
        { text: "BRAY FARMERS MARKET", confidence: null },
        { text: "06 Jun 2026", confidence: null },
        { text: "VAT REG IE938246L", confidence: null },
        { text: "TOTAL EUR 7.00", confidence: null },
      ],
    })

    expect(result.purchasedOn).toEqual({
      value: "2026-06-06",
      confidence: null,
    })
  })
})
