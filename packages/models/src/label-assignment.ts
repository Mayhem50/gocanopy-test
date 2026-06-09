import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { labelTable } from "./label.js"
import { merchantTransactionTable } from "./merchant-transaction.js"

export const labelAssignmentSourceValues = [
  "user",
  "rule",
  "receipt_item_suggestion",
  "bank_suggestion",
] as const

export type LabelAssignmentSource =
  (typeof labelAssignmentSourceValues)[number]

export const labelAssignmentTable = pgTable(
  "label_assignment",
  {
    active: boolean("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
    labelId: text("label_id")
      .notNull()
      .references(() => labelTable.labelId),
    merchantTransactionId: text("merchant_transaction_id")
      .notNull()
      .references(() => merchantTransactionTable.merchantTransactionId),
    reason: text("reason").notNull(),
    source: text("source", {
      enum: labelAssignmentSourceValues,
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.merchantTransactionId, table.labelId, table.source],
    }),
  ],
)

export type LabelAssignmentRow = typeof labelAssignmentTable.$inferSelect
