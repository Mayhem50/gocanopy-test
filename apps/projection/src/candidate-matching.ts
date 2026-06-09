import type {
  CanonicalBankTransaction,
  CanonicalReceipt,
  ReconciliationCandidateRecord,
} from "./providers/index"
import type { BuildCandidateRecordsResult, CandidateComputation } from "./types"

const LOW_SIGNAL_MERCHANT_TOKENS = new Set([
  "card",
  "dublin",
  "ifsc",
  "ltd",
  "payment",
  "rest",
  "sq",
  "store",
  "stores",
])

export type CandidateMatchIndex = {
  bestCandidateByReceipt: Map<string, string>
  candidateRecords: ReconciliationCandidateRecord[]
  candidatesByBankTransaction: Map<string, CandidateComputation[]>
  candidatesByReceipt: Map<string, CandidateComputation[]>
}

function normalizeToken(token: string): string {
  const compactToken = token.replace(/(^'+|'+$)/g, "")

  if (compactToken.endsWith("s") && compactToken.length > 3) {
    return compactToken.slice(0, -1)
  }

  return compactToken
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(
      (token) => token.length > 1 && !LOW_SIGNAL_MERCHANT_TOKENS.has(token),
    )
}

function merchantSimilarity(left: string | null, right: string): number {
  if (!left) {
    return 0
  }

  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let intersectionCount = 0

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersectionCount += 1
    }
  }

  return intersectionCount / new Set([...leftTokens, ...rightTokens]).size
}

export function toAmountNumber(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function absoluteBankAmount(
  transaction: CanonicalBankTransaction,
): number {
  return Math.abs(Number(transaction.amount))
}

function dayDistance(left: string, right: string): number {
  const leftDate = new Date(`${left}T00:00:00.000Z`)
  const rightDate = new Date(`${right}T00:00:00.000Z`)

  return Math.round(
    Math.abs(rightDate.getTime() - leftDate.getTime()) / 86_400_000,
  )
}

function buildCandidateComputations(
  receipts: CanonicalReceipt[],
  bankTransactions: CanonicalBankTransaction[],
): Map<string, CandidateComputation[]> {
  const candidatesByReceipt = new Map<string, CandidateComputation[]>()

  for (const receipt of receipts) {
    if (receipt.paymentMethod === "cash") {
      continue
    }

    const purchasedAmount = toAmountNumber(receipt.totalAmount)

    if (
      receipt.currency === null ||
      receipt.purchasedAt === null ||
      purchasedAmount === null
    ) {
      continue
    }

    const receiptCandidates: CandidateComputation[] = []

    for (const bankTransaction of bankTransactions) {
      if (bankTransaction.currency !== receipt.currency) {
        continue
      }

      if (bankTransaction.postedOn < receipt.purchasedAt) {
        continue
      }

      const similarity = merchantSimilarity(
        receipt.merchantName,
        bankTransaction.descriptionNormalized,
      )
      const amountMatches =
        absoluteBankAmount(bankTransaction) === purchasedAmount

      if (!amountMatches && similarity < 0.4) {
        continue
      }

      const ruleHits = ["currency_match", "posted_on_or_after_purchase"]
      const ruleMisses: string[] = []

      if (amountMatches) {
        ruleHits.push("amount_exact")
      } else {
        ruleMisses.push("amount_mismatch")
      }

      if (similarity >= 0.4) {
        ruleHits.push("merchant_similarity_high")
      } else {
        ruleMisses.push("merchant_similarity_low")
      }

      receiptCandidates.push({
        bankTransaction,
        merchantSimilarity: similarity,
        receipt,
        ruleHits,
        ruleMisses,
        score:
          (amountMatches ? 100 : 20) +
          Math.round(similarity * 40) +
          Math.max(
            0,
            12 - dayDistance(receipt.purchasedAt, bankTransaction.postedOn),
          ),
      })
    }

    receiptCandidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.bankTransaction.postedOn !== right.bankTransaction.postedOn) {
        return left.bankTransaction.postedOn.localeCompare(
          right.bankTransaction.postedOn,
        )
      }

      return (
        left.bankTransaction.sourceRowNumber -
        right.bankTransaction.sourceRowNumber
      )
    })

    candidatesByReceipt.set(receipt.receiptId, receiptCandidates)
  }

  return candidatesByReceipt
}

function createMerchantId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function createExactClusterKey(receipt: CanonicalReceipt): string | null {
  if (
    receipt.paymentMethod === "cash" ||
    receipt.currency === null ||
    receipt.totalAmount === null ||
    receipt.purchasedAt === null
  ) {
    return null
  }

  const merchantKey =
    receipt.vatId ?? createMerchantId(receipt.merchantName ?? receipt.receiptId)

  return `${merchantKey}:${receipt.currency}:${receipt.totalAmount}`
}

function assignBestCandidates(
  receipts: CanonicalReceipt[],
  candidatesByReceipt: Map<string, CandidateComputation[]>,
): Map<string, string> {
  const bestCandidateByReceipt = new Map<string, string>()
  const groupedReceipts = new Map<string, CanonicalReceipt[]>()

  for (const receipt of receipts) {
    const clusterKey = createExactClusterKey(receipt)
    const exactCandidates =
      candidatesByReceipt
        .get(receipt.receiptId)
        ?.filter(
          (candidate) =>
            absoluteBankAmount(candidate.bankTransaction) ===
            toAmountNumber(receipt.totalAmount),
        ) ?? []

    if (clusterKey === null || exactCandidates.length === 0) {
      continue
    }

    const clusterReceipts = groupedReceipts.get(clusterKey) ?? []
    clusterReceipts.push(receipt)
    groupedReceipts.set(clusterKey, clusterReceipts)
  }

  for (const clusterReceipts of groupedReceipts.values()) {
    const orderedReceipts = [...clusterReceipts].sort((left, right) => {
      if (left.purchasedAt !== right.purchasedAt) {
        return (left.purchasedAt ?? "").localeCompare(right.purchasedAt ?? "")
      }

      return left.receiptId.localeCompare(right.receiptId)
    })
    const usedBankTransactionIds = new Set<string>()

    for (const receipt of orderedReceipts) {
      const exactCandidates =
        candidatesByReceipt
          .get(receipt.receiptId)
          ?.filter(
            (candidate) =>
              absoluteBankAmount(candidate.bankTransaction) ===
              toAmountNumber(receipt.totalAmount),
          ) ?? []
      const bestCandidate =
        exactCandidates.find(
          (candidate) =>
            !usedBankTransactionIds.has(
              candidate.bankTransaction.bankTransactionId,
            ),
        ) ?? exactCandidates[0]

      if (!bestCandidate) {
        continue
      }

      usedBankTransactionIds.add(
        bestCandidate.bankTransaction.bankTransactionId,
      )
      bestCandidateByReceipt.set(
        receipt.receiptId,
        bestCandidate.bankTransaction.bankTransactionId,
      )
    }
  }

  for (const [receiptId, candidates] of candidatesByReceipt.entries()) {
    if (bestCandidateByReceipt.has(receiptId)) {
      continue
    }

    const bestCandidate = candidates[0]

    if (!bestCandidate) {
      continue
    }

    bestCandidateByReceipt.set(
      receiptId,
      bestCandidate.bankTransaction.bankTransactionId,
    )
  }

  return bestCandidateByReceipt
}

function buildCandidateRecords(
  candidatesByReceipt: Map<string, CandidateComputation[]>,
  bestCandidateByReceipt: Map<string, string>,
): BuildCandidateRecordsResult {
  const candidateRecords: ReconciliationCandidateRecord[] = []
  const candidatesByBankTransaction = new Map<string, CandidateComputation[]>()

  for (const [receiptId, candidates] of candidatesByReceipt.entries()) {
    const bestBankTransactionId = bestCandidateByReceipt.get(receiptId)

    for (const candidate of candidates) {
      const existingCandidates =
        candidatesByBankTransaction.get(
          candidate.bankTransaction.bankTransactionId,
        ) ?? []
      existingCandidates.push(candidate)
      candidatesByBankTransaction.set(
        candidate.bankTransaction.bankTransactionId,
        existingCandidates,
      )

      candidateRecords.push({
        bankTransactionId: candidate.bankTransaction.bankTransactionId,
        receiptId,
        ruleHits: candidate.ruleHits,
        ruleMisses: candidate.ruleMisses,
        score: candidate.score.toFixed(2),
        status:
          candidate.bankTransaction.bankTransactionId === bestBankTransactionId
            ? "best_match"
            : "other_match",
      })
    }
  }

  return {
    candidateRecords,
    candidatesByBankTransaction,
  }
}

export function buildCandidateMatchIndex(
  receipts: CanonicalReceipt[],
  bankTransactions: CanonicalBankTransaction[],
): CandidateMatchIndex {
  const candidatesByReceipt = buildCandidateComputations(
    receipts,
    bankTransactions,
  )
  const bestCandidateByReceipt = assignBestCandidates(
    receipts,
    candidatesByReceipt,
  )
  const { candidateRecords, candidatesByBankTransaction } =
    buildCandidateRecords(candidatesByReceipt, bestCandidateByReceipt)

  return {
    bestCandidateByReceipt,
    candidateRecords,
    candidatesByBankTransaction,
    candidatesByReceipt,
  }
}
