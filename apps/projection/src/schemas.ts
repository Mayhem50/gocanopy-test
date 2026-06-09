import { z } from "zod"

export const projectReceiptInputSchema = z.object({
  receiptId: z.string().trim().min(1),
})

export const projectStatementInputSchema = z.object({
  statementImportId: z.string().trim().min(1),
})

export type ProjectReceiptInput = z.infer<
  typeof projectReceiptInputSchema
>
export type ProjectStatementInput = z.infer<
  typeof projectStatementInputSchema
>
