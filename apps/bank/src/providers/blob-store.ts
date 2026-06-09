import { join } from "node:path"
import { tmpdir } from "node:os"

const BLOB_DIRECTORY = join(tmpdir(), "gocanopy", "bank", "blob-store")

export function getBlobDirectory(): string {
  return BLOB_DIRECTORY
}

export function getStatementBlobPath(input: { sourceFileHash: string }): string {
  return join(BLOB_DIRECTORY, `${input.sourceFileHash}.csv`)
}
