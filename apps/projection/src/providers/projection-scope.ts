import {
  bankTransactionReceiptTable,
  labelAssignmentTable,
  merchantTransactionTable,
  reconciliationCandidateTable,
  type BankTransactionReceiptRow,
  type MerchantTransactionRow,
  type ReconciliationCandidateRow,
} from "@gocanopy/models"
import { inArray, or } from "drizzle-orm"

export type ProjectionScope = {
  bankTransactionIds: Set<string>
  receiptIds: Set<string>
}

export type ProjectionRelations = {
  bankTransactionReceipts: Pick<
    BankTransactionReceiptRow,
    "bankTransactionId" | "receiptId"
  >[]
  merchantTransactions: Pick<
    MerchantTransactionRow,
    "merchantId" | "sourceBankTransactionId" | "sourceReceiptId"
  >[]
  reconciliationCandidates: Pick<
    ReconciliationCandidateRow,
    "bankTransactionId" | "receiptId"
  >[]
}

function addAssociationScope(
  scope: ProjectionScope,
  receiptId: string,
  bankTransactionId: string,
): boolean {
  let hasChanged = false

  if (
    scope.receiptIds.has(receiptId) &&
    !scope.bankTransactionIds.has(bankTransactionId)
  ) {
    scope.bankTransactionIds.add(bankTransactionId)
    hasChanged = true
  }

  if (
    scope.bankTransactionIds.has(bankTransactionId) &&
    !scope.receiptIds.has(receiptId)
  ) {
    scope.receiptIds.add(receiptId)
    hasChanged = true
  }

  return hasChanged
}

export function expandProjectionScope(
  initialScope: ProjectionScope,
  relations: ProjectionRelations,
): ProjectionScope {
  let hasChanged = true

  while (hasChanged) {
    hasChanged = false

    for (const candidate of relations.reconciliationCandidates) {
      hasChanged =
        addAssociationScope(
          initialScope,
          candidate.receiptId,
          candidate.bankTransactionId,
        ) || hasChanged
    }

    for (const link of relations.bankTransactionReceipts) {
      hasChanged =
        addAssociationScope(
          initialScope,
          link.receiptId,
          link.bankTransactionId,
        ) || hasChanged
    }

    for (const merchantTransaction of relations.merchantTransactions) {
      if (
        merchantTransaction.sourceReceiptId &&
        merchantTransaction.sourceBankTransactionId
      ) {
        hasChanged =
          addAssociationScope(
            initialScope,
            merchantTransaction.sourceReceiptId,
            merchantTransaction.sourceBankTransactionId,
          ) || hasChanged
      }
    }
  }

  return initialScope
}

export function isCandidateInScope(
  candidate:
    | Pick<ReconciliationCandidateRow, "bankTransactionId" | "receiptId">
    | Pick<BankTransactionReceiptRow, "bankTransactionId" | "receiptId">,
  scope: ProjectionScope,
): boolean {
  return (
    scope.receiptIds.has(candidate.receiptId) ||
    scope.bankTransactionIds.has(candidate.bankTransactionId)
  )
}

export function isMerchantTransactionInScope(
  merchantTransaction: Pick<
    MerchantTransactionRow,
    "merchantId" | "sourceBankTransactionId" | "sourceReceiptId"
  >,
  scope: ProjectionScope,
): boolean {
  return (
    (merchantTransaction.sourceReceiptId !== null &&
      scope.receiptIds.has(merchantTransaction.sourceReceiptId)) ||
    (merchantTransaction.sourceBankTransactionId !== null &&
      scope.bankTransactionIds.has(merchantTransaction.sourceBankTransactionId))
  )
}

export function createReconciliationCandidateScopeCondition(
  receiptIds: string[],
  bankTransactionIds: string[],
) {
  const receiptCondition =
    receiptIds.length > 0
      ? inArray(reconciliationCandidateTable.receiptId, receiptIds)
      : undefined
  const bankTransactionCondition =
    bankTransactionIds.length > 0
      ? inArray(
          reconciliationCandidateTable.bankTransactionId,
          bankTransactionIds,
        )
      : undefined

  if (receiptCondition && bankTransactionCondition) {
    return or(receiptCondition, bankTransactionCondition)
  }

  return receiptCondition ?? bankTransactionCondition
}

export function createBankTransactionReceiptScopeCondition(
  receiptIds: string[],
  bankTransactionIds: string[],
) {
  const receiptCondition =
    receiptIds.length > 0
      ? inArray(bankTransactionReceiptTable.receiptId, receiptIds)
      : undefined
  const bankTransactionCondition =
    bankTransactionIds.length > 0
      ? inArray(
          bankTransactionReceiptTable.bankTransactionId,
          bankTransactionIds,
        )
      : undefined

  if (receiptCondition && bankTransactionCondition) {
    return or(receiptCondition, bankTransactionCondition)
  }

  return receiptCondition ?? bankTransactionCondition
}

export function createMerchantTransactionScopeCondition(
  receiptIds: string[],
  bankTransactionIds: string[],
) {
  const receiptCondition =
    receiptIds.length > 0
      ? inArray(merchantTransactionTable.sourceReceiptId, receiptIds)
      : undefined
  const bankTransactionCondition =
    bankTransactionIds.length > 0
      ? inArray(
          merchantTransactionTable.sourceBankTransactionId,
          bankTransactionIds,
        )
      : undefined

  if (receiptCondition && bankTransactionCondition) {
    return or(receiptCondition, bankTransactionCondition)
  }

  return receiptCondition ?? bankTransactionCondition
}

export function createMerchantTransactionIdCondition(
  merchantTransactionIds: string[],
) {
  return merchantTransactionIds.length > 0
    ? inArray(
        merchantTransactionTable.merchantTransactionId,
        merchantTransactionIds,
      )
    : undefined
}

export function createLabelAssignmentMerchantTransactionIdCondition(
  merchantTransactionIds: string[],
) {
  return merchantTransactionIds.length > 0
    ? inArray(
        labelAssignmentTable.merchantTransactionId,
        merchantTransactionIds,
      )
    : undefined
}
