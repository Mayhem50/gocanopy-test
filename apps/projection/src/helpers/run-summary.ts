import type { ProjectionSnapshot } from "../providers/index"
import type { MatchStatusCounts, ProjectionRunSummary } from "../types"

export function createRunSummary(
  snapshot: ProjectionSnapshot,
): ProjectionRunSummary {
  const matchStatusCounts =
    snapshot.merchantTransactions.reduce<MatchStatusCounts>(
      (counts, transaction) => {
        counts[transaction.matchStatus] += 1
        return counts
      },
      {
        ambiguous: 0,
        bank_only: 0,
        cash: 0,
        receipt_only: 0,
        reconciled: 0,
      },
    )

  return {
    ambiguousCount: matchStatusCounts.ambiguous,
    bankOnlyCount: matchStatusCounts.bank_only,
    candidateCount: snapshot.reconciliationCandidates.length,
    cashCount: matchStatusCounts.cash,
    receiptOnlyCount: matchStatusCounts.receipt_only,
    reconciledCount: matchStatusCounts.reconciled,
    merchantCount: snapshot.merchants.length,
  }
}
