import { date, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { bankTransactionTable } from "./bank-transaction.js"
import { receiptTable } from "./receipt.js"
import { merchantTable } from "./merchant.js"

export const merchantTransactionMatchStatusValues = [
  "reconciled",
  "ambiguous",
  "receipt_only",
  "bank_only",
  "cash",
] as const

export const merchantTransactionTable = pgTable("merchant_transaction", {
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  currency: text("currency").notNull(),
  effectiveDate: date("effective_date", { mode: "string" }).notNull(),
  matchStatus: text("match_status", {
    enum: merchantTransactionMatchStatusValues,
  }).notNull(),
  merchantTransactionId: text("merchant_transaction_id").primaryKey(),
  postedDate: date("posted_date", { mode: "string" }),
  merchantId: text("merchant_id")
    .notNull()
    .references(() => merchantTable.merchantId),
  vatId: text("vat_id").references(() => merchantTable.vatId),
  sourceBankTransactionId: text("source_bank_transaction_id").references(
    () => bankTransactionTable.bankTransactionId,
  ),
  sourceReceiptId: text("source_receipt_id").references(
    () => receiptTable.receiptId,
  ),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type MerchantTransactionRow = typeof merchantTransactionTable.$inferSelect
