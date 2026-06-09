import { createStatementCsvParser } from "./csv-parser"
import { createInProcessDomainProjectionService } from "./domain-projection"
import { createLocalStatementFileStore } from "./statement-file-store"
import { createPostgresStatementStore } from "./statement-store"
import type { BankProviders } from "./types"

export * from "./types"

export function createBankProviders(): BankProviders {
  return {
    projectionService: createInProcessDomainProjectionService(),
    statementFileStore: createLocalStatementFileStore(),
    statementParser: createStatementCsvParser(),
    statementStore: createPostgresStatementStore(),
  }
}
