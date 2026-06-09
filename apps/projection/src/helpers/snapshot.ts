import type {
  CanonicalBankTransaction,
  CanonicalReceipt,
  LabelingService,
  ProjectionRelations,
  ProjectionScope,
  ProjectionSnapshot,
  ProjectionSnapshotTarget,
} from "../providers/index"
import { expandProjectionScope } from "../providers/projection-scope"
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

export type BuildScopedSnapshotResult = {
  snapshot: ProjectionSnapshot
  scope: ProjectionScope
}

function createInitialScope(
  bankTransactions: CanonicalBankTransaction[],
  target: ProjectionSnapshotTarget,
): ProjectionScope {
  if (target.type === "receipt") {
    return {
      bankTransactionIds: new Set<string>(),
      receiptIds: new Set<string>([target.receiptId]),
    }
  }

  return {
    bankTransactionIds: new Set(
      bankTransactions
        .filter(
          (bankTransaction) =>
            bankTransaction.statementImportId === target.statementImportId,
        )
        .map((bankTransaction) => bankTransaction.bankTransactionId),
    ),
    receiptIds: new Set<string>(),
  }
}

function filterFactsToScope(input: {
  bankTransactions: CanonicalBankTransaction[]
  receipts: CanonicalReceipt[]
  scope: ProjectionScope
}) {
  return {
    bankTransactions: input.bankTransactions.filter((bankTransaction) =>
      input.scope.bankTransactionIds.has(bankTransaction.bankTransactionId),
    ),
    receipts: input.receipts.filter((receipt) =>
      input.scope.receiptIds.has(receipt.receiptId),
    ),
  }
}

export function buildScopedSnapshotForTarget(input: {
  bankTransactions: CanonicalBankTransaction[]
  existingRelations: ProjectionRelations
  labelingService: LabelingService
  receipts: CanonicalReceipt[]
  target: ProjectionSnapshotTarget
}): BuildScopedSnapshotResult {
  const candidateMatchIndex = buildCandidateMatchIndex(
    input.receipts,
    input.bankTransactions,
  )
  const scope = expandProjectionScope(
    createInitialScope(input.bankTransactions, input.target),
    {
      bankTransactionReceipts: [
        ...input.existingRelations.bankTransactionReceipts,
        ...candidateMatchIndex.candidateRecords.map((candidate) => ({
          bankTransactionId: candidate.bankTransactionId,
          receiptId: candidate.receiptId,
        })),
      ],
      merchantTransactions: input.existingRelations.merchantTransactions,
      reconciliationCandidates: [
        ...input.existingRelations.reconciliationCandidates,
        ...candidateMatchIndex.candidateRecords,
      ],
    },
  )
  const scopedFacts = filterFactsToScope({
    bankTransactions: input.bankTransactions,
    receipts: input.receipts,
    scope,
  })

  return {
    snapshot: buildSnapshot(
      scopedFacts.receipts,
      scopedFacts.bankTransactions,
      input.labelingService,
    ),
    scope,
  }
}
