import { jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { bankTransactionTable } from "./bank-transaction.js"
import { receiptTable } from "./receipt.js"

export const reconciliationCandidateStatusValues = [
  "best_match",
  "other_match",
] as const

export const reconciliationCandidateTable = pgTable(
  "reconciliation_candidate",
  {
    bankTransactionId: text("bank_transaction_id")
      .notNull()
      .references(() => bankTransactionTable.bankTransactionId),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => receiptTable.receiptId),
    ruleHits: jsonb("rule_hits").$type<string[]>().notNull(),
    ruleMisses: jsonb("rule_misses").$type<string[]>().notNull(),
    score: numeric("score", { precision: 12, scale: 2 }).notNull(),
    status: text("status", {
      enum: reconciliationCandidateStatusValues,
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
)

export type ReconciliationCandidateRow =
  typeof reconciliationCandidateTable.$inferSelect
