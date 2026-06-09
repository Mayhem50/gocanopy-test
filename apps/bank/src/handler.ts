import { readFile } from "node:fs/promises"

import { BankStatementRejectedError } from "./errors"
import {
  createBankProviders,
  type BankProviders,
  type ImportedBankStatement,
} from "./providers/index"

export type BankHandler = {
  handle(file: File): Promise<ImportedBankStatement>
}

export function createBankHandler(
  providers: BankProviders = createBankProviders(),
): BankHandler {
  async function importStatement(input: {
    fileBuffer: Buffer
    sourceFile: string
  }): Promise<ImportedBankStatement> {
    const storedStatement = await providers.statementFileStore.storeStatementFile(
      input,
    )
    const csvContent = await readFile(storedStatement.storedStatementPath, "utf8")
    const parsedStatement = await providers.statementParser.parseStatementCsv({
      csvContent,
    })

    const saveResult = await providers.statementStore.saveStatementImport({
      sourceFile: storedStatement.sourceFile,
      sourceFileHash: storedStatement.sourceFileHash,
      importStatus:
        parsedStatement.malformedRows.length > 0 ? "malformed" : "valid",
      transactions: parsedStatement.transactions,
    })

    if (!saveResult.isDuplicate && saveResult.transactions.length > 0) {
      await providers.projectionService.projectStatement({
        balanceAnchors: parsedStatement.balanceAnchors,
        malformedRows: parsedStatement.malformedRows,
        statementImport: saveResult.statementImport,
        transactions: saveResult.transactions,
      })
    }

    return {
      balanceAnchors: parsedStatement.balanceAnchors,
      malformedRows: parsedStatement.malformedRows,
      statementImport: saveResult.statementImport,
      storedStatementPath: storedStatement.storedStatementPath,
      transactions: saveResult.transactions,
    }
  }

  return {
    async handle(file: File): Promise<ImportedBankStatement> {
      return importStatement({
        fileBuffer: Buffer.from(await file.arrayBuffer()),
        sourceFile: file.name,
      })
    },
  }
}
