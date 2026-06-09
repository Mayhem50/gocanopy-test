import {
  bankTransactionReceiptTable,
  bankTransactionTable,
  getPostgresDb,
  labelAssignmentTable,
  labelTable,
  merchantTable,
  merchantTransactionTable,
  reconciliationCandidateTable,
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

function toCount(value: string): number {
  return Number(value)
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
    async getProjectionRunSummary() {
      const db = getPostgresDb("projection")
      const [candidateRows, merchantRows, matchStatusRows] = await Promise.all([
        db
          .select({
            count: sql<string>`cast(count(*) as text)`,
          })
          .from(reconciliationCandidateTable),
        db
          .select({
            count: sql<string>`cast(count(*) as text)`,
          })
          .from(merchantTable),
        db
          .select({
            count: sql<string>`cast(count(*) as text)`,
            matchStatus: merchantTransactionTable.matchStatus,
          })
          .from(merchantTransactionTable)
          .groupBy(merchantTransactionTable.matchStatus),
      ])
      const matchStatusCounts = {
        ambiguous: 0,
        bank_only: 0,
        cash: 0,
        receipt_only: 0,
        reconciled: 0,
      }

      for (const row of matchStatusRows) {
        matchStatusCounts[row.matchStatus] = toCount(row.count)
      }

      return {
        ambiguousCount: matchStatusCounts.ambiguous,
        bankOnlyCount: matchStatusCounts.bank_only,
        candidateCount: toCount(candidateRows[0]?.count ?? "0"),
        cashCount: matchStatusCounts.cash,
        merchantCount: toCount(merchantRows[0]?.count ?? "0"),
        receiptOnlyCount: matchStatusCounts.receipt_only,
        reconciledCount: matchStatusCounts.reconciled,
      }
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
    async loadProjectionRelations() {
      const db = getPostgresDb("projection")
      const [
        reconciliationCandidates,
        bankTransactionReceipts,
        merchantTransactions,
      ] = await Promise.all([
        db
          .select({
            bankTransactionId: reconciliationCandidateTable.bankTransactionId,
            receiptId: reconciliationCandidateTable.receiptId,
          })
          .from(reconciliationCandidateTable),
        db
          .select({
            bankTransactionId: bankTransactionReceiptTable.bankTransactionId,
            receiptId: bankTransactionReceiptTable.receiptId,
          })
          .from(bankTransactionReceiptTable),
        db
          .select({
            sourceBankTransactionId:
              merchantTransactionTable.sourceBankTransactionId,
            sourceReceiptId: merchantTransactionTable.sourceReceiptId,
          })
          .from(merchantTransactionTable),
      ])

      return {
        bankTransactionReceipts,
        merchantTransactions,
        reconciliationCandidates,
      }
    },
    async replaceProjectionSnapshot({ scope, snapshot, target: _target }) {
      const db = getPostgresDb("projection")

      await replaceProjectionSnapshot({
        db,
        scope,
        snapshot,
      })
    },
  }
}
