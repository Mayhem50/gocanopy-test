import { mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it, vi } from "vitest"

import { BankStatementRejectedError } from "./errors"
import { createBankHandler } from "./handler"
import type { BankProviders } from "./providers/index"

const validStatementBuffer = Buffer.from(
  "date,description,amount_eur,balance_eur,currency\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
  "utf8",
)

async function createStoredStatementFile(content: string): Promise<string> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "gocanopy-bank-handler-"),
  )
  const storedStatementPath = join(temporaryDirectory, "stored-statement.csv")

  await writeFile(storedStatementPath, content, "utf8")

  return storedStatementPath
}

describe("createBankHandler", () => {
  it("stores, parses, persists, and hands off a normalized statement", async () => {
    const storedStatementPath = await createStoredStatementFile(
      "date,description,amount_eur,balance_eur,currency\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
    )
    const providers: BankProviders = {
      projectionService: {
        projectStatement: vi.fn(async () => undefined),
      },
      statementFileStore: {
        storeStatementFile: vi.fn(async () => ({
          sourceFile: "bank_transactions.csv",
          sourceFileHash:
            "2e1304c0dc426f4f8b40530bcbf5f6a7e00d4e63b1b857d3d3621937ef9ab9d7",
          storedStatementPath,
        })),
      },
      statementParser: {
        parseStatementCsv: vi.fn(async () => ({
          balanceAnchors: {
            closingBalance: "2427.06",
            openingBalance: "2437.01",
          },
          malformedRows: [
            {
              errors: ["amount_invalid"],
              rawValues: {
                amountEur: "oops",
                balanceEur: "2400.00",
                currency: "EUR",
                date: "2026-06-03",
                description: "BROKEN",
              },
              sourceRowNumber: 3,
            },
          ],
          transactions: [
            {
              amount: "-9.95",
              currency: "EUR",
              descriptionNormalized: "caffe nero ifsc dublin",
              descriptionRaw: "CAFFE NERO IFSC DUBLIN",
              postedOn: "2026-06-02",
              sourceRowNumber: 2,
            },
          ],
        })),
      },
      statementStore: {
        saveStatementImport: vi.fn(async () => ({
          isDuplicate: false,
          statementImport: {
            importStatus: "malformed" as const,
            importedAt: "2026-06-09T10:00:00.000Z",
            sourceFile: "bank_transactions.csv",
            sourceFileHash:
              "2e1304c0dc426f4f8b40530bcbf5f6a7e00d4e63b1b857d3d3621937ef9ab9d7",
            statementImportId: "statement-1",
          },
          transactions: [
            {
              amount: "-9.95",
              bankTransactionId: "txn-1",
              currency: "EUR",
              descriptionNormalized: "caffe nero ifsc dublin",
              descriptionRaw: "CAFFE NERO IFSC DUBLIN",
              postedOn: "2026-06-02",
              sourceRowNumber: 2,
              statementImportId: "statement-1",
            },
          ],
        })),
      },
    }

    const handler = createBankHandler(providers)
    const file = new File([validStatementBuffer], "bank_transactions.csv", {
      type: "text/csv",
    })
    const result = await handler.handle(file)

    expect(providers.statementFileStore.storeStatementFile).toHaveBeenCalledWith(
      {
        fileBuffer: Buffer.from(await file.arrayBuffer()),
        sourceFile: "bank_transactions.csv",
      },
    )
    expect(providers.statementParser.parseStatementCsv).toHaveBeenCalledWith({
      csvContent:
        "date,description,amount_eur,balance_eur,currency\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
    })
    expect(providers.statementStore.saveStatementImport).toHaveBeenCalledWith({
      importStatus: "malformed",
      sourceFile: "bank_transactions.csv",
      sourceFileHash:
        "2e1304c0dc426f4f8b40530bcbf5f6a7e00d4e63b1b857d3d3621937ef9ab9d7",
      transactions: [
        {
          amount: "-9.95",
          currency: "EUR",
          descriptionNormalized: "caffe nero ifsc dublin",
          descriptionRaw: "CAFFE NERO IFSC DUBLIN",
          postedOn: "2026-06-02",
          sourceRowNumber: 2,
        },
      ],
    })
    expect(
      providers.projectionService.projectStatement,
    ).toHaveBeenCalledWith({
      balanceAnchors: {
        closingBalance: "2427.06",
        openingBalance: "2437.01",
      },
      malformedRows: [
        {
          errors: ["amount_invalid"],
          rawValues: {
            amountEur: "oops",
            balanceEur: "2400.00",
            currency: "EUR",
            date: "2026-06-03",
            description: "BROKEN",
          },
          sourceRowNumber: 3,
        },
      ],
      statementImport: {
        importStatus: "malformed",
        importedAt: "2026-06-09T10:00:00.000Z",
        sourceFile: "bank_transactions.csv",
        sourceFileHash:
          "2e1304c0dc426f4f8b40530bcbf5f6a7e00d4e63b1b857d3d3621937ef9ab9d7",
        statementImportId: "statement-1",
      },
      transactions: [
        {
          amount: "-9.95",
          bankTransactionId: "txn-1",
          currency: "EUR",
          descriptionNormalized: "caffe nero ifsc dublin",
          descriptionRaw: "CAFFE NERO IFSC DUBLIN",
          postedOn: "2026-06-02",
          sourceRowNumber: 2,
          statementImportId: "statement-1",
        },
      ],
    })
    expect(result.statementImport.statementImportId).toBe("statement-1")
    expect(result.transactions).toHaveLength(1)
    expect(result.malformedRows).toHaveLength(1)
    expect(result.balanceAnchors.openingBalance).toBe("2437.01")
  })

  it("does not hand off duplicate imports", async () => {
    const storedStatementPath = await createStoredStatementFile(
      "date,description,amount_eur,balance_eur,currency\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
    )
    const providers: BankProviders = {
      projectionService: {
        projectStatement: vi.fn(async () => undefined),
      },
      statementFileStore: {
        storeStatementFile: vi.fn(async () => ({
          sourceFile: "bank_transactions.csv",
          sourceFileHash: "duplicate-hash",
          storedStatementPath,
        })),
      },
      statementParser: {
        parseStatementCsv: vi.fn(async () => ({
          balanceAnchors: {
            closingBalance: "2427.06",
            openingBalance: "2437.01",
          },
          malformedRows: [],
          transactions: [
            {
              amount: "-9.95",
              currency: "EUR",
              descriptionNormalized: "caffe nero ifsc dublin",
              descriptionRaw: "CAFFE NERO IFSC DUBLIN",
              postedOn: "2026-06-02",
              sourceRowNumber: 2,
            },
          ],
        })),
      },
      statementStore: {
        saveStatementImport: vi.fn(async () => ({
          isDuplicate: true,
          statementImport: {
            importStatus: "valid" as const,
            importedAt: "2026-06-09T10:00:00.000Z",
            sourceFile: "bank_transactions.csv",
            sourceFileHash: "duplicate-hash",
            statementImportId: "statement-2",
          },
          transactions: [
            {
              amount: "-9.95",
              bankTransactionId: "txn-2",
              currency: "EUR",
              descriptionNormalized: "caffe nero ifsc dublin",
              descriptionRaw: "CAFFE NERO IFSC DUBLIN",
              postedOn: "2026-06-02",
              sourceRowNumber: 2,
              statementImportId: "statement-2",
            },
          ],
        })),
      },
    }

    const handler = createBankHandler(providers)
    const file = new File([validStatementBuffer], "bank_transactions.csv", {
      type: "text/csv",
    })
    const result = await handler.handle(file)

    expect(
      providers.projectionService.projectStatement,
    ).not.toHaveBeenCalled()
    expect(result.statementImport.importStatus).toBe("valid")
    expect(result.transactions).toEqual([
      {
        amount: "-9.95",
        bankTransactionId: "txn-2",
        currency: "EUR",
        descriptionNormalized: "caffe nero ifsc dublin",
        descriptionRaw: "CAFFE NERO IFSC DUBLIN",
        postedOn: "2026-06-02",
        sourceRowNumber: 2,
        statementImportId: "statement-2",
      },
    ])
  })

  it("rejects the statement when the CSV header is unsupported", async () => {
    const storedStatementPath = await createStoredStatementFile(
      "bad,header\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
    )
    const providers: BankProviders = {
      projectionService: {
        projectStatement: vi.fn(async () => undefined),
      },
      statementFileStore: {
        storeStatementFile: vi.fn(async () => ({
          sourceFile: "bank_transactions.csv",
          sourceFileHash: "bad-header",
          storedStatementPath,
        })),
      },
      statementParser: {
        parseStatementCsv: vi.fn(async () => {
          throw new BankStatementRejectedError(["invalid_statement_header"])
        }),
      },
      statementStore: {
        saveStatementImport: vi.fn(),
      },
    }

    const handler = createBankHandler(providers)

    await expect(
      handler.handle(
        new File([validStatementBuffer], "bank_transactions.csv", {
          type: "text/csv",
        }),
      ),
    ).rejects.toBeInstanceOf(BankStatementRejectedError)
    expect(providers.statementStore.saveStatementImport).not.toHaveBeenCalled()
    expect(
      providers.projectionService.projectStatement,
    ).not.toHaveBeenCalled()
  })
})
