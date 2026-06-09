import {
  bankTransactionTable,
  getPostgresDb,
  labelAssignmentTable,
  labelTable,
  merchantTable,
  merchantTransactionTable,
  receiptTable,
  type BankTransactionRow,
  type ReceiptRow,
} from "@gocanopy/models"
import { and, asc, eq, sql } from "drizzle-orm"

import type {
  CanonicalBankTransaction,
  CanonicalReceipt,
  ProjectionStore,
} from "./types"
import { replaceProjectionSnapshot } from "./projection-snapshot-rewriter"

function toCanonicalReceipt(row: ReceiptRow): CanonicalReceipt {
  return {
    cardLast4: row.cardLast4,
    contentHash: row.contentHash,
    currency: row.currency,
    merchantName: row.merchantName,
    originalImageExtension: row.originalImageExtension,
    paymentMethod: row.paymentMethod,
    purchasedAt: row.purchasedAt,
    receiptId: row.receiptId,
    totalAmount: row.totalAmount,
    vatId: row.vatId,
  }
}

function toCanonicalBankTransaction(
  row: BankTransactionRow,
): CanonicalBankTransaction {
  return {
    amount: row.amount,
    bankTransactionId: row.bankTransactionId,
    currency: row.currency,
    descriptionNormalized: row.descriptionNormalized,
    descriptionRaw: row.descriptionRaw,
    postedOn: row.postedOn,
    sourceRowNumber: row.sourceRowNumber,
    statementImportId: row.statementImportId,
  }
}

export function createPostgresProjectionStore(): ProjectionStore {
  return {
    async getMerchantTransactionTableRows() {
      const db = getPostgresDb("projection")
      const rows = await db
        .select({
          amount: sql<string>`cast(${merchantTransactionTable.amount} as text)`,
          currency: merchantTransactionTable.currency,
          effectiveDate: merchantTransactionTable.effectiveDate,
          label: sql<string>`coalesce(${labelTable.name}, 'Unlabeled')`,
          matchStatus: merchantTransactionTable.matchStatus,
          merchantTransactionId: merchantTransactionTable.merchantTransactionId,
          merchantName: merchantTable.displayName,
        })
        .from(merchantTransactionTable)
        .innerJoin(
          merchantTable,
          eq(merchantTable.merchantId, merchantTransactionTable.merchantId),
        )
        .leftJoin(
          labelAssignmentTable,
          and(
            eq(
              labelAssignmentTable.merchantTransactionId,
              merchantTransactionTable.merchantTransactionId,
            ),
            eq(labelAssignmentTable.active, true),
          ),
        )
        .leftJoin(
          labelTable,
          eq(labelTable.labelId, labelAssignmentTable.labelId),
        )
        .orderBy(
          sql`${merchantTransactionTable.effectiveDate} desc`,
          sql`${merchantTransactionTable.amount} asc`,
          sql`${merchantTable.displayName} asc`,
        )

      return rows.map((row) => ({
        amount: Number(row.amount),
        currency: row.currency,
        effectiveDate: row.effectiveDate,
        label: row.label,
        matchStatus: row.matchStatus,
        merchantTransactionId: row.merchantTransactionId,
        merchantName: row.merchantName,
      }))
    },
    async getSpendMixSlices() {
      const db = getPostgresDb("projection")
      const rows = await db
        .select({
          amount: sql<string>`cast(coalesce(sum(${merchantTransactionTable.amount}), 0) as text)`,
          label: sql<string>`coalesce(${labelTable.name}, 'Unlabeled')`,
        })
        .from(merchantTransactionTable)
        .leftJoin(
          labelAssignmentTable,
          and(
            eq(
              labelAssignmentTable.merchantTransactionId,
              merchantTransactionTable.merchantTransactionId,
            ),
            eq(labelAssignmentTable.active, true),
          ),
        )
        .leftJoin(
          labelTable,
          eq(labelTable.labelId, labelAssignmentTable.labelId),
        )
        .groupBy(sql`coalesce(${labelTable.name}, 'Unlabeled')`)
        .orderBy(
          sql`coalesce(sum(${merchantTransactionTable.amount}), 0) desc`,
          sql`coalesce(${labelTable.name}, 'Unlabeled') asc`,
        )

      return rows.map((row) => ({
        amount: Number(row.amount),
        label: row.label,
      }))
    },
    async loadCanonicalFacts() {
      const db = getPostgresDb("projection")

      const [receipts, bankTransactions] = await Promise.all([
        db.select().from(receiptTable),
        db
          .select()
          .from(bankTransactionTable)
          .orderBy(
            asc(bankTransactionTable.postedOn),
            asc(bankTransactionTable.sourceRowNumber),
          ),
      ])

      return {
        bankTransactions: bankTransactions.map(toCanonicalBankTransaction),
        receipts: receipts.map(toCanonicalReceipt),
      }
    },
    async replaceProjectionSnapshot({ snapshot, target }) {
      const db = getPostgresDb("projection")

      await replaceProjectionSnapshot({
        db,
        snapshot,
        target,
      })
    },
  }
}
