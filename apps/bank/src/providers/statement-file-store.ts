import { createHash } from "node:crypto"
import { access, mkdir, writeFile } from "node:fs/promises"

import { getBlobDirectory, getStatementBlobPath } from "./blob-store"
import type { StatementFileStore } from "./types"

export function createLocalStatementFileStore(): StatementFileStore {
  const exists = async (path: string): Promise<boolean> => {
    try {
      await access(path)

      return true
    } catch {
      return false
    }
  }

  return {
    async storeStatementFile(input) {
      const sourceFileHash = createHash("sha256")
        .update(input.fileBuffer)
        .digest("hex")
      const storedStatementPath = getStatementBlobPath({ sourceFileHash })

      await mkdir(getBlobDirectory(), { recursive: true })

      if (!(await exists(storedStatementPath))) {
        await writeFile(storedStatementPath, input.fileBuffer)
      }

      return {
        sourceFile: input.sourceFile,
        sourceFileHash,
        storedStatementPath,
      }
    },
  }
}
