import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import type { Pool as PgPool } from "pg"

export type DatabaseTarget = "scan" | "bank" | "projection"
export type PostgresDb = ReturnType<typeof drizzle>

type ConnectionState = {
  db: PostgresDb
  pool: PgPool
}

const { Pool } = pg

const connections = new Map<DatabaseTarget, ConnectionState>()

function getConnectionStringEnvironmentVariableName(
  target: DatabaseTarget,
): string {
  if (target === "scan") {
    return "SCAN_POSTGRES_URL"
  }

  if (target === "bank") {
    return "BANK_POSTGRES_URL"
  }

  return "PROJECTION_POSTGRES_URL"
}

export function getPostgresDb(target: DatabaseTarget): PostgresDb {
  const existingConnection = connections.get(target)

  if (existingConnection) {
    return existingConnection.db
  }

  const connectionStringEnvironmentVariableName =
    getConnectionStringEnvironmentVariableName(target)
  const connectionString =
    process.env[connectionStringEnvironmentVariableName]
  const pool = new Pool({
    connectionString,
    database: connectionString ? undefined : "gocanopy",
    host: connectionString ? undefined : "127.0.0.1",
    password: connectionString ? undefined : "gocanopy",
    port: connectionString ? undefined : 5433,
    user: connectionString ? undefined : "gocanopy",
  })
  const db = drizzle(pool)

  connections.set(target, {
    db,
    pool,
  })

  return db
}
