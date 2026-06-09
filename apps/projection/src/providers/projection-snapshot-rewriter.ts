import {
  bankTransactionReceiptTable,
  bankTransactionTable,
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
  ProjectionSnapshot,
  ProjectionSnapshotTarget,
} from "./types"
import {
  createBankTransactionReceiptScopeCondition,
  createLabelAssignmentMerchantTransactionIdCondition,
  createMerchantTransactionIdCondition,
  createMerchantTransactionScopeCondition,
  createReconciliationCandidateScopeCondition,
  expandProjectionScope,
  isCandidateInScope,
  isMerchantTransactionInScope,
  type ProjectionScope,
} from "./projection-scope"

function normalizeMerchant(record: MerchantRecord): MerchantRecord {
  return {
    ...record,
    aliases: [
      ...new Set(record.aliases.filter((alias) => alias.length > 0)),
    ].sort(),
  }
}

async function createInitialScope(
  db: PostgresDb,
  target: ProjectionSnapshotTarget,
): Promise<ProjectionScope> {
  if (target.type === "receipt") {
    return {
      bankTransactionIds: new Set<string>(),
      receiptIds: new Set<string>([target.receiptId]),
    }
  }

  const statementBankTransactions = await db
    .select({
      bankTransactionId: bankTransactionTable.bankTransactionId,
    })
    .from(bankTransactionTable)
    .where(eq(bankTransactionTable.statementImportId, target.statementImportId))

  return {
    bankTransactionIds: new Set(
      statementBankTransactions.map(
        (transaction) => transaction.bankTransactionId,
      ),
    ),
    receiptIds: new Set<string>(),
  }
}

export async function replaceProjectionSnapshot(input: {
  db: PostgresDb
  snapshot: ProjectionSnapshot
  target: ProjectionSnapshotTarget
}): Promise<void> {
  const { db, snapshot, target } = input
  const [
    existingReconciliationCandidates,
    existingBankTransactionReceipts,
    existingMerchantTransactions,
  ] = await Promise.all([
    db
      .select({
        bankTransactionId: reconciliationCandidateTable.bankTransactionId,
        receiptId: reconciliationCandidateTable.receiptId,
      })
      .from(reconciliationCandidateTable),
    db
      .select({
        bankTransactionId: bankTransactionReceiptTable.bankTransactionId,
        receiptId: bankTransactionReceiptTable.receiptId,
      })
      .from(bankTransactionReceiptTable),
    db
      .select({
        merchantTransactionId: merchantTransactionTable.merchantTransactionId,
        merchantId: merchantTransactionTable.merchantId,
        vatId: merchantTransactionTable.vatId,
        sourceBankTransactionId:
          merchantTransactionTable.sourceBankTransactionId,
        sourceReceiptId: merchantTransactionTable.sourceReceiptId,
      })
      .from(merchantTransactionTable),
  ])

  const scope = expandProjectionScope(await createInitialScope(db, target), {
    bankTransactionReceipts: [
      ...existingBankTransactionReceipts,
      ...snapshot.bankTransactionReceipts,
    ],
    merchantTransactions: [
      ...existingMerchantTransactions,
      ...snapshot.merchantTransactions,
    ],
    reconciliationCandidates: [
      ...existingReconciliationCandidates,
      ...snapshot.reconciliationCandidates,
    ],
  })
  const receiptIds = [...scope.receiptIds]
  const bankTransactionIds = [...scope.bankTransactionIds]
  const scopedReconciliationCandidates =
    snapshot.reconciliationCandidates.filter((candidate) =>
      isCandidateInScope(candidate, scope),
    )
  const scopedBankTransactionReceipts = snapshot.bankTransactionReceipts.filter(
    (link) => isCandidateInScope(link, scope),
  )
  const scopedMerchantTransactions = snapshot.merchantTransactions.filter(
    (merchantTransaction) =>
      isMerchantTransactionInScope(merchantTransaction, scope),
  )
  const scopedMerchantTransactionIds = scopedMerchantTransactions.map(
    (merchantTransaction) => merchantTransaction.merchantTransactionId,
  )
  const existingScopedMerchantTransactions =
    existingMerchantTransactions.filter((merchantTransaction) =>
      isMerchantTransactionInScope(merchantTransaction, scope),
    )
  const existingScopedMerchantTransactionIds =
    existingScopedMerchantTransactions.map(
      (merchantTransaction) => merchantTransaction.merchantTransactionId,
    )
  const disappearingMerchantTransactionIds =
    existingScopedMerchantTransactionIds.filter(
      (merchantTransactionId) =>
        !scopedMerchantTransactionIds.includes(merchantTransactionId),
    )
  const scopedMerchantIds = new Set(
    scopedMerchantTransactions.map(
      (merchantTransaction) => merchantTransaction.merchantId,
    ),
  )
  const scopedMerchants = snapshot.merchants
    .filter((merchant) => scopedMerchantIds.has(merchant.merchantId))
    .map(normalizeMerchant)
  const merchantsToCheck = new Set(
    existingMerchantTransactions
      .filter((merchantTransaction) =>
        isMerchantTransactionInScope(merchantTransaction, scope),
      )
      .map((merchantTransaction) => merchantTransaction.merchantId),
  )

  for (const merchant of scopedMerchants) {
    merchantsToCheck.add(merchant.merchantId)
  }

  await db.transaction(async (transaction) => {
    const candidateCondition = createReconciliationCandidateScopeCondition(
      receiptIds,
      bankTransactionIds,
    )

    if (candidateCondition) {
      await transaction
        .delete(reconciliationCandidateTable)
        .where(candidateCondition)
    }

    const linkCondition = createBankTransactionReceiptScopeCondition(
      receiptIds,
      bankTransactionIds,
    )

    if (linkCondition) {
      await transaction.delete(bankTransactionReceiptTable).where(linkCondition)
    }

    const merchantCondition = createMerchantTransactionScopeCondition(
      receiptIds,
      bankTransactionIds,
    )

    if (merchantCondition) {
      const disappearingMerchantTransactionCondition =
        createMerchantTransactionIdCondition(disappearingMerchantTransactionIds)

      if (disappearingMerchantTransactionCondition) {
        const disappearingLabelAssignmentCondition =
          createLabelAssignmentMerchantTransactionIdCondition(
            disappearingMerchantTransactionIds,
          )

        if (disappearingLabelAssignmentCondition) {
          await transaction
            .delete(labelAssignmentTable)
            .where(disappearingLabelAssignmentCondition)
        }

        await transaction
          .delete(merchantTransactionTable)
          .where(disappearingMerchantTransactionCondition)
      }
    }

    for (const label of snapshot.labels) {
      await transaction
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

    for (const merchant of scopedMerchants) {
      await transaction
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

    if (scopedMerchantTransactions.length > 0) {
      for (const merchantTransaction of scopedMerchantTransactions) {
        await transaction
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
              sourceBankTransactionId:
                merchantTransaction.sourceBankTransactionId,
              sourceReceiptId: merchantTransaction.sourceReceiptId,
              updatedAt: new Date(),
            },
            target: merchantTransactionTable.merchantTransactionId,
          })
      }
    }

    if (scopedBankTransactionReceipts.length > 0) {
      await transaction
        .insert(bankTransactionReceiptTable)
        .values(scopedBankTransactionReceipts)
    }

    if (scopedReconciliationCandidates.length > 0) {
      await transaction
        .insert(reconciliationCandidateTable)
        .values(scopedReconciliationCandidates)
    }

    const scopedLabelAssignmentCondition =
      createLabelAssignmentMerchantTransactionIdCondition(
        scopedMerchantTransactionIds,
      )

    if (scopedLabelAssignmentCondition) {
      const activeUserAssignments = await transaction
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

      await transaction
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

      const scopedLabelAssignments = snapshot.labelAssignments.filter(
        (labelAssignment) =>
          scopedMerchantTransactionIds.includes(
            labelAssignment.merchantTransactionId,
          ) &&
          !merchantTransactionIdsWithUserAssignments.has(
            labelAssignment.merchantTransactionId,
          ),
      )

      if (scopedLabelAssignments.length > 0) {
        for (const labelAssignment of scopedLabelAssignments) {
          await transaction
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
    }

    for (const merchantId of merchantsToCheck) {
      const remainingMerchantTransactions = await transaction
        .select({
          merchantId: merchantTransactionTable.merchantId,
        })
        .from(merchantTransactionTable)
        .where(eq(merchantTransactionTable.merchantId, merchantId))
        .limit(1)

      if (remainingMerchantTransactions.length === 0) {
        await transaction
          .delete(merchantTable)
          .where(eq(merchantTable.merchantId, merchantId))
      }
    }
  })
}
