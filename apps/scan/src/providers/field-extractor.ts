import type {
  ExtractReceiptFieldsInput,
  ExtractReceiptFieldsResult,
  OcrLine,
  PaymentMethod,
  ReceiptField,
  ReceiptItem,
  ReceiptFieldExtractor,
} from "./types"

const DATE_PATTERNS = [
  /(?:^|\b)(?<year>\d{4})[-/](?<month>\d{2})[-/](?<day>\d{2})(?:\b|$)/,
  /(?:^|\b)(?<day>\d{2})[-/](?<month>\d{2})[-/](?<year>\d{4})(?:\b|$)/,
  /(?:^|\b)(?<day>\d{2})[-/](?<month>\d{2})[-/](?<year>\d{2})(?:\b|$)/,
  /(?:^|\b)(?<day>\d{2})\s+(?<monthName>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?<year>\d{4})(?:\b|$)/i,
]
const VAT_ID_PATTERNS = [
  /\bVAT(?:\s+REG(?:ISTRATION)?)?[:\s-]*(?<vat>[A-Z]{2}[A-Z0-9]{5,12})\b/i,
]

const AMOUNT_PATTERNS = [
  /(?<currency>EUR|USD|GBP|€|\$|£)\s*(?<amount>\d+(?:[.,]\d{2}))/gi,
  /(?<amount>\d+(?:[.,]\d{2}))\s*(?<currency>EUR|USD|GBP|€|\$|£)/gi,
]
const TRAILING_AMOUNT_PATTERN =
  /^(?<description>.*?)(?<amount>\d+(?:[.,]\d{2}))\s*(?<currency>EUR|USD|GBP|€|\$|£)?$/i
const QUANTITY_PATTERN =
  /(?<quantity>\d+(?:[.,]\d+)?)\s*(?:x|qty)\s*(?<unitPrice>\d+(?:[.,]\d{2}))?/i

type Analysis = {
  merchant: ReceiptField<string> | null
  vatId: ReceiptField<string> | null
  purchasedOn: ReceiptField<string> | null
  totalAmount: ReceiptField<string> | null
  vatAmount: ReceiptField<string> | null
  currency: ReceiptField<string> | null
  paymentMethod: ReceiptField<PaymentMethod> | null
  cardLast4: ReceiptField<string> | null
  items: ReceiptItem[]
}

type AmountExtraction = {
  totalAmount: ReceiptField<string> | null
  vatAmount: ReceiptField<string> | null
  currency: ReceiptField<string> | null
}

const MONTH_NAMES: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
}

function normalizeDate(match: RegExpExecArray): string | null {
  const groups = match.groups

  if (!groups) {
    return null
  }

  const day = groups.day
  const month = groups.month ?? normalizeMonthName(groups.monthName)
  const year = groups.year

  if (!day || !month || !year) {
    return null
  }

  return `${normalizeYear(year)}-${month}-${day}`
}

function normalizeMonthName(monthName: string | undefined): string | null {
  if (!monthName) {
    return null
  }

  return MONTH_NAMES[monthName.toLowerCase()] ?? null
}

function normalizeYear(year: string): string {
  if (year.length === 2) {
    return `20${year}`
  }

  return year
}

function normalizeCurrency(currency: string): string {
  if (currency === "€") {
    return "EUR"
  }

  if (currency === "$") {
    return "USD"
  }

  if (currency === "£") {
    return "GBP"
  }

  return currency
}

function normalizeAmount(amount: string): string {
  return amount.replace(",", ".")
}

function maybeSetField<TValue>(
  currentValue: ReceiptField<TValue> | null,
  nextValue: ReceiptField<TValue> | null,
): ReceiptField<TValue> | null {
  if (!nextValue) {
    return currentValue
  }

  if (!currentValue) {
    return nextValue
  }

  const currentConfidence = currentValue.confidence ?? Number.NEGATIVE_INFINITY
  const nextConfidence = nextValue.confidence ?? Number.NEGATIVE_INFINITY

  return nextConfidence > currentConfidence ? nextValue : currentValue
}

function createField<TValue>(
  value: TValue,
  confidence: number | null,
): ReceiptField<TValue> {
  return {
    value,
    confidence,
  }
}

function analyzeLineAmounts(
  text: string,
  confidence: number | null,
): Array<{ amount: string; currency: string; numericAmount: number }> {
  const candidates: Array<{
    amount: string
    currency: string
    numericAmount: number
  }> = []

  for (const pattern of AMOUNT_PATTERNS) {
    pattern.lastIndex = 0

    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      const groups = match.groups

      if (!groups?.amount || !groups.currency) {
        continue
      }

      const amount = normalizeAmount(groups.amount)
      const numericAmount = Number(amount)

      if (!Number.isFinite(numericAmount)) {
        continue
      }

      candidates.push({
        amount,
        currency: normalizeCurrency(groups.currency),
        numericAmount,
      })
    }
  }

  return candidates
}

function isMerchantCandidate(text: string): boolean {
  if (text.length === 0) {
    return false
  }

  if (/\d/.test(text)) {
    return false
  }

  if (/vat|total|receipt|visa|mastercard|cash|eur|usd|gbp/i.test(text)) {
    return false
  }

  return true
}

function extractItem(
  text: string,
  confidence: number | null,
): ReceiptItem | null {
  const match = TRAILING_AMOUNT_PATTERN.exec(text)

  if (!match?.groups?.description || !match.groups.amount) {
    return null
  }

  if (/total|subtotal|vat|tax|change|balance|visa|mastercard/i.test(text)) {
    return null
  }

  const description = match.groups.description.trim()

  if (description.length === 0) {
    return null
  }

  if (/^(EUR|USD|GBP|€|\$|£)$/i.test(description)) {
    return null
  }

  const quantityMatch = QUANTITY_PATTERN.exec(description)

  return {
    description,
    quantity: quantityMatch?.groups?.quantity
      ? createField(quantityMatch.groups.quantity.replace(",", "."), confidence)
      : null,
    unitPrice: quantityMatch?.groups?.unitPrice
      ? createField(normalizeAmount(quantityMatch.groups.unitPrice), confidence)
      : null,
    amount: createField(normalizeAmount(match.groups.amount), confidence),
    confidence,
  }
}

function extractMerchant(lines: OcrLine[]): ReceiptField<string> | null {
  for (const line of lines) {
    const text = line.text.trim()

    if (isMerchantCandidate(text)) {
      return createField(text, line.confidence)
    }
  }

  return null
}

function extractPurchasedOn(lines: OcrLine[]): ReceiptField<string> | null {
  let purchasedOn: ReceiptField<string> | null = null

  for (const line of lines) {
    const text = line.text.trim()

    if (text.length === 0) {
      continue
    }

    for (const pattern of DATE_PATTERNS) {
      const match = pattern.exec(text)

      if (!match) {
        continue
      }

      const normalizedDate = normalizeDate(match)

      if (!normalizedDate) {
        continue
      }

      purchasedOn = maybeSetField(
        purchasedOn,
        createField(normalizedDate, line.confidence),
      )
    }
  }

  return purchasedOn
}

function extractVatId(lines: OcrLine[]): ReceiptField<string> | null {
  let vatId: ReceiptField<string> | null = null

  for (const line of lines) {
    const text = line.text.trim()

    if (text.length === 0) {
      continue
    }

    for (const pattern of VAT_ID_PATTERNS) {
      const match = pattern.exec(text)

      if (!match?.groups?.vat) {
        continue
      }

      vatId = maybeSetField(
        vatId,
        createField(match.groups.vat.toUpperCase(), line.confidence),
      )
    }
  }

  return vatId
}

function extractPaymentMethod(
  lines: OcrLine[],
): ReceiptField<PaymentMethod> | null {
  let paymentMethod: ReceiptField<PaymentMethod> | null = null

  for (const line of lines) {
    const text = line.text.trim()

    if (text.length === 0) {
      continue
    }

    if (/visa|mastercard|amex|card|debit|credit/i.test(text)) {
      paymentMethod = maybeSetField(
        paymentMethod,
        createField("card", line.confidence),
      )
      continue
    }

    if (/cash/i.test(text)) {
      paymentMethod = maybeSetField(
        paymentMethod,
        createField("cash", line.confidence),
      )
    }
  }

  return paymentMethod
}

function extractCardLast4(lines: OcrLine[]): ReceiptField<string> | null {
  let cardLast4: ReceiptField<string> | null = null

  for (const line of lines) {
    const text = line.text.trim()

    if (text.length === 0) {
      continue
    }

    const cardLast4Match =
      /(?:ending|last\s*4|card|visa|mastercard)[^\d]{0,10}(?<last4>\d{4})/i.exec(
        text,
      )

    if (!cardLast4Match?.groups?.last4) {
      continue
    }

    cardLast4 = maybeSetField(
      cardLast4,
      createField(cardLast4Match.groups.last4, line.confidence),
    )
  }

  return cardLast4
}

function extractItems(lines: OcrLine[]): ReceiptItem[] {
  const items: ReceiptItem[] = []

  for (const line of lines) {
    const text = line.text.trim()

    if (text.length === 0) {
      continue
    }

    const item = extractItem(text, line.confidence)

    if (item) {
      items.push(item)
    }
  }

  return items
}

function extractAmounts(lines: OcrLine[]): AmountExtraction {
  let totalAmount: ReceiptField<string> | null = null
  let totalNumericAmount: number | null = null
  let vatAmount: ReceiptField<string> | null = null
  let currency: ReceiptField<string> | null = null

  for (const line of lines) {
    const text = line.text.trim()

    if (text.length === 0) {
      continue
    }

    const amountCandidates = analyzeLineAmounts(text, line.confidence)

    for (const amountCandidate of amountCandidates) {
      if (/vat|tax/i.test(text)) {
        vatAmount = maybeSetField(
          vatAmount,
          createField(amountCandidate.amount, line.confidence),
        )
        currency = maybeSetField(
          currency,
          createField(amountCandidate.currency, line.confidence),
        )
        continue
      }

      const isPreferredTotalLine = /total|amount due|grand total/i.test(text)
      const shouldReplaceTotal =
        totalAmount === null ||
        isPreferredTotalLine ||
        amountCandidate.numericAmount >
          (totalNumericAmount ?? Number.NEGATIVE_INFINITY)

      if (!shouldReplaceTotal) {
        continue
      }

      totalAmount = createField(amountCandidate.amount, line.confidence)
      totalNumericAmount = amountCandidate.numericAmount
      currency = createField(amountCandidate.currency, line.confidence)
    }
  }

  return {
    totalAmount,
    vatAmount,
    currency,
  }
}

function analyzeLines(lines: OcrLine[]): Analysis {
  // Receipts contain few OCR lines. Re-reading them per extraction rule keeps
  // the logic simpler than sharing one mutable accumulator across all rules.
  const amounts = extractAmounts(lines)

  return {
    merchant: extractMerchant(lines),
    vatId: extractVatId(lines),
    purchasedOn: extractPurchasedOn(lines),
    totalAmount: amounts.totalAmount,
    vatAmount: amounts.vatAmount,
    currency: amounts.currency,
    paymentMethod: extractPaymentMethod(lines),
    cardLast4: extractCardLast4(lines),
    items: extractItems(lines),
  }
}

export function createReceiptFieldExtractor(): ReceiptFieldExtractor {
  const extractReceiptFields: ReceiptFieldExtractor["extractReceiptFields"] =
    async (input: ExtractReceiptFieldsInput) => {
      const analysis = analyzeLines(input.lines)
      const errors: string[] = []
      const warnings: string[] = []

      if (!analysis.merchant) {
        errors.push("merchant_not_found")
      }

      if (!analysis.vatId) {
        errors.push("vat_id_not_found")
      }

      if (!analysis.purchasedOn) {
        errors.push("purchased_on_not_found")
      }

      if (!analysis.totalAmount) {
        errors.push("total_amount_not_found")
      }

      if (!analysis.currency) {
        errors.push("currency_not_found")
      }

      if (!analysis.vatAmount) {
        warnings.push("vat_amount_not_found")
      }

      if (!analysis.paymentMethod) {
        warnings.push("payment_method_not_found")
      }

      if (analysis.paymentMethod?.value === "card" && !analysis.cardLast4) {
        warnings.push("card_last4_not_found")
      }

      if (analysis.items.length === 0) {
        warnings.push("items_not_found")
      }

      return {
        merchant: analysis.merchant,
        vatId: analysis.vatId,
        purchasedOn: analysis.purchasedOn,
        totalAmount: analysis.totalAmount,
        vatAmount: analysis.vatAmount,
        currency: analysis.currency,
        paymentMethod: analysis.paymentMethod,
        cardLast4: analysis.cardLast4,
        items: analysis.items,
        errors,
        warnings,
      }
    }

  return {
    extractReceiptFields,
  }
}
