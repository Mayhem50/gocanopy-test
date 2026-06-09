import type { Hono } from "hono"

import {
  createScanHandler,
  ScanReceiptRejectedError,
  type ScanHandler,
} from "./handler"

const allowedReceiptMimeTypes = new Set(["image/jpeg", "image/png"])

export function bindScanRoutes(
  app: Hono,
  handler: ScanHandler = createScanHandler(),
): void {
  app.post("/scan/receipts", async (context) => {
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
              field: "receipt",
              message: "receipt_file_required",
            },
          ],
        },
        400,
      )
    }

    const receiptFile = formData.get("receipt")

    if (!(receiptFile instanceof File)) {
      return context.json(
        {
          ok: false,
          error: "invalid_input",
          issues: [
            {
              field: "receipt",
              message: "receipt_file_required",
            },
          ],
        },
        400,
      )
    }

    if (!allowedReceiptMimeTypes.has(receiptFile.type)) {
      return context.json(
        {
          ok: false,
          error: "invalid_input",
          issues: [
            {
              field: "receipt",
              message: "unsupported_receipt_type",
              fileName: receiptFile.name,
            },
          ],
        },
        400,
      )
    }

    try {
      const receipt = await handler.handle(receiptFile)

      return context.json({
        ok: true,
        receipt,
      })
    } catch (error) {
      if (error instanceof ScanReceiptRejectedError) {
        return context.json(
          {
            ok: false,
            error: "receipt_rejected",
            errors: error.extractedFields.errors,
            warnings: error.extractedFields.warnings,
            extractedFields: error.extractedFields,
          },
          422,
        )
      }

      throw error
    }
  })
}

export { createScanHandler } from "./handler"
export type { ScanHandler } from "./handler"
export * from "./providers/index"
