import { date, integer, numeric, pgTable, text } from "drizzle-orm/pg-core"

import { statementImportTable } from "./statement-import.js"

export const bankTransactionTable = pgTable("bank_transaction", {
  bankTransactionId: text("bank_transaction_id").primaryKey(),
  statementImportId: text("statement_import_id")
    .notNull()
    .references(() => statementImportTable.statementImportId),
  postedOn: date("posted_on", { mode: "string" }).notNull(),
  descriptionRaw: text("description_raw").notNull(),
  descriptionNormalized: text("description_normalized").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  sourceRowNumber: integer("source_row_number").notNull(),
})

export type BankTransactionRow = typeof bankTransactionTable.$inferSelect
