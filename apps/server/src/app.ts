import { Hono } from "hono"
import { cors } from "hono/cors"

import { bindBankRoutes } from "@gocanopy/bank"
import { bindProjectionRoutes } from "@gocanopy/projection"
import { bindScanRoutes } from "@gocanopy/scan"

export function createApp(): Hono {
  const app = new Hono()

  app.use(
    "*",
    cors({
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  )

  app.get("/", (c) => {
    return c.json({
      ok: true,
      service: "gocanopy-server",
    })
  })

  app.get("/health", (c) => {
    return c.json({ ok: true })
  })

  bindBankRoutes(app)
  bindProjectionRoutes(app)
  bindScanRoutes(app)

  return app
}
