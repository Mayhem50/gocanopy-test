export type NormalizeImageInput =
  | {
      sourceImagePath: string
    }
  | {
      sourceImageBuffer: Buffer
      sourceImageFileName?: string
    }

export type NormalizeImageResult = {
  contentHash: string
  originalImageExtension: string
  originalImagePath: string
  normalizedImagePath: string
}

export type ImageProcessor = {
  normalizeImage(input: NormalizeImageInput): Promise<NormalizeImageResult>
}

export type ExtractReceiptTextInput = {
  normalizedImagePath: string
}

export type OcrLine = {
  text: string
  confidence: number | null
}

export type ExtractReceiptTextResult = {
  ocrTextRaw: string
  lines: OcrLine[]
}

export type Ocr = {
  extractReceiptText(
    input: ExtractReceiptTextInput,
  ): Promise<ExtractReceiptTextResult>
}

export type ReceiptField<TValue> = {
  value: TValue
  confidence: number | null
}

export type PaymentMethod = "card" | "cash"

export type ReceiptItem = {
  description: string
  quantity: ReceiptField<string> | null
  unitPrice: ReceiptField<string> | null
  amount: ReceiptField<string> | null
  confidence: number | null
}

export type ExtractReceiptFieldsInput = {
  ocrTextRaw: string
  lines: OcrLine[]
}

export type ExtractReceiptFieldsResult = {
  merchant: ReceiptField<string> | null
  vatId: ReceiptField<string> | null
  purchasedOn: ReceiptField<string> | null
  totalAmount: ReceiptField<string> | null
  vatAmount: ReceiptField<string> | null
  currency: ReceiptField<string> | null
  paymentMethod: ReceiptField<PaymentMethod> | null
  cardLast4: ReceiptField<string> | null
  items: ReceiptItem[]
  errors: string[]
  warnings: string[]
}

export type ReceiptFieldExtractor = {
  extractReceiptFields(
    input: ExtractReceiptFieldsInput,
  ): Promise<ExtractReceiptFieldsResult>
}

export type SaveReceiptInput = {
  contentHash: string
  normalizedImagePath: string
  originalImageExtension: string
  originalImagePath: string
  ocrTextRaw: string
  extractedFields: ExtractReceiptFieldsResult
}

export type SavedReceipt = {
  receiptId: string
  contentHash: string
  originalImageExtension: string
  originalImagePath: string
  normalizedImagePath: string
  ocrTextRaw: string
  extractedFields: ExtractReceiptFieldsResult
}

export type DomainProjectionService = {
  projectReceipt(input: SavedReceipt): Promise<void>
}

export type ReceiptStore = {
  saveReceipt(input: SaveReceiptInput): Promise<SavedReceipt>
}

export type ScanProviders = {
  imageProcessor: ImageProcessor
  ocr: Ocr
  fieldExtractor: ReceiptFieldExtractor
  projectionService: DomainProjectionService
  receiptStore: ReceiptStore
}
