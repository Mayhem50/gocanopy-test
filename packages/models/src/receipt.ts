import { date, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const receiptTable = pgTable("receipt", {
  receiptId: text("receipt_id").primaryKey(),
  sourceImageRaw: text("source_image_raw").notNull(),
  normalizedImagePath: text("normalized_image_path").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  originalImageExtension: text("original_image_extension").notNull(),
  ocrTextRaw: text("ocr_text_raw").notNull(),
  merchantName: text("merchant_name"),
  vatId: text("vat_id"),
  purchasedAt: date("purchased_at", { mode: "string" }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  currency: text("currency"),
  paymentMethod: text("payment_method"),
  cardLast4: text("card_last4"),
  extractedFields: jsonb("extracted_fields").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type ReceiptRow = typeof receiptTable.$inferSelect
