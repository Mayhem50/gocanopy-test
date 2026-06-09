import { randomUUID } from "node:crypto"

import {
  bankTransactionTable,
  getPostgresDb,
  statementImportTable,
  type BankTransactionRow,
  type StatementImportRow,
} from "@gocanopy/models"
import { asc, eq } from "drizzle-orm"

import type {
  SavedBankTransaction,
  SavedStatementImport,
  StatementStore,
} from "./types"

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toSavedStatementImport(row: StatementImportRow): SavedStatementImport {
  return {
    importStatus: row.importStatus,
    importedAt: toIsoString(row.importedAt),
    sourceFile: row.sourceFile,
    sourceFileHash: row.sourceFileHash,
    statementImportId: row.statementImportId,
  }
}

function toSavedBankTransaction(row: BankTransactionRow): SavedBankTransaction {
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

export function createPostgresStatementStore(): StatementStore {
  return {
    async saveStatementImport(input) {
      const db = getPostgresDb("bank")

      const existingStatementImportRows = await db
        .select()
        .from(statementImportTable)
        .where(eq(statementImportTable.sourceFileHash, input.sourceFileHash))
        .limit(1)

      const existingStatementImportRow = existingStatementImportRows[0]

      if (existingStatementImportRow) {
        const existingTransactions = await db
          .select()
          .from(bankTransactionTable)
          .where(
            eq(
              bankTransactionTable.statementImportId,
              existingStatementImportRow.statementImportId,
            ),
          )
          .orderBy(
            asc(bankTransactionTable.postedOn),
            asc(bankTransactionTable.sourceRowNumber),
          )

        return {
          isDuplicate: true,
          statementImport: toSavedStatementImport(existingStatementImportRow),
          transactions: existingTransactions.map(toSavedBankTransaction),
        }
      }

      const statementImportRows = await db
        .insert(statementImportTable)
        .values({
          importStatus: input.importStatus,
          sourceFile: input.sourceFile,
          sourceFileHash: input.sourceFileHash,
          statementImportId: randomUUID(),
        })
        .returning()

      const statementImportRow = statementImportRows[0]

      if (!statementImportRow) {
        throw new Error("statement_import_insert_failed")
      }

      if (input.transactions.length === 0) {
        return {
          isDuplicate: false,
          statementImport: toSavedStatementImport(statementImportRow),
          transactions: [],
        }
      }

      await db
        .insert(bankTransactionTable)
        .values(
          input.transactions.map((transaction) => ({
            amount: transaction.amount,
            bankTransactionId: randomUUID(),
            currency: transaction.currency,
            descriptionNormalized: transaction.descriptionNormalized,
            descriptionRaw: transaction.descriptionRaw,
            postedOn: transaction.postedOn,
            sourceRowNumber: transaction.sourceRowNumber,
            statementImportId: statementImportRow.statementImportId,
          })),
        )

      const persistedTransactions = await db
        .select()
        .from(bankTransactionTable)
        .where(
          eq(
            bankTransactionTable.statementImportId,
            statementImportRow.statementImportId,
          ),
        )
        .orderBy(
          asc(bankTransactionTable.postedOn),
          asc(bankTransactionTable.sourceRowNumber),
        )

      return {
        isDuplicate: false,
        statementImport: toSavedStatementImport(statementImportRow),
        transactions: persistedTransactions.map(toSavedBankTransaction),
      }
    },
  }
}
