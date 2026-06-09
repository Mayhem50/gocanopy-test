import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { getStatementBlobPath } from "./blob-store"
import { createLocalStatementFileStore } from "./statement-file-store"

describe("createLocalStatementFileStore", () => {
  it("stores the uploaded buffer as <hash>.csv and preserves its content", async () => {
    const sourceFile = "bank_transactions.csv"
    const fileBuffer = Buffer.from(
      "date,description,amount_eur,balance_eur,currency\n2026-06-02,CAFFE NERO IFSC DUBLIN,-9.95,2427.06,EUR\n",
      "utf8",
    )

    const provider = createLocalStatementFileStore()
    const result = await provider.storeStatementFile({ fileBuffer, sourceFile })
    const storedCsvContent = await readFile(result.storedStatementPath, "utf8")

    expect(result.sourceFile).toBe(sourceFile)
    expect(result.sourceFileHash).toBe(
      "4488feea188cee8cc63d740446ae18f46f49c9f19a7626226b45ce90f593c287",
    )
    expect(result.storedStatementPath).toBe(
      getStatementBlobPath({
        sourceFileHash:
          "4488feea188cee8cc63d740446ae18f46f49c9f19a7626226b45ce90f593c287",
      }),
    )
    expect(storedCsvContent).toBe(fileBuffer.toString("utf8"))
  })
})
