import { describe, expect, it } from "vitest"

import { createRuleBasedLabelingService } from "./labeling"

const labelingService = createRuleBasedLabelingService()

describe("createRuleBasedLabelingService", () => {
  it("labels both receipt-backed and bank-only transactions with simple rules", () => {
    expect(
      labelingService.suggestLabel({
        bankTransaction: {
          amount: "-11.99",
          bankTransactionId: "txn-spotify",
          currency: "EUR",
          descriptionNormalized: "spotify premium",
          descriptionRaw: "SPOTIFY PREMIUM",
          postedOn: "2026-06-10",
          sourceRowNumber: 10,
          statementImportId: "statement-1",
        },
        merchantTransaction: {
          amount: "11.99",
          currency: "EUR",
          effectiveDate: "2026-06-10",
          matchStatus: "bank_only",
          merchantTransactionId: "bank:txn-spotify",
          postedDate: "2026-06-10",
          merchantId: "merchant:spotify-premium",
          vatId: null,
          sourceBankTransactionId: "txn-spotify",
          sourceReceiptId: null,
        },
        receipt: null,
        merchant: {
          aliases: ["SPOTIFY PREMIUM"],
          displayName: "Spotify Premium",
          merchantId: "merchant:spotify-premium",
          vatId: null,
        },
      }),
    ).toEqual({
      labelId: "subscription",
      reason: "bank_keyword:spotify",
      source: "bank_suggestion",
    })

    expect(
      labelingService.suggestLabel({
        bankTransaction: {
          amount: "-15.30",
          bankTransactionId: "txn-boots",
          currency: "EUR",
          descriptionNormalized: "boots 6612 dublin",
          descriptionRaw: "BOOTS 6612 DUBLIN",
          postedOn: "2026-06-08",
          sourceRowNumber: 8,
          statementImportId: "statement-1",
        },
        merchantTransaction: {
          amount: "15.30",
          currency: "EUR",
          effectiveDate: "2026-06-08",
          matchStatus: "ambiguous",
          merchantTransactionId: "receipt:receipt-2",
          postedDate: "2026-06-08",
          merchantId: "vat:IE222222B",
          vatId: "IE222222B",
          sourceBankTransactionId: "txn-boots",
          sourceReceiptId: "receipt-2",
        },
        receipt: {
          cardLast4: "4471",
          contentHash: "hash-2",
          currency: "EUR",
          merchantName: "Boots",
          originalImageExtension: ".png",
          paymentMethod: "card",
          purchasedAt: "2026-06-08",
          receiptId: "receipt-2",
          totalAmount: "15.30",
          vatId: "IE222222B",
        },
        merchant: {
          aliases: ["Boots", "BOOTS 6612 DUBLIN"],
          displayName: "Boots",
          merchantId: "vat:IE222222B",
          vatId: "IE222222B",
        },
      }),
    ).toEqual({
      labelId: "pharmacy",
      reason: "merchant_keyword:boots",
      source: "rule",
    })
  })
})
