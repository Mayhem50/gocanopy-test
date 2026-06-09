import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { BankStatementRejectedError } from "../errors"
import { createStatementCsvParser } from "./csv-parser"

describe("createStatementCsvParser", () => {
  it("parses the supplied sample statement into canonical transactions", async () => {
    const provider = createStatementCsvParser()
    const csvContent = await readFile(
      new URL("../../../../documentation/materials/bank_transactions.csv", import.meta.url),
      "utf8",
    )

    const result = await provider.parseStatementCsv({ csvContent })

    expect(result.transactions).toHaveLength(11)
    expect(result.malformedRows).toEqual([])
    expect(result.balanceAnchors).toEqual({
      closingBalance: "2167.14",
      openingBalance: "2450.00",
    })
    expect(result.transactions[0]).toEqual({
      amount: "-12.99",
      currency: "EUR",
      descriptionNormalized: "netflix.com",
      descriptionRaw: "NETFLIX.COM",
      postedOn: "2026-06-01",
      sourceRowNumber: 2,
    })
    expect(result.transactions.at(-1)).toEqual({
      amount: "-15.30",
      currency: "EUR",
      descriptionNormalized: "boots 6612 dublin",
      descriptionRaw: "BOOTS 6612 DUBLIN",
      postedOn: "2026-06-09",
      sourceRowNumber: 12,
    })
  })

  it("rejects CSV files whose header does not exactly match the contract", async () => {
    const provider = createStatementCsvParser()

    await expect(
      provider.parseStatementCsv({
        csvContent:
          "date,merchant,amount_eur,balance_eur,currency\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
      }),
    ).rejects.toBeInstanceOf(BankStatementRejectedError)
  })

  it("keeps malformed rows without blocking valid rows from the same file", async () => {
    const provider = createStatementCsvParser()
    const csvContent = [
      "date,description,amount_eur,balance_eur,currency",
      "2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR",
      "2026-06-03,BROKEN,oops,2417.07,EUR",
      "2026-06-04,\"TESCO, STORES 3294\",-23.20,2393.87,EUR",
      "",
    ].join("\n")

    const result = await provider.parseStatementCsv({ csvContent })

    expect(result.transactions).toEqual([
      {
        amount: "-9.95",
        currency: "EUR",
        descriptionNormalized: "caffe nero ifsc dublin",
        descriptionRaw: "CAFFE NERO IFSC DUBLIN",
        postedOn: "2026-06-02",
        sourceRowNumber: 2,
      },
      {
        amount: "-23.20",
        currency: "EUR",
        descriptionNormalized: "tesco, stores 3294",
        descriptionRaw: "TESCO, STORES 3294",
        postedOn: "2026-06-04",
        sourceRowNumber: 4,
      },
    ])
    expect(result.malformedRows).toEqual([
      {
        errors: ["amount_invalid"],
        rawValues: {
          amountEur: "oops",
          balanceEur: "2417.07",
          currency: "EUR",
          date: "2026-06-03",
          description: "BROKEN",
        },
        sourceRowNumber: 3,
      },
    ])
  })
})
