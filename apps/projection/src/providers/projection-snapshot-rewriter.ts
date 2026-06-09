import {
  bankTransactionReceiptTable,
  labelAssignmentTable,
  labelTable,
  merchantTable,
  merchantTransactionTable,
  reconciliationCandidateTable,
  type PostgresDb,
} from "@gocanopy/models"
import { and, eq, ne } from "drizzle-orm"

import type {
  MerchantRecord,
  ProjectionScope,
  ProjectionSnapshot,
} from "./types"
import {
  createBankTransactionReceiptScopeCondition,
  createLabelAssignmentMerchantTransactionIdCondition,
  createMerchantTransactionIdCondition,
  createReconciliationCandidateScopeCondition,
} from "./projection-scope"

type ExistingMerchantTransaction = {
  merchantId: string
  merchantTransactionId: string
  sourceBankTransactionId: string | null
  sourceReceiptId: string | null
}

type ProjectionTransaction = Parameters<
  Parameters<PostgresDb["transaction"]>[0]
>[0]

type PreparedSnapshotWrite = {
  bankTransactionIds: string[]
  disappearingMerchantTransactionIds: string[]
  merchantTransactionIds: string[]
  merchantTransactions: ProjectionSnapshot["merchantTransactions"]
  merchants: MerchantRecord[]
  merchantsToCheck: Set<string>
  receiptIds: string[]
}

function normalizeMerchant(record: MerchantRecord): MerchantRecord {
  return {
    ...record,
    aliases: [
      ...new Set(record.aliases.filter((alias) => alias.length > 0)),
    ].sort(),
  }
}

async function loadExistingMerchantTransactions(
  db: PostgresDb,
): Promise<ExistingMerchantTransaction[]> {
  return db
    .select({
      merchantId: merchantTransactionTable.merchantId,
      merchantTransactionId: merchantTransactionTable.merchantTransactionId,
      sourceBankTransactionId: merchantTransactionTable.sourceBankTransactionId,
      sourceReceiptId: merchantTransactionTable.sourceReceiptId,
    })
    .from(merchantTransactionTable)
}

function isMerchantTransactionInScope(
  merchantTransaction: ExistingMerchantTransaction,
  scope: ProjectionScope,
): boolean {
  return (
    (merchantTransaction.sourceReceiptId !== null &&
      scope.receiptIds.has(merchantTransaction.sourceReceiptId)) ||
    (merchantTransaction.sourceBankTransactionId !== null &&
      scope.bankTransactionIds.has(merchantTransaction.sourceBankTransactionId))
  )
}

function prepareSnapshotWrite(input: {
  existingMerchantTransactions: ExistingMerchantTransaction[]
  scope: ProjectionScope
  snapshot: ProjectionSnapshot
}): PreparedSnapshotWrite {
  const receiptIds = [...input.scope.receiptIds]
  const bankTransactionIds = [...input.scope.bankTransactionIds]
  const merchantTransactions = input.snapshot.merchantTransactions
  const merchantTransactionIds = merchantTransactions.map(
    (merchantTransaction) => merchantTransaction.merchantTransactionId,
  )
  const existingScopedMerchantTransactions =
    input.existingMerchantTransactions.filter((merchantTransaction) =>
      isMerchantTransactionInScope(merchantTransaction, input.scope),
    )
  const disappearingMerchantTransactionIds = existingScopedMerchantTransactions
    .map((merchantTransaction) => merchantTransaction.merchantTransactionId)
    .filter(
      (merchantTransactionId) =>
        !merchantTransactionIds.includes(merchantTransactionId),
    )
  const scopedMerchantIds = new Set(
    merchantTransactions.map(
      (merchantTransaction) => merchantTransaction.merchantId,
    ),
  )
  const merchants = input.snapshot.merchants
    .filter((merchant) => scopedMerchantIds.has(merchant.merchantId))
    .map(normalizeMerchant)
  const merchantsToCheck = new Set(
    existingScopedMerchantTransactions.map(
      (merchantTransaction) => merchantTransaction.merchantId,
    ),
  )

  for (const merchant of merchants) {
    merchantsToCheck.add(merchant.merchantId)
  }

  return {
    bankTransactionIds,
    disappearingMerchantTransactionIds,
    merchantTransactionIds,
    merchantTransactions,
    merchants,
    merchantsToCheck,
    receiptIds,
  }
}

async function deleteScopedCandidateRows(input: {
  bankTransactionIds: string[]
  receiptIds: string[]
  transaction: ProjectionTransaction
}): Promise<void> {
  const candidateCondition = createReconciliationCandidateScopeCondition(
    input.receiptIds,
    input.bankTransactionIds,
  )

  if (candidateCondition) {
    await input.transaction
      .delete(reconciliationCandidateTable)
      .where(candidateCondition)
  }
}

async function deleteScopedReceiptLinks(input: {
  bankTransactionIds: string[]
  receiptIds: string[]
  transaction: ProjectionTransaction
}): Promise<void> {
  const linkCondition = createBankTransactionReceiptScopeCondition(
    input.receiptIds,
    input.bankTransactionIds,
  )

  if (linkCondition) {
    await input.transaction
      .delete(bankTransactionReceiptTable)
      .where(linkCondition)
  }
}

async function deleteDisappearingMerchantTransactions(input: {
  disappearingMerchantTransactionIds: string[]
  transaction: ProjectionTransaction
}): Promise<void> {
  const disappearingMerchantTransactionCondition =
    createMerchantTransactionIdCondition(
      input.disappearingMerchantTransactionIds,
    )

  if (!disappearingMerchantTransactionCondition) {
    return
  }

  const disappearingLabelAssignmentCondition =
    createLabelAssignmentMerchantTransactionIdCondition(
      input.disappearingMerchantTransactionIds,
    )

  if (disappearingLabelAssignmentCondition) {
    await input.transaction
      .delete(labelAssignmentTable)
      .where(disappearingLabelAssignmentCondition)
  }

  await input.transaction
    .delete(merchantTransactionTable)
    .where(disappearingMerchantTransactionCondition)
}

async function upsertLabels(input: {
  labels: ProjectionSnapshot["labels"]
  transaction: ProjectionTransaction
}): Promise<void> {
  for (const label of input.labels) {
    await input.transaction
      .insert(labelTable)
      .values(label)
      .onConflictDoUpdate({
        set: {
          createdBy: label.createdBy,
          name: label.name,
          parentId: label.parentId,
          status: label.status,
        },
        target: labelTable.labelId,
      })
  }
}

async function upsertMerchants(input: {
  merchants: MerchantRecord[]
  transaction: ProjectionTransaction
}): Promise<void> {
  for (const merchant of input.merchants) {
    await input.transaction
      .insert(merchantTable)
      .values(merchant)
      .onConflictDoUpdate({
        set: {
          aliases: merchant.aliases,
          displayName: merchant.displayName,
          updatedAt: new Date(),
          vatId: merchant.vatId,
        },
        target: merchantTable.merchantId,
      })
  }
}

async function upsertMerchantTransactions(input: {
  merchantTransactions: ProjectionSnapshot["merchantTransactions"]
  transaction: ProjectionTransaction
}): Promise<void> {
  for (const merchantTransaction of input.merchantTransactions) {
    await input.transaction
      .insert(merchantTransactionTable)
      .values(merchantTransaction)
      .onConflictDoUpdate({
        set: {
          amount: merchantTransaction.amount,
          currency: merchantTransaction.currency,
          effectiveDate: merchantTransaction.effectiveDate,
          matchStatus: merchantTransaction.matchStatus,
          postedDate: merchantTransaction.postedDate,
          merchantId: merchantTransaction.merchantId,
          vatId: merchantTransaction.vatId,
          sourceBankTransactionId: merchantTransaction.sourceBankTransactionId,
          sourceReceiptId: merchantTransaction.sourceReceiptId,
          updatedAt: new Date(),
        },
        target: merchantTransactionTable.merchantTransactionId,
      })
  }
}

async function insertScopedLinksAndCandidates(input: {
  bankTransactionReceipts: ProjectionSnapshot["bankTransactionReceipts"]
  reconciliationCandidates: ProjectionSnapshot["reconciliationCandidates"]
  transaction: ProjectionTransaction
}): Promise<void> {
  if (input.bankTransactionReceipts.length > 0) {
    await input.transaction
      .insert(bankTransactionReceiptTable)
      .values(input.bankTransactionReceipts)
  }

  if (input.reconciliationCandidates.length > 0) {
    await input.transaction
      .insert(reconciliationCandidateTable)
      .values(input.reconciliationCandidates)
  }
}

async function replaceSystemLabelAssignments(input: {
  labelAssignments: ProjectionSnapshot["labelAssignments"]
  merchantTransactionIds: string[]
  transaction: ProjectionTransaction
}): Promise<void> {
  const scopedLabelAssignmentCondition =
    createLabelAssignmentMerchantTransactionIdCondition(
      input.merchantTransactionIds,
    )

  if (!scopedLabelAssignmentCondition) {
    return
  }

  const activeUserAssignments = await input.transaction
    .select({
      merchantTransactionId: labelAssignmentTable.merchantTransactionId,
    })
    .from(labelAssignmentTable)
    .where(
      and(
        eq(labelAssignmentTable.active, true),
        eq(labelAssignmentTable.source, "user"),
        scopedLabelAssignmentCondition,
      ),
    )

  const merchantTransactionIdsWithUserAssignments = new Set(
    activeUserAssignments.map(
      (labelAssignment) => labelAssignment.merchantTransactionId,
    ),
  )

  await input.transaction
    .update(labelAssignmentTable)
    .set({
      active: false,
    })
    .where(
      and(
        eq(labelAssignmentTable.active, true),
        ne(labelAssignmentTable.source, "user"),
        scopedLabelAssignmentCondition,
      ),
    )

  const labelAssignments = input.labelAssignments.filter(
    (labelAssignment) =>
      input.merchantTransactionIds.includes(
        labelAssignment.merchantTransactionId,
      ) &&
      !merchantTransactionIdsWithUserAssignments.has(
        labelAssignment.merchantTransactionId,
      ),
  )

  for (const labelAssignment of labelAssignments) {
    await input.transaction
      .insert(labelAssignmentTable)
      .values({
        active: labelAssignment.active,
        createdBy: labelAssignment.createdBy,
        labelId: labelAssignment.labelId,
        merchantTransactionId: labelAssignment.merchantTransactionId,
        reason: labelAssignment.reason,
        source: labelAssignment.source,
      })
      .onConflictDoUpdate({
        set: {
          active: labelAssignment.active,
          createdBy: labelAssignment.createdBy,
          reason: labelAssignment.reason,
        },
        target: [
          labelAssignmentTable.merchantTransactionId,
          labelAssignmentTable.labelId,
          labelAssignmentTable.source,
        ],
      })
  }
}

async function deleteOrphanMerchants(input: {
  merchantsToCheck: Set<string>
  transaction: ProjectionTransaction
}): Promise<void> {
  for (const merchantId of input.merchantsToCheck) {
    const remainingMerchantTransactions = await input.transaction
      .select({
        merchantId: merchantTransactionTable.merchantId,
      })
      .from(merchantTransactionTable)
      .where(eq(merchantTransactionTable.merchantId, merchantId))
      .limit(1)

    if (remainingMerchantTransactions.length === 0) {
      await input.transaction
        .delete(merchantTable)
        .where(eq(merchantTable.merchantId, merchantId))
    }
  }
}

export async function replaceProjectionSnapshot(input: {
  db: PostgresDb
  scope: ProjectionScope
  snapshot: ProjectionSnapshot
}): Promise<void> {
  const { db, scope, snapshot } = input
  const existingMerchantTransactions =
    await loadExistingMerchantTransactions(db)
  const preparedWrite = prepareSnapshotWrite({
    existingMerchantTransactions,
    scope,
    snapshot,
  })

  await db.transaction(async (transaction) => {
    await deleteScopedCandidateRows({
      bankTransactionIds: preparedWrite.bankTransactionIds,
      receiptIds: preparedWrite.receiptIds,
      transaction,
    })
    await deleteScopedReceiptLinks({
      bankTransactionIds: preparedWrite.bankTransactionIds,
      receiptIds: preparedWrite.receiptIds,
      transaction,
    })
    await deleteDisappearingMerchantTransactions({
      disappearingMerchantTransactionIds:
        preparedWrite.disappearingMerchantTransactionIds,
      transaction,
    })
    await upsertLabels({
      labels: snapshot.labels,
      transaction,
    })
    await upsertMerchants({
      merchants: preparedWrite.merchants,
      transaction,
    })
    await upsertMerchantTransactions({
      merchantTransactions: preparedWrite.merchantTransactions,
      transaction,
    })
    await insertScopedLinksAndCandidates({
      bankTransactionReceipts: snapshot.bankTransactionReceipts,
      reconciliationCandidates: snapshot.reconciliationCandidates,
      transaction,
    })
    await replaceSystemLabelAssignments({
      labelAssignments: snapshot.labelAssignments,
      merchantTransactionIds: preparedWrite.merchantTransactionIds,
      transaction,
    })
    await deleteOrphanMerchants({
      merchantsToCheck: preparedWrite.merchantsToCheck,
      transaction,
    })
  })
}
