import { createHash } from "node:crypto"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"

import sharp from "sharp"

import {
  getBlobDirectory,
  getNormalizedImageBlobPath,
  getOriginalImageBlobPath,
} from "./blob-store"
import type { ImageProcessor } from "./types"

function normalizeOriginalImageExtension(input: {
  detectedFormat: string | undefined
  sourceImageFileName?: string
}): string {
  const detectedFormat = input.detectedFormat?.toLowerCase()

  if (detectedFormat === "jpeg") {
    return ".jpg"
  }

  if (detectedFormat) {
    return `.${detectedFormat}`
  }

  const sourceExtension = extname(input.sourceImageFileName ?? "")
    .trim()
    .toLowerCase()

  if (sourceExtension.length > 0) {
    return sourceExtension
  }

  return ".bin"
}

async function getSourceImageBuffer(input: {
  sourceImagePath: string
} | {
  sourceImageBuffer: Buffer
}): Promise<Buffer> {
  if ("sourceImagePath" in input) {
    return readFile(input.sourceImagePath)
  }

  return input.sourceImageBuffer
}

export function createLocalImageProcessor(): ImageProcessor {
  const exists = async (path: string): Promise<boolean> => {
    try {
      await access(path)

      return true
    } catch {
      return false
    }
  }

  const normalizeImage: ImageProcessor["normalizeImage"] = async (input) => {
    const sourceImageBuffer = await getSourceImageBuffer(input)
    const imageMetadata = await sharp(sourceImageBuffer).metadata()
    const contentHash = createHash("sha256").update(sourceImageBuffer).digest("hex")
    const originalImageExtension = normalizeOriginalImageExtension({
      detectedFormat: imageMetadata.format,
      sourceImageFileName:
        "sourceImagePath" in input
          ? input.sourceImagePath
          : input.sourceImageFileName,
    })
    const originalImagePath = getOriginalImageBlobPath({
      contentHash,
      originalImageExtension,
    })
    const normalizedImagePath = getNormalizedImageBlobPath({
      contentHash,
    })

    await mkdir(getBlobDirectory(), { recursive: true })

    if (!(await exists(originalImagePath))) {
      await writeFile(originalImagePath, sourceImageBuffer)
    }

    if (!(await exists(normalizedImagePath))) {
      await sharp(sourceImageBuffer)
        .autoOrient()
        .flatten({ background: "#ffffff" })
        .grayscale()
        .normalise()
        .png()
        .toFile(normalizedImagePath)
    }

    return {
      contentHash,
      originalImageExtension,
      originalImagePath,
      normalizedImagePath,
    }
  }

  return {
    normalizeImage,
  }
}
