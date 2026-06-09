import { randomUUID } from "node:crypto"

import {
  getPostgresDb,
  receiptTable,
} from "@gocanopy/models"
import { eq } from "drizzle-orm"

import {
  getNormalizedImageBlobPath,
  getOriginalImageBlobPath,
} from "./blob-store"
import type {
  ExtractReceiptFieldsResult,
  ReceiptStore,
  SavedReceipt,
} from "./types"
import type { ReceiptRow } from "@gocanopy/models"

function toSavedReceipt(row: ReceiptRow): SavedReceipt {
  return {
    receiptId: row.receiptId,
    contentHash: row.contentHash,
    originalImageExtension: row.originalImageExtension,
    originalImagePath:
      row.sourceImageRaw ||
      getOriginalImageBlobPath({
        contentHash: row.contentHash,
        originalImageExtension: row.originalImageExtension,
      }),
    normalizedImagePath:
      row.normalizedImagePath ||
      getNormalizedImageBlobPath({
        contentHash: row.contentHash,
      }),
    ocrTextRaw: row.ocrTextRaw,
    extractedFields: row.extractedFields as ExtractReceiptFieldsResult,
  }
}

export function createPostgresReceiptStore(): ReceiptStore {
  const saveReceipt: ReceiptStore["saveReceipt"] = async (input) => {
    const db = getPostgresDb("scan")

    const existingRows = await db
      .select()
      .from(receiptTable)
      .where(eq(receiptTable.contentHash, input.contentHash))
      .limit(1)

    const existingRow = existingRows[0]

    if (existingRow) {
      return toSavedReceipt(existingRow)
    }

    const receiptId = randomUUID()
    const rows = await db
      .insert(receiptTable)
      .values({
        receiptId,
        sourceImageRaw: input.originalImagePath,
        normalizedImagePath: input.normalizedImagePath,
        contentHash: input.contentHash,
        originalImageExtension: input.originalImageExtension,
        ocrTextRaw: input.ocrTextRaw,
        merchantName: input.extractedFields.merchant?.value ?? null,
        vatId: input.extractedFields.vatId?.value ?? null,
        purchasedAt: input.extractedFields.purchasedOn?.value ?? null,
        totalAmount: input.extractedFields.totalAmount?.value ?? null,
        currency: input.extractedFields.currency?.value ?? null,
        paymentMethod: input.extractedFields.paymentMethod?.value ?? null,
        cardLast4: input.extractedFields.cardLast4?.value ?? null,
        extractedFields: input.extractedFields,
      })
      .returning()

    const row = rows[0]

    if (!row) {
      throw new Error("receipt_store_insert_failed")
    }

    return toSavedReceipt(row)
  }

  return {
    saveReceipt,
  }
}
