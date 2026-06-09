import { zValidator } from "@hono/zod-validator"
import type { Hono } from "hono"

import { ProjectionTargetNotFoundError } from "./errors"
import { createProjectionHandler } from "./handler"
import {
  projectReceiptInputSchema,
  projectStatementInputSchema,
} from "./schemas"
import type { ProjectionHandler } from "./types"

export function bindProjectionRoutes(
  app: Hono,
  handler: ProjectionHandler = createProjectionHandler(),
): void {
  app.get("/projection/merchant-transactions", async (context) => {
    const merchantTransactions = await handler.getMerchantTransactions()

    return context.json({
      ok: true,
      merchantTransactions,
    })
  })

  app.get("/projection/charts/spend-mix", async (context) => {
    const spendMix = await handler.getSpendMix()

    return context.json({
      ok: true,
      spendMix,
    })
  })

  app.post(
    "/projection/receipts",
    zValidator("json", projectReceiptInputSchema, (result, context) => {
      if (!result.success) {
        return context.json(
          {
            ok: false,
            error: "invalid_input",
            issues: result.error.issues,
          },
          400,
        )
      }
    }),
    async (context) => {
      try {
        const projection = await handler.projectReceipt(
          context.req.valid("json"),
        )

        return context.json({
          ok: true,
          projection,
        })
      } catch (error) {
        if (error instanceof ProjectionTargetNotFoundError) {
          return context.json(
            {
              ok: false,
              error: error.code,
            },
            404,
          )
        }

        throw error
      }
    },
  )

  app.post(
    "/projection/statements",
    zValidator("json", projectStatementInputSchema, (result, context) => {
      if (!result.success) {
        return context.json(
          {
            ok: false,
            error: "invalid_input",
            issues: result.error.issues,
          },
          400,
        )
      }
    }),
    async (context) => {
      try {
        const projection = await handler.projectStatement(
          context.req.valid("json"),
        )

        return context.json({
          ok: true,
          projection,
        })
      } catch (error) {
        if (error instanceof ProjectionTargetNotFoundError) {
          return context.json(
            {
              ok: false,
              error: error.code,
            },
            404,
          )
        }

        throw error
      }
    },
  )
}

export { createProjectionHandler } from "./handler"
export { ProjectionTargetNotFoundError } from "./errors"
export * from "./providers/index"
export * from "./schemas"
export * from "./types"
