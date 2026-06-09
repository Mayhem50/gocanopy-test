import type {
  CanonicalBankTransaction,
  CanonicalReceipt,
  LabelAssignmentRecord,
  LabelingService,
  MatchStatus,
  MerchantRecord,
  MerchantTransactionRecord,
  ProjectionSnapshot,
} from "./providers/index"
import {
  absoluteBankAmount,
  type CandidateMatchIndex,
  toAmountNumber,
} from "./candidate-matching"
import type { MerchantIdentity, MerchantMap } from "./types"

type MerchantProjection = Pick<
  ProjectionSnapshot,
  "labelAssignments" | "merchantTransactions" | "merchants"
>

function createMerchantId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getReceiptMerchantIdentity(
  receipt: CanonicalReceipt,
): MerchantIdentity {
  if (receipt.vatId) {
    return {
      displayName: receipt.merchantName ?? receipt.vatId,
      merchantId: `vat:${receipt.vatId}`,
      vatId: receipt.vatId,
    }
  }

  const merchantName = receipt.merchantName ?? receipt.receiptId

  return {
    displayName: merchantName,
    merchantId: `merchant:${createMerchantId(merchantName)}`,
    vatId: null,
  }
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const [firstCharacter = "", ...rest] = token

      return `${firstCharacter.toUpperCase()}${rest.join("").toLowerCase()}`
    })
    .join(" ")
}

function getBankFallbackMerchantIdentity(
  transaction: CanonicalBankTransaction,
): MerchantIdentity {
  const description =
    transaction.descriptionNormalized || transaction.descriptionRaw
  const displayName = titleCase(description)

  return {
    displayName,
    merchantId: `merchant:${createMerchantId(description)}`,
    vatId: null,
  }
}

function addMerchant(
  merchantMap: MerchantMap,
  identity: MerchantIdentity,
  aliases: string[],
): void {
  const currentRecord = merchantMap.get(identity.merchantId)

  if (!currentRecord) {
    merchantMap.set(identity.merchantId, {
      aliases: aliases.filter((alias) => alias.length > 0),
      displayName: identity.displayName,
      merchantId: identity.merchantId,
      vatId: identity.vatId,
    })
    return
  }

  currentRecord.aliases.push(...aliases)

  if (identity.displayName.length > currentRecord.displayName.length) {
    currentRecord.displayName = identity.displayName
  }
}

function buildMerchantTransactions(input: {
  receipts: CanonicalReceipt[]
  bankTransactions: CanonicalBankTransaction[]
  candidateMatchIndex: CandidateMatchIndex
  merchantMap: MerchantMap
}): MerchantTransactionRecord[] {
  const { bankTransactions, candidateMatchIndex, merchantMap, receipts } = input
  const merchantTransactions: MerchantTransactionRecord[] = []

  for (const receipt of receipts) {
    const merchantIdentity = getReceiptMerchantIdentity(receipt)
    const receiptCandidates =
      candidateMatchIndex.candidatesByReceipt.get(receipt.receiptId) ?? []
    const bestCandidateBankTransactionId =
      candidateMatchIndex.bestCandidateByReceipt.get(receipt.receiptId)
    const bestCandidate = receiptCandidates.find(
      (candidate) =>
        candidate.bankTransaction.bankTransactionId ===
        bestCandidateBankTransactionId,
    )

    addMerchant(merchantMap, merchantIdentity, [
      receipt.merchantName ?? "",
      receipt.vatId ?? "",
    ])

    if (receipt.paymentMethod === "cash") {
      merchantTransactions.push({
        amount: (toAmountNumber(receipt.totalAmount) ?? 0).toFixed(2),
        currency: receipt.currency ?? "EUR",
        effectiveDate: receipt.purchasedAt ?? "1970-01-01",
        matchStatus: "cash",
        merchantTransactionId: `receipt:${receipt.receiptId}`,
        postedDate: null,
        merchantId: merchantIdentity.merchantId,
        vatId: merchantIdentity.vatId,
        sourceBankTransactionId: null,
        sourceReceiptId: receipt.receiptId,
      })
      continue
    }

    if (!bestCandidate) {
      merchantTransactions.push({
        amount: (toAmountNumber(receipt.totalAmount) ?? 0).toFixed(2),
        currency: receipt.currency ?? "EUR",
        effectiveDate: receipt.purchasedAt ?? "1970-01-01",
        matchStatus: "receipt_only",
        merchantTransactionId: `receipt:${receipt.receiptId}`,
        postedDate: null,
        merchantId: merchantIdentity.merchantId,
        vatId: merchantIdentity.vatId,
        sourceBankTransactionId: null,
        sourceReceiptId: receipt.receiptId,
      })
      continue
    }

    addMerchant(merchantMap, merchantIdentity, [
      bestCandidate.bankTransaction.descriptionRaw,
      bestCandidate.bankTransaction.descriptionNormalized,
    ])

    const exactCandidateCount = receiptCandidates.filter(
      (candidate) =>
        absoluteBankAmount(candidate.bankTransaction) ===
        toAmountNumber(receipt.totalAmount),
    ).length
    const matchStatus: MatchStatus =
      exactCandidateCount === 1 &&
      absoluteBankAmount(bestCandidate.bankTransaction) ===
        toAmountNumber(receipt.totalAmount)
        ? "reconciled"
        : "ambiguous"

    merchantTransactions.push({
      amount: (toAmountNumber(receipt.totalAmount) ?? 0).toFixed(2),
      currency: receipt.currency ?? bestCandidate.bankTransaction.currency,
      effectiveDate:
        receipt.purchasedAt ?? bestCandidate.bankTransaction.postedOn,
      matchStatus,
      merchantTransactionId: `receipt:${receipt.receiptId}`,
      postedDate: bestCandidate.bankTransaction.postedOn,
      merchantId: merchantIdentity.merchantId,
      vatId: merchantIdentity.vatId,
      sourceBankTransactionId: bestCandidate.bankTransaction.bankTransactionId,
      sourceReceiptId: receipt.receiptId,
    })
  }

  const matchedBankTransactionIds = new Set(
    merchantTransactions
      .map((transaction) => transaction.sourceBankTransactionId)
      .filter((bankTransactionId) => bankTransactionId !== null),
  )

  for (const bankTransaction of bankTransactions) {
    if (matchedBankTransactionIds.has(bankTransaction.bankTransactionId)) {
      continue
    }

    const relatedReceipt = candidateMatchIndex.candidatesByBankTransaction
      .get(bankTransaction.bankTransactionId)
      ?.map((candidate) => candidate.receipt)
      .sort((left, right) => {
        if (left.purchasedAt !== right.purchasedAt) {
          return (left.purchasedAt ?? "").localeCompare(right.purchasedAt ?? "")
        }

        return left.receiptId.localeCompare(right.receiptId)
      })[0]
    const merchantIdentity =
      relatedReceipt !== undefined
        ? getReceiptMerchantIdentity(relatedReceipt)
        : getBankFallbackMerchantIdentity(bankTransaction)

    addMerchant(merchantMap, merchantIdentity, [
      bankTransaction.descriptionRaw,
      bankTransaction.descriptionNormalized,
    ])

    merchantTransactions.push({
      amount: absoluteBankAmount(bankTransaction).toFixed(2),
      currency: bankTransaction.currency,
      effectiveDate: bankTransaction.postedOn,
      matchStatus: "bank_only",
      merchantTransactionId: `bank:${bankTransaction.bankTransactionId}`,
      postedDate: bankTransaction.postedOn,
      merchantId: merchantIdentity.merchantId,
      vatId: merchantIdentity.vatId,
      sourceBankTransactionId: bankTransaction.bankTransactionId,
      sourceReceiptId: null,
    })
  }

  return merchantTransactions
}

function buildLabelAssignments(input: {
  receipts: CanonicalReceipt[]
  bankTransactions: CanonicalBankTransaction[]
  merchants: MerchantRecord[]
  merchantTransactions: MerchantTransactionRecord[]
  labelingService: LabelingService
}): LabelAssignmentRecord[] {
  const {
    bankTransactions,
    labelingService,
    merchantTransactions,
    merchants,
    receipts,
  } = input
  const receiptById = new Map(
    receipts.map((receipt) => [receipt.receiptId, receipt] as const),
  )
  const bankTransactionById = new Map(
    bankTransactions.map(
      (bankTransaction) =>
        [bankTransaction.bankTransactionId, bankTransaction] as const,
    ),
  )
  const merchantById = new Map(
    merchants.map((merchant) => [merchant.merchantId, merchant] as const),
  )

  return merchantTransactions.flatMap((merchantTransaction) => {
    const merchant = merchantById.get(merchantTransaction.merchantId)

    if (!merchant) {
      return []
    }

    const suggestion = labelingService.suggestLabel({
      bankTransaction:
        merchantTransaction.sourceBankTransactionId === null
          ? null
          : (bankTransactionById.get(
              merchantTransaction.sourceBankTransactionId,
            ) ?? null),
      merchantTransaction,
      receipt:
        merchantTransaction.sourceReceiptId === null
          ? null
          : (receiptById.get(merchantTransaction.sourceReceiptId) ?? null),
      merchant,
    })

    if (!suggestion) {
      return []
    }

    return [
      {
        active: true,
        createdBy: "system",
        labelId: suggestion.labelId,
        merchantTransactionId: merchantTransaction.merchantTransactionId,
        reason: suggestion.reason,
        source: suggestion.source,
      },
    ]
  })
}

export function buildMerchantProjection(input: {
  receipts: CanonicalReceipt[]
  bankTransactions: CanonicalBankTransaction[]
  candidateMatchIndex: CandidateMatchIndex
  labelingService: LabelingService
}): MerchantProjection {
  const merchantMap: MerchantMap = new Map()
  const merchantTransactions = buildMerchantTransactions({
    bankTransactions: input.bankTransactions,
    candidateMatchIndex: input.candidateMatchIndex,
    merchantMap,
    receipts: input.receipts,
  })
  const merchants = [...merchantMap.values()].map((record) => ({
    ...record,
    aliases: [...new Set(record.aliases)].sort(),
  }))
  const labelAssignments = buildLabelAssignments({
    bankTransactions: input.bankTransactions,
    labelingService: input.labelingService,
    merchants,
    merchantTransactions,
    receipts: input.receipts,
  })

  return {
    labelAssignments,
    merchants,
    merchantTransactions,
  }
}
