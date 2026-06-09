import { describe, expect, it, vi } from "vitest"
import { Hono } from "hono"

import { BankStatementRejectedError } from "./errors"
import { bindBankRoutes, type BankHandler } from "./index"

describe("bindBankRoutes", () => {
  it("accepts multipart statement uploads and forwards the file to the handler", async () => {
    const handler: BankHandler = {
      handle: vi.fn(async () => ({
        balanceAnchors: {
          closingBalance: "2167.14",
          openingBalance: "2450.00",
        },
        malformedRows: [],
        statementImport: {
          importStatus: "valid" as const,
          importedAt: "2026-06-09T12:00:00.000Z",
          sourceFile: "bank.csv",
          sourceFileHash: "hash-1",
          statementImportId: "statement-1",
        },
        storedStatementPath: "/tmp/hash-1.csv",
        transactions: [],
      })),
    }
    const app = new Hono()
    bindBankRoutes(app, handler)
    const formData = new FormData()
    formData.append(
      "statement",
      new File(["date,description,amount_eur,balance_eur,currency"], "bank.csv", {
        type: "text/csv",
      }),
    )

    const response = await app.request("http://localhost/bank/statements", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      statementImport: {
        statementImport: {
          statementImportId: "statement-1",
        },
      },
    })
    expect(handler.handle).toHaveBeenCalledOnce()
    expect(handler.handle).toHaveBeenCalledWith(expect.any(File))
  })

  it("returns a rejected statement response when parsing fails", async () => {
    const handler: BankHandler = {
      handle: vi.fn(async () => {
        throw new BankStatementRejectedError(["invalid_statement_header"])
      }),
    }
    const app = new Hono()
    bindBankRoutes(app, handler)
    const formData = new FormData()
    formData.append(
      "statement",
      new File(["bad,header"], "bank.csv", {
        type: "text/csv",
      }),
    )

    const response = await app.request("http://localhost/bank/statements", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "statement_rejected",
      errors: ["invalid_statement_header"],
    })
  })

  it("rejects unsupported multipart statement types", async () => {
    const handler: BankHandler = {
      handle: vi.fn(),
    }
    const app = new Hono()
    bindBankRoutes(app, handler)
    const formData = new FormData()
    formData.append(
      "statement",
      new File(["not-csv"], "bank.txt", {
        type: "text/plain",
      }),
    )

    const response = await app.request("http://localhost/bank/statements", {
      method: "POST",
      body: formData,
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_input",
      issues: [
        {
          field: "statement",
          message: "unsupported_statement_type",
          fileName: "bank.txt",
        },
      ],
    })
    expect(handler.handle).not.toHaveBeenCalled()
  })
})
