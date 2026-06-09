import { defineConfig } from "drizzle-kit"

const connectionString =
  process.env.SCAN_POSTGRES_URL ??
  "postgres://gocanopy:gocanopy@127.0.0.1:5433/gocanopy"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/index.ts",
  dbCredentials: {
    url: connectionString,
  },
})
