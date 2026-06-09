import type {
  CanonicalBankTransaction,
  CanonicalReceipt,
  MatchStatus,
  MerchantTransactionTableRow,
  ReconciliationCandidateRecord,
  ProjectionProviders,
  MerchantRecord,
  SpendMixSlice,
} from "./providers/index"
import type { ProjectReceiptInput, ProjectStatementInput } from "./schemas"

export type CandidateComputation = {
  bankTransaction: CanonicalBankTransaction
  merchantSimilarity: number
  receipt: CanonicalReceipt
  ruleHits: string[]
  ruleMisses: string[]
  score: number
}

export type MerchantIdentity = {
  displayName: string
  merchantId: string
  vatId: string | null
}

export type ProjectionTargetCode =
  | "receipt_not_found"
  | "statement_import_not_found"

export type ProjectionRunSummary = {
  ambiguousCount: number
  bankOnlyCount: number
  candidateCount: number
  cashCount: number
  receiptOnlyCount: number
  reconciledCount: number
  merchantCount: number
}

export type ProjectionRunResult = {
  summary: ProjectionRunSummary
  trigger: "receipt" | "statement"
}

export type SpendMixResult = {
  slices: SpendMixSlice[]
}

export type MerchantTransactionsResult = {
  rows: MerchantTransactionTableRow[]
}

export type ProjectionHandler = {
  getMerchantTransactions(): Promise<MerchantTransactionsResult>
  getSpendMix(): Promise<SpendMixResult>
  projectReceipt(
    input: ProjectReceiptInput,
  ): Promise<ProjectionRunResult>
  projectStatement(
    input: ProjectStatementInput,
  ): Promise<ProjectionRunResult>
}

export type BuildCandidateRecordsResult = {
  candidateRecords: ReconciliationCandidateRecord[]
  candidatesByBankTransaction: Map<string, CandidateComputation[]>
}

export type MatchStatusCounts = Record<MatchStatus, number>

export type MerchantMap = Map<string, MerchantRecord>
