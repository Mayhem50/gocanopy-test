import {
  createProjectionProviders,
  type LoadCanonicalFactsResult,
  type ProjectionProviders,
} from "./providers/index"
import { ProjectionTargetNotFoundError } from "./errors"
import { buildScopedSnapshotForTarget } from "./helpers"
import type { ProjectionHandler } from "./types"

async function buildProjectionAndPersist(
  canonicalFacts: LoadCanonicalFactsResult,
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
): Promise<void> {
  const existingRelations =
    await providers.projectionStore.loadProjectionRelations()
  const { scope, snapshot } = buildScopedSnapshotForTarget({
    bankTransactions: canonicalFacts.bankTransactions,
    existingRelations,
    labelingService: providers.labelingService,
    receipts: canonicalFacts.receipts,
    target,
  })

  await providers.projectionStore.replaceProjectionSnapshot({
    scope,
    snapshot,
    target,
  })
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
      const canonicalFacts =
        await providers.projectionStore.loadCanonicalFacts()
      const receiptExists = canonicalFacts.receipts.some(
        (receipt) => receipt.receiptId === input.receiptId,
      )

      if (!receiptExists) {
        throw new ProjectionTargetNotFoundError("receipt_not_found")
      }

      await buildProjectionAndPersist(canonicalFacts, providers, {
        receiptId: input.receiptId,
        type: "receipt",
      })

      return {
        summary: await providers.projectionStore.getProjectionRunSummary(),
        trigger: "receipt",
      }
    },
    async projectStatement(input) {
      const canonicalFacts =
        await providers.projectionStore.loadCanonicalFacts()
      const statementExists = canonicalFacts.bankTransactions.some(
        (transaction) =>
          transaction.statementImportId === input.statementImportId,
      )

      if (!statementExists) {
        throw new ProjectionTargetNotFoundError("statement_import_not_found")
      }

      await buildProjectionAndPersist(canonicalFacts, providers, {
        statementImportId: input.statementImportId,
        type: "statement",
      })

      return {
        summary: await providers.projectionStore.getProjectionRunSummary(),
        trigger: "statement",
      }
    },
  }
}
