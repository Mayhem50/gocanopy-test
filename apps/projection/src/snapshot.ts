import type {
  CanonicalBankTransaction,
  CanonicalReceipt,
  LabelingService,
  ProjectionSnapshot,
} from "./providers/index"
import { buildCandidateMatchIndex } from "./candidate-matching"
import { buildMerchantProjection } from "./merchant-projection"

export function buildSnapshot(
  receipts: CanonicalReceipt[],
  bankTransactions: CanonicalBankTransaction[],
  labelingService: LabelingService,
): ProjectionSnapshot {
  const candidateMatchIndex = buildCandidateMatchIndex(
    receipts,
    bankTransactions,
  )
  const merchantProjection = buildMerchantProjection({
    bankTransactions,
    candidateMatchIndex,
    labelingService,
    receipts,
  })

  return {
    bankTransactionReceipts: candidateMatchIndex.candidateRecords.map(
      (candidate) => ({
        associationRole: candidate.status,
        bankTransactionId: candidate.bankTransactionId,
        receiptId: candidate.receiptId,
      }),
    ),
    labelAssignments: merchantProjection.labelAssignments,
    labels: labelingService.listLabels(),
    merchants: merchantProjection.merchants,
    merchantTransactions: merchantProjection.merchantTransactions,
    reconciliationCandidates: candidateMatchIndex.candidateRecords,
  }
}
