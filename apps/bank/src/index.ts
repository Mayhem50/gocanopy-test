import type { Hono } from "hono"

import { BankStatementRejectedError } from "./errors"
import { createBankHandler, type BankHandler } from "./handler"

const allowedStatementMimeTypes = new Set([
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
])

function hasCsvFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(".csv")
}

export function bindBankRoutes(
  app: Hono,
  handler: BankHandler = createBankHandler(),
): void {
  app.post("/bank/statements", async (context) => {
    let formData: FormData

    try {
      formData = await context.req.formData()
    } catch {
      return context.json(
        {
          ok: false,
          error: "invalid_input",
          issues: [
            {
              field: "statement",
              message: "statement_file_required",
            },
          ],
        },
        400,
      )
    }

    const statementFile = formData.get("statement")

    if (!(statementFile instanceof File)) {
      return context.json(
        {
          ok: false,
          error: "invalid_input",
          issues: [
            {
              field: "statement",
              message: "statement_file_required",
            },
          ],
        },
        400,
      )
    }

    if (
      !hasCsvFileName(statementFile.name) ||
      !allowedStatementMimeTypes.has(statementFile.type)
    ) {
      return context.json(
        {
          ok: false,
          error: "invalid_input",
          issues: [
            {
              field: "statement",
              message: "unsupported_statement_type",
              fileName: statementFile.name,
            },
          ],
        },
        400,
      )
    }

    try {
      const statementImport = await handler.handle(statementFile)

      return context.json({
        ok: true,
        statementImport,
      })
    } catch (error) {
      if (error instanceof BankStatementRejectedError) {
        return context.json(
          {
            ok: false,
            error: "statement_rejected",
            errors: error.errors,
          },
          422,
        )
      }

      throw error
    }
  })
}

export { createBankHandler } from "./handler"
export type { BankHandler } from "./handler"
export * from "./providers/index"
