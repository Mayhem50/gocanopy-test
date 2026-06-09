import { createWorker, PSM } from "tesseract.js"

import type { ExtractReceiptTextResult, Ocr } from "./types"

type TesseractLine = {
  confidence?: number
  text?: string
}

type TesseractRecognizeData = {
  lines?: TesseractLine[]
  text?: string
}

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>

let workerPromise: Promise<TesseractWorker> | null = null

async function getWorker(): Promise<TesseractWorker> {
  if (workerPromise) {
    return workerPromise
  }

  workerPromise = (async () => {
    const worker = await createWorker("eng")

    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      user_defined_dpi: "300",
    })

    return worker
  })()

  return workerPromise
}

function toExtractReceiptTextResult(
  data: TesseractRecognizeData,
): ExtractReceiptTextResult {
  const ocrTextRaw = data.text?.trim() ?? ""
  const lines = (data.lines ?? [])
    .map((line) => ({
      confidence: line.confidence ?? null,
      text: line.text?.trim() ?? "",
    }))
    .filter((line) => line.text.length > 0)

  return {
    ocrTextRaw,
    lines:
      lines.length > 0
        ? lines
        : ocrTextRaw
            .split(/\n+/)
            .map((text) => ({
              confidence: null,
              text: text.trim(),
            }))
            .filter((line) => line.text.length > 0),
  }
}

export function createTesseractOcr(): Ocr {
  const extractReceiptText: Ocr["extractReceiptText"] = async (input) => {
    const worker = await getWorker()
    const { data } = await worker.recognize(
      input.normalizedImagePath,
      {},
      { blocks: true },
    )

    return toExtractReceiptTextResult(data as TesseractRecognizeData)
  }

  return {
    extractReceiptText,
  }
}
