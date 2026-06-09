import {
  createScanProviders,
  type ExtractReceiptFieldsResult,
  type NormalizeImageInput,
  type SavedReceipt,
  type ScanProviders,
} from "./providers/index"

export class ScanReceiptRejectedError extends Error {
  readonly extractedFields: ExtractReceiptFieldsResult

  constructor(extractedFields: ExtractReceiptFieldsResult) {
    super("scan_receipt_rejected")
    this.name = "ScanReceiptRejectedError"
    this.extractedFields = extractedFields
  }
}

export type ScanHandler = {
  handle(file: File): Promise<SavedReceipt>
}

export function createScanHandler(
  providers: ScanProviders = createScanProviders(),
): ScanHandler {
  async function scanReceipt(
    normalizeImageInput: NormalizeImageInput,
  ): Promise<SavedReceipt> {
    const normalizedImage =
      await providers.imageProcessor.normalizeImage(normalizeImageInput)

    const ocrResult = await providers.ocr.extractReceiptText({
      normalizedImagePath: normalizedImage.normalizedImagePath,
    })
    const extractedFields = await providers.fieldExtractor.extractReceiptFields({
      ocrTextRaw: ocrResult.ocrTextRaw,
      lines: ocrResult.lines,
    })

    if (extractedFields.errors.length > 0) {
      throw new ScanReceiptRejectedError(extractedFields)
    }

    const savedReceipt = await providers.receiptStore.saveReceipt({
      contentHash: normalizedImage.contentHash,
      normalizedImagePath: normalizedImage.normalizedImagePath,
      originalImageExtension: normalizedImage.originalImageExtension,
      originalImagePath: normalizedImage.originalImagePath,
      ocrTextRaw: ocrResult.ocrTextRaw,
      extractedFields,
    })

    await providers.projectionService.projectReceipt(savedReceipt)

    return savedReceipt
  }

  return {
    async handle(file: File): Promise<SavedReceipt> {
      return scanReceipt({
        sourceImageBuffer: Buffer.from(await file.arrayBuffer()),
        sourceImageFileName: file.name,
      })
    },
  }
}
