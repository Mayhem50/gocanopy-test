import {
  createProjectionProviders,
  type ProjectionProviders,
} from "./providers/index"
import type { ProjectionSnapshot } from "./providers/index"
import { ProjectionTargetNotFoundError } from "./errors"
import { buildSnapshot, createRunSummary } from "./helpers"
import type { ProjectionHandler } from "./types"

async function buildProjectionAndPersist(
  providers: ProjectionProviders,
  target:
    | {
        receiptId: string
        type: "receipt"
      }
    | {
        statementImportId: string
        type: "statement"
      },
): Promise<ProjectionSnapshot> {
  const { receipts, bankTransactions } =
    await providers.projectionStore.loadCanonicalFacts()
  const snapshot = buildSnapshot(
    receipts,
    bankTransactions,
    providers.labelingService,
  )

  await providers.projectionStore.replaceProjectionSnapshot({
    snapshot,
    target,
  })

  return snapshot
}

export function createProjectionHandler(
  providers: ProjectionProviders = createProjectionProviders(),
): ProjectionHandler {
  return {
    async getMerchantTransactions() {
      return {
        rows: await providers.projectionStore.getMerchantTransactionTableRows(),
      }
    },
    async getSpendMix() {
      return {
        slices: await providers.projectionStore.getSpendMixSlices(),
      }
    },
    async projectReceipt(input) {
      const { receipts } = await providers.projectionStore.loadCanonicalFacts()
      const receiptExists = receipts.some(
        (receipt) => receipt.receiptId === input.receiptId,
      )

      if (!receiptExists) {
        throw new ProjectionTargetNotFoundError("receipt_not_found")
      }

      const snapshot = await buildProjectionAndPersist(providers, {
        receiptId: input.receiptId,
        type: "receipt",
      })

      return {
        summary: createRunSummary(snapshot),
        trigger: "receipt",
      }
    },
    async projectStatement(input) {
      const { bankTransactions } =
        await providers.projectionStore.loadCanonicalFacts()
      const statementExists = bankTransactions.some(
        (transaction) =>
          transaction.statementImportId === input.statementImportId,
      )

      if (!statementExists) {
        throw new ProjectionTargetNotFoundError(
          "statement_import_not_found",
        )
      }

      const snapshot = await buildProjectionAndPersist(providers, {
        statementImportId: input.statementImportId,
        type: "statement",
      })

      return {
        summary: createRunSummary(snapshot),
        trigger: "statement",
      }
    },
  }
}
