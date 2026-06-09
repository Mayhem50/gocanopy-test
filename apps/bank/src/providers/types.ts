import type { StatementImportStatus } from "@gocanopy/models"

export type StoreStatementFileInput = {
  fileBuffer: Buffer
  sourceFile: string
}

export type StoreStatementFileResult = {
  sourceFile: string
  sourceFileHash: string
  storedStatementPath: string
}

export type StatementFileStore = {
  storeStatementFile(
    input: StoreStatementFileInput,
  ): Promise<StoreStatementFileResult>
}

export type StatementRowValues = {
  date: string
  description: string
  amountEur: string
  balanceEur: string
  currency: string
}

export type ParsedBankTransaction = {
  amount: string
  currency: string
  descriptionNormalized: string
  descriptionRaw: string
  postedOn: string
  sourceRowNumber: number
}

export type MalformedStatementRow = {
  errors: string[]
  rawValues: StatementRowValues
  sourceRowNumber: number
}

export type StatementBalanceAnchors = {
  closingBalance: string | null
  openingBalance: string | null
}

export type ParseStatementCsvInput = {
  csvContent: string
}

export type ParseStatementCsvResult = {
  balanceAnchors: StatementBalanceAnchors
  malformedRows: MalformedStatementRow[]
  transactions: ParsedBankTransaction[]
}

export type StatementCsvParser = {
  parseStatementCsv(
    input: ParseStatementCsvInput,
  ): Promise<ParseStatementCsvResult>
}

export type SaveStatementImportInput = {
  importStatus: StatementImportStatus
  sourceFile: string
  sourceFileHash: string
  transactions: ParsedBankTransaction[]
}

export type SavedStatementImport = {
  importStatus: StatementImportStatus
  importedAt: string
  sourceFile: string
  sourceFileHash: string
  statementImportId: string
}

export type SavedBankTransaction = ParsedBankTransaction & {
  bankTransactionId: string
  statementImportId: string
}

export type SaveStatementImportResult = {
  isDuplicate: boolean
  statementImport: SavedStatementImport
  transactions: SavedBankTransaction[]
}

export type StatementStore = {
  saveStatementImport(
    input: SaveStatementImportInput,
  ): Promise<SaveStatementImportResult>
}

export type ProjectStatementInput = {
  balanceAnchors: StatementBalanceAnchors
  malformedRows: MalformedStatementRow[]
  statementImport: SavedStatementImport
  transactions: SavedBankTransaction[]
}

export type DomainProjectionService = {
  projectStatement(input: ProjectStatementInput): Promise<void>
}

export type ImportedBankStatement = {
  balanceAnchors: StatementBalanceAnchors
  malformedRows: MalformedStatementRow[]
  statementImport: SavedStatementImport
  storedStatementPath: string
  transactions: SavedBankTransaction[]
}

export type BankProviders = {
  projectionService: DomainProjectionService
  statementFileStore: StatementFileStore
  statementParser: StatementCsvParser
  statementStore: StatementStore
}
