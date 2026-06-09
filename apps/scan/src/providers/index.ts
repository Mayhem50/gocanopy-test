import { createInProcessDomainProjectionService } from "./domain-projection"
import { createReceiptFieldExtractor } from "./field-extractor"
import { createLocalImageProcessor } from "./image-processor"
import { createTesseractOcr } from "./ocr"
import { createPostgresReceiptStore } from "./receipt-store"
import type { ScanProviders } from "./types"

export * from "./types"

export function createScanProviders(): ScanProviders {
  return {
    fieldExtractor: createReceiptFieldExtractor(),
    imageProcessor: createLocalImageProcessor(),
    ocr: createTesseractOcr(),
    projectionService: createInProcessDomainProjectionService(),
    receiptStore: createPostgresReceiptStore(),
  }
}
