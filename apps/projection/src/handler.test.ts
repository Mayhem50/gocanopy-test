import { describe, expect, it, vi } from "vitest"

import { ProjectionTargetNotFoundError } from "./errors"
import { createProjectionHandler } from "./handler"
import { createRuleBasedLabelingService } from "./providers/labeling"
import type { ProjectionProviders } from "./providers/index"

const canonicalFacts = {
  bankTransactions: [
    {
      amount: "-9.95",
      bankTransactionId: "txn-1",
      currency: "EUR",
      descriptionNormalized: "caffe nero ifsc dublin",
      descriptionRaw: "CAFFE NERO IFSC DUBLIN",
      postedOn: "2026-06-02",
      sourceRowNumber: 2,
      statementImportId: "statement-1",
    },
    {
      amount: "-15.30",
      bankTransactionId: "txn-2",
      currency: "EUR",
      descriptionNormalized: "boots 6612 dublin",
      descriptionRaw: "BOOTS 6612 DUBLIN",
      postedOn: "2026-06-08",
      sourceRowNumber: 8,
      statementImportId: "statement-1",
    },
    {
      amount: "-15.30",
      bankTransactionId: "txn-3",
      currency: "EUR",
      descriptionNormalized: "boots 6612 dublin",
      descriptionRaw: "BOOTS 6612 DUBLIN",
      postedOn: "2026-06-09",
      sourceRowNumber: 9,
      statementImportId: "statement-1",
    },
    {
      amount: "-11.99",
      bankTransactionId: "txn-4",
      currency: "EUR",
      descriptionNormalized: "spotify premium",
      descriptionRaw: "SPOTIFY PREMIUM",
      postedOn: "2026-06-10",
      sourceRowNumber: 10,
      statementImportId: "statement-1",
    },
    {
      amount: "-88.00",
      bankTransactionId: "txn-5",
      currency: "EUR",
      descriptionNormalized: "sq pigs ear rest 4471",
      descriptionRaw: "SQ *PIGS EAR REST 4471",
      postedOn: "2026-06-05",
      sourceRowNumber: 5,
      statementImportId: "statement-1",
    },
  ],
  receipts: [
    {
      cardLast4: "4471",
      contentHash: "hash-1",
      currency: "EUR",
      merchantName: "Caffe Nero",
      originalImageExtension: ".png",
      paymentMethod: "card",
      purchasedAt: "2026-06-01",
      receiptId: "receipt-1",
      totalAmount: "9.95",
      vatId: "IE111111A",
    },
    {
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
    {
      cardLast4: null,
      contentHash: "hash-3",
      currency: "EUR",
      merchantName: "Bray Farmers Market",
      originalImageExtension: ".png",
      paymentMethod: "cash",
      purchasedAt: "2026-06-06",
      receiptId: "receipt-3",
      totalAmount: "7.00",
      vatId: "IE333333C",
    },
    {
      cardLast4: "4471",
      contentHash: "hash-4",
      currency: "EUR",
      merchantName: "The Pig's Ear",
      originalImageExtension: ".png",
      paymentMethod: "card",
      purchasedAt: "2026-06-03",
      receiptId: "receipt-4",
      totalAmount: "78.00",
      vatId: "IE444444D",
    },
  ],
}

describe("createProjectionHandler", () => {
  it("rebuilds projection tables from canonical facts", async () => {
    const providers: ProjectionProviders = {
      labelingService: createRuleBasedLabelingService(),
      projectionStore: {
        getMerchantTransactionTableRows: vi.fn(async () => []),
        getSpendMixSlices: vi.fn(async () => []),
        loadCanonicalFacts: vi
          .fn()
          .mockResolvedValueOnce(canonicalFacts)
          .mockResolvedValueOnce(canonicalFacts),
        replaceProjectionSnapshot: vi.fn(async () => undefined),
      },
    }

    const handler = createProjectionHandler(providers)
    const result = await handler.projectReceipt({
      receiptId: "receipt-2",
    })

    expect(result).toEqual({
      summary: {
        ambiguousCount: 2,
        bankOnlyCount: 2,
        candidateCount: 4,
        cashCount: 1,
        receiptOnlyCount: 0,
        reconciledCount: 1,
        merchantCount: 5,
      },
      trigger: "receipt",
    })
    expect(providers.projectionStore.replaceProjectionSnapshot).toHaveBeenCalledOnce()
    expect(providers.projectionStore.replaceProjectionSnapshot).toHaveBeenCalledWith({
      snapshot: expect.objectContaining({
        bankTransactionReceipts: expect.arrayContaining([
          {
            associationRole: "best_match",
            bankTransactionId: "txn-2",
            receiptId: "receipt-2",
          },
          {
            associationRole: "other_match",
            bankTransactionId: "txn-3",
            receiptId: "receipt-2",
          },
        ]),
        merchantTransactions: expect.arrayContaining([
          expect.objectContaining({
            matchStatus: "reconciled",
            sourceBankTransactionId: "txn-1",
            sourceReceiptId: "receipt-1",
          }),
          expect.objectContaining({
            matchStatus: "ambiguous",
            sourceBankTransactionId: "txn-2",
            sourceReceiptId: "receipt-2",
          }),
          expect.objectContaining({
            matchStatus: "cash",
            sourceReceiptId: "receipt-3",
          }),
          expect.objectContaining({
            matchStatus: "ambiguous",
            sourceBankTransactionId: "txn-5",
            sourceReceiptId: "receipt-4",
          }),
          expect.objectContaining({
            matchStatus: "bank_only",
            sourceBankTransactionId: "txn-4",
          }),
        ]),
        labelAssignments: expect.arrayContaining([
          expect.objectContaining({
            labelId: "restaurant",
            merchantTransactionId: "receipt:receipt-1",
          }),
          expect.objectContaining({
            labelId: "pharmacy",
            merchantTransactionId: "receipt:receipt-2",
          }),
          expect.objectContaining({
            labelId: "grocery",
            merchantTransactionId: "receipt:receipt-3",
          }),
          expect.objectContaining({
            labelId: "subscription",
            merchantTransactionId: "bank:txn-4",
          }),
        ]),
      }),
      target: {
        receiptId: "receipt-2",
        type: "receipt",
      },
    })
  })

  it("rejects missing targets before writing projection tables", async () => {
    const providers: ProjectionProviders = {
      labelingService: createRuleBasedLabelingService(),
      projectionStore: {
        getMerchantTransactionTableRows: vi.fn(async () => []),
        getSpendMixSlices: vi.fn(async () => []),
        loadCanonicalFacts: vi.fn(async () => ({
          bankTransactions: [],
          receipts: [],
        })),
        replaceProjectionSnapshot: vi.fn(async () => undefined),
      },
    }

    const handler = createProjectionHandler(providers)

    await expect(
      handler.projectStatement({
        statementImportId: "missing-statement",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "statement_import_not_found",
      }),
    )
    expect(
      providers.projectionStore.replaceProjectionSnapshot,
    ).not.toHaveBeenCalled()
    await expect(
      handler.projectReceipt({
        receiptId: "missing-receipt",
      }),
    ).rejects.toBeInstanceOf(ProjectionTargetNotFoundError)
  })
})
