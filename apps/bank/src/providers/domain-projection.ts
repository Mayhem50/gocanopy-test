import { createProjectionHandler } from "@gocanopy/projection"

import type { DomainProjectionService } from "./types"

export function createInProcessDomainProjectionService(): DomainProjectionService {
  const handler = createProjectionHandler()

  return {
    async projectStatement(input) {
      await handler.projectStatement({
        statementImportId: input.statementImport.statementImportId,
      })
    },
  }
}
