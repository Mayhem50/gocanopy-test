import { mkdtemp, readFile, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { createLocalImageProcessor } from "./image-processor"

describe("createLocalImageProcessor", () => {
  it("normalizes a local image into a grayscale PNG artifact", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "gocanopy-scan-image-processor-"),
    )
    const sourceImagePath = join(temporaryDirectory, "receipt-source.jpg")

    await sharp({
      create: {
        width: 24,
        height: 24,
        channels: 3,
        background: { r: 220, g: 160, b: 80 },
      },
    })
      .jpeg()
      .toFile(sourceImagePath)

    const provider = createLocalImageProcessor()
    const firstResult = await provider.normalizeImage({
      sourceImagePath,
    })
    const originalStat = await stat(firstResult.originalImagePath)
    const firstStat = await stat(firstResult.normalizedImagePath)

    await new Promise((resolve) => {
      setTimeout(resolve, 25)
    })

    const secondResult = await provider.normalizeImage({
      sourceImagePath,
    })
    const secondStat = await stat(secondResult.normalizedImagePath)

    expect(firstResult.originalImageExtension).toBe(".jpg")
    expect(firstResult.originalImagePath).toContain("-original.jpg")
    expect(firstResult.normalizedImagePath).toContain("-normalized.png")
    expect(secondResult.normalizedImagePath).toBe(
      firstResult.normalizedImagePath,
    )
    expect(secondResult.originalImagePath).toBe(firstResult.originalImagePath)
    expect(firstResult.contentHash).toHaveLength(64)
    expect(secondResult.contentHash).toBe(firstResult.contentHash)
    expect(originalStat.isFile()).toBe(true)
    expect(firstStat.isFile()).toBe(true)
    expect(secondStat.isFile()).toBe(true)
    expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs)

    const normalizedMetadata = await sharp(
      firstResult.normalizedImagePath,
    ).metadata()
    const normalizedBuffer = await readFile(firstResult.normalizedImagePath)
    const normalizedRawImage = await sharp(firstResult.normalizedImagePath)
      .raw()
      .toBuffer({ resolveWithObject: true })

    expect(normalizedMetadata.format).toBe("png")
    expect(normalizedBuffer.length).toBeGreaterThan(0)
    expect(normalizedRawImage.info.channels).toBeGreaterThanOrEqual(1)

    if (normalizedRawImage.info.channels >= 3) {
      const [red, green, blue] = normalizedRawImage.data

      expect(red).toBe(green)
      expect(green).toBe(blue)
    }
  })

  it("normalizes an uploaded image directly from a buffer", async () => {
    const sourceImageBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 180, g: 120, b: 60 },
      },
    })
      .jpeg()
      .toBuffer()

    const provider = createLocalImageProcessor()
    const result = await provider.normalizeImage({
      sourceImageBuffer,
      sourceImageFileName: "receipt-upload.jpg",
    })

    expect(result.originalImageExtension).toBe(".jpg")
    expect(result.originalImagePath).toContain("-original.jpg")
    expect(result.normalizedImagePath).toContain("-normalized.png")
    expect(result.contentHash).toHaveLength(64)
  })
})
