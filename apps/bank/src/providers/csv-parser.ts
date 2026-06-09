import { BankStatementRejectedError } from "../errors"
import type {
  MalformedStatementRow,
  ParsedBankTransaction,
  StatementCsvParser,
  StatementRowValues,
} from "./types"

const EXPECTED_HEADER = [
  "date",
  "description",
  "amount_eur",
  "balance_eur",
  "currency",
] as const

const intlObject = Intl as typeof Intl & {
  supportedValuesOf?: (key: string) => string[]
}

const SUPPORTED_CURRENCY_CODES = new Set(
  typeof intlObject.supportedValuesOf === "function"
    ? intlObject.supportedValuesOf("currency")
    : ["EUR", "USD", "GBP"],
)

type ParsedCsvRecord = {
  sourceRowNumber: number
  values: string[]
}

type ValidStatementRow = {
  balance: string
  transaction: ParsedBankTransaction
}

function normalizeBankDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase()
}

function isEmptyCsvRecord(record: ParsedCsvRecord): boolean {
  return record.values.every((value) => value.trim().length === 0)
}

function toRawValues(values: string[]): StatementRowValues {
  return {
    amountEur: values[2] ?? "",
    balanceEur: values[3] ?? "",
    currency: values[4] ?? "",
    date: values[0] ?? "",
    description: values[1] ?? "",
  }
}

function parseDecimal(value: string): string | null {
  const normalizedValue = value.trim()

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)

  if (!Number.isFinite(parsedValue)) {
    return null
  }

  return parsedValue.toFixed(2)
}

function parsePostedOn(value: string): string | null {
  const trimmedValue = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return null
  }

  const parsedDate = new Date(`${trimmedValue}T00:00:00.000Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  if (parsedDate.toISOString().slice(0, 10) !== trimmedValue) {
    return null
  }

  return trimmedValue
}

function parseCurrency(value: string): string | null {
  const normalizedValue = value.trim().toUpperCase()

  if (!SUPPORTED_CURRENCY_CODES.has(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function sortTransactions(
  transactions: ParsedBankTransaction[],
): ParsedBankTransaction[] {
  return [...transactions].sort((left, right) => {
    if (left.postedOn === right.postedOn) {
      return left.sourceRowNumber - right.sourceRowNumber
    }

    return left.postedOn.localeCompare(right.postedOn)
  })
}

function parseCsvRecords(csvContent: string): ParsedCsvRecord[] {
  const records: ParsedCsvRecord[] = []
  let currentValue = ""
  let currentRecord: string[] = []
  let inQuotes = false

  const pushRecord = (): void => {
    records.push({
      sourceRowNumber: records.length + 1,
      values: currentRecord,
    })
    currentRecord = []
  }

  for (let index = 0; index < csvContent.length; index += 1) {
    const character = csvContent[index]

    if (character === '"') {
      const nextCharacter = csvContent[index + 1]

      if (inQuotes && nextCharacter === '"') {
        currentValue += '"'
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (character === "," && !inQuotes) {
      currentRecord.push(currentValue)
      currentValue = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && csvContent[index + 1] === "\n") {
        index += 1
      }

      currentRecord.push(currentValue)
      currentValue = ""
      pushRecord()
      continue
    }

    currentValue += character
  }

  if (inQuotes) {
    throw new Error("statement_csv_quotes_unbalanced")
  }

  if (currentValue.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentValue)
    pushRecord()
  }

  return records.filter((record, index) => {
    return !(index === records.length - 1 && isEmptyCsvRecord(record))
  })
}

function deriveBalanceAnchors(validRows: ValidStatementRow[]): {
  closingBalance: string | null
  openingBalance: string | null
} {
  const firstRow = validRows[0]
  const lastRow = validRows.at(-1)

  if (!firstRow || !lastRow) {
    return {
      closingBalance: null,
      openingBalance: null,
    }
  }

  return {
    closingBalance: lastRow.balance,
    openingBalance: (
      Number(firstRow.balance) - Number(firstRow.transaction.amount)
    ).toFixed(2),
  }
}

export function createStatementCsvParser(): StatementCsvParser {
  return {
    async parseStatementCsv(input) {
      const records = parseCsvRecords(input.csvContent)
      const [headerRecord, ...rowRecords] = records
      const actualHeader = headerRecord?.values ?? []

      if (
        actualHeader.length !== EXPECTED_HEADER.length ||
        actualHeader.some((value, index) => value !== EXPECTED_HEADER[index])
      ) {
        throw new BankStatementRejectedError(["invalid_statement_header"])
      }

      const malformedRows: MalformedStatementRow[] = []
      const validRows: ValidStatementRow[] = []

      for (const record of rowRecords) {
        if (isEmptyCsvRecord(record)) {
          continue
        }

        const rawValues = toRawValues(record.values)
        const errors: string[] = []

        if (record.values.length !== EXPECTED_HEADER.length) {
          errors.push("unexpected_column_count")
        }

        const postedOn = parsePostedOn(rawValues.date)
        const amount = parseDecimal(rawValues.amountEur)
        const balance = parseDecimal(rawValues.balanceEur)
        const currency = parseCurrency(rawValues.currency)
        const descriptionRaw = rawValues.description

        if (!postedOn) {
          errors.push("posted_on_invalid")
        }
        if (descriptionRaw.trim().length === 0) {
          errors.push("description_missing")
        }
        if (!amount) {
          errors.push("amount_invalid")
        }
        if (!balance) {
          errors.push("balance_invalid")
        }
        if (!currency) {
          errors.push("currency_invalid")
        }

        if (errors.length > 0) {
          malformedRows.push({
            errors,
            rawValues,
            sourceRowNumber: record.sourceRowNumber,
          })
          continue
        }

        if (!postedOn || !amount || !balance || !currency) {
          throw new Error("statement_csv_validation_invariant_broken")
        }

        const validatedPostedOn = postedOn
        const validatedAmount = amount
        const validatedBalance = balance
        const validatedCurrency = currency

        validRows.push({
          balance: validatedBalance,
          transaction: {
            amount: validatedAmount,
            currency: validatedCurrency,
            descriptionNormalized: normalizeBankDescription(descriptionRaw),
            descriptionRaw,
            postedOn: validatedPostedOn,
            sourceRowNumber: record.sourceRowNumber,
          },
        })
      }

      return {
        balanceAnchors: deriveBalanceAnchors(validRows),
        malformedRows,
        transactions: sortTransactions(
          validRows.map((validRow) => validRow.transaction),
        ),
      }
    },
  }
}
