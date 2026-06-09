import { join } from "node:path"
import { tmpdir } from "node:os"

const BLOB_DIRECTORY = join(tmpdir(), "gocanopy", "scan", "blob-store")

export function getBlobDirectory(): string {
  return BLOB_DIRECTORY
}

export function getOriginalImageBlobPath(input: {
  contentHash: string
  originalImageExtension: string
}): string {
  return join(
    BLOB_DIRECTORY,
    `${input.contentHash}-original${input.originalImageExtension}`,
  )
}

export function getNormalizedImageBlobPath(input: {
  contentHash: string
}): string {
  return join(BLOB_DIRECTORY, `${input.contentHash}-normalized.png`)
}
