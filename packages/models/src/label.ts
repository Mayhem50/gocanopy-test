import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const labelStatusValues = ["active", "archived"] as const

export type LabelStatus = (typeof labelStatusValues)[number]

export const labelTable = pgTable("label", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text("created_by"),
  labelId: text("label_id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  status: text("status", {
    enum: labelStatusValues,
  }).notNull(),
})

export type LabelRow = typeof labelTable.$inferSelect
