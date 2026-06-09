export type MatchStatus =
  | "reconciled"
  | "ambiguous"
  | "receipt_only"
  | "bank_only"
  | "cash"

export type CandidateStatus = "best_match" | "other_match"

export type LabelAssignmentSource =
  | "user"
  | "rule"
  | "receipt_item_suggestion"
  | "bank_suggestion"

export type LabelStatus = "active" | "archived"

export type CanonicalReceipt = {
  cardLast4: string | null
  contentHash: string
  currency: string | null
  merchantName: string | null
  originalImageExtension: string
  paymentMethod: string | null
  purchasedAt: string | null
  receiptId: string
  totalAmount: string | null
  vatId: string | null
}

export type CanonicalBankTransaction = {
  amount: string
  bankTransactionId: string
  currency: string
  descriptionNormalized: string
  descriptionRaw: string
  postedOn: string
  sourceRowNumber: number
  statementImportId: string
}

export type ReconciliationCandidateRecord = {
  bankTransactionId: string
  receiptId: string
  ruleHits: string[]
  ruleMisses: string[]
  score: string
  status: CandidateStatus
}

export type BankTransactionReceiptRecord = {
  associationRole: CandidateStatus
  bankTransactionId: string
  receiptId: string
}

export type MerchantTransactionRecord = {
  amount: string
  currency: string
  effectiveDate: string
  matchStatus: MatchStatus
  merchantTransactionId: string
  postedDate: string | null
  merchantId: string
  vatId: string | null
  sourceBankTransactionId: string | null
  sourceReceiptId: string | null
}

export type MerchantRecord = {
  aliases: string[]
  displayName: string
  merchantId: string
  vatId: string | null
}

export type LabelDefinition = {
  createdBy: string | null
  labelId: string
  name: string
  parentId: string | null
  status: LabelStatus
}

export type LabelAssignmentRecord = {
  active: true
  createdBy: string | null
  labelId: string
  merchantTransactionId: string
  reason: string
  source: Exclude<LabelAssignmentSource, "user">
}

export type ProjectionSnapshot = {
  bankTransactionReceipts: BankTransactionReceiptRecord[]
  labelAssignments: LabelAssignmentRecord[]
  labels: LabelDefinition[]
  merchants: MerchantRecord[]
  merchantTransactions: MerchantTransactionRecord[]
  reconciliationCandidates: ReconciliationCandidateRecord[]
}

export type SpendMixSlice = {
  amount: number
  label: string
}

export type MerchantTransactionTableRow = {
  amount: number
  currency: string
  effectiveDate: string
  label: string
  matchStatus: MatchStatus
  merchantTransactionId: string
  merchantName: string
}

export type LoadCanonicalFactsResult = {
  bankTransactions: CanonicalBankTransaction[]
  receipts: CanonicalReceipt[]
}

export type ProjectionSnapshotTarget =
  | {
      receiptId: string
      type: "receipt"
    }
  | {
      statementImportId: string
      type: "statement"
    }

export type ProjectionStore = {
  getMerchantTransactionTableRows(): Promise<MerchantTransactionTableRow[]>
  getSpendMixSlices(): Promise<SpendMixSlice[]>
  loadCanonicalFacts(): Promise<LoadCanonicalFactsResult>
  replaceProjectionSnapshot(input: {
    snapshot: ProjectionSnapshot
    target: ProjectionSnapshotTarget
  }): Promise<void>
}

export type MerchantTransactionForLabeling = {
  bankTransaction: CanonicalBankTransaction | null
  merchantTransaction: MerchantTransactionRecord
  receipt: CanonicalReceipt | null
  merchant: MerchantRecord
}

export type LabelSuggestion = {
  labelId: string
  reason: string
  source: Exclude<LabelAssignmentSource, "user">
}

export type LabelingService = {
  listLabels(): LabelDefinition[]
  suggestLabel(input: MerchantTransactionForLabeling): LabelSuggestion | null
}

export type ProjectionProviders = {
  labelingService: LabelingService
  projectionStore: ProjectionStore
}
