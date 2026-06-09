import { serve } from "@hono/node-server"

import { createApp } from "./app"

const port = 9080
const app = createApp()

serve({
  fetch: app.fetch,
  port,
})

process.stdout.write(`GoCanopy server listening on http://localhost:${port}\n`)
