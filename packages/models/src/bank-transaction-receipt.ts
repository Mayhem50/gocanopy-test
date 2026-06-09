import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { bankTransactionTable } from "./bank-transaction.js"
import { receiptTable } from "./receipt.js"
import { reconciliationCandidateStatusValues } from "./reconciliation-candidate.js"

export const bankTransactionReceiptTable = pgTable("bank_transaction_receipt", {
  associationRole: text("association_role", {
    enum: reconciliationCandidateStatusValues,
  }).notNull(),
  bankTransactionId: text("bank_transaction_id")
    .notNull()
    .references(() => bankTransactionTable.bankTransactionId),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  receiptId: text("receipt_id")
    .notNull()
    .references(() => receiptTable.receiptId),
})

export type BankTransactionReceiptRow =
  typeof bankTransactionReceiptTable.$inferSelect
