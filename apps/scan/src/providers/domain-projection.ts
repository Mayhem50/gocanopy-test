import { createProjectionHandler } from "@gocanopy/projection"

import type { DomainProjectionService } from "./types"

export function createInProcessDomainProjectionService(): DomainProjectionService {
  const handler = createProjectionHandler()

  return {
    async projectReceipt(input) {
      await handler.projectReceipt({
        receiptId: input.receiptId,
      })
    },
  }
}
