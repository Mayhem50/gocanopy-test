import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const merchantTable = pgTable("merchant", {
  aliases: jsonb("aliases").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  displayName: text("display_name").notNull(),
  merchantId: text("merchant_id").primaryKey(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  vatId: text("vat_id").unique(),
})

export type MerchantRow = typeof merchantTable.$inferSelect
