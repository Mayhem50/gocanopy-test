import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const statementImportStatusValues = [
  "valid",
  "malformed",
] as const

export type StatementImportStatus = (typeof statementImportStatusValues)[number]

export const statementImportTable = pgTable(
  "statement_import",
  {
    statementImportId: text("statement_import_id").primaryKey(),
    sourceFile: text("source_file").notNull(),
    sourceFileHash: text("source_file_hash").notNull(),
    importStatus: text("import_status", {
      enum: statementImportStatusValues,
    }).notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("statement_import_source_file_hash_uidx").on(
      table.sourceFileHash,
    ),
  ],
)

export type StatementImportRow = typeof statementImportTable.$inferSelect
