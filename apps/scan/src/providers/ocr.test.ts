import { describe, expect, it, vi } from "vitest"

const recognizeMock = vi.fn(async () => ({
  data: {
    lines: [
      { confidence: 92.1, text: "  VAT REG IE938241L  " },
      { confidence: 88.4, text: "EUR 15.30" },
      { confidence: 10.5, text: "   " },
    ],
    text: "  VAT REG IE938241L\nEUR 15.30\n",
  },
}))
const setParametersMock = vi.fn(async () => undefined)
const createWorkerMock = vi.fn(async () => ({
  recognize: recognizeMock,
  setParameters: setParametersMock,
}))

vi.mock("tesseract.js", () => ({
  createWorker: createWorkerMock,
  PSM: {
    SINGLE_BLOCK: "SINGLE_BLOCK",
  },
}))

describe("createTesseractOcr", () => {
  it("maps Tesseract output and reuses the same worker", async () => {
    const { createTesseractOcr } = await import("./ocr")

    const provider = createTesseractOcr()
    const firstResult = await provider.extractReceiptText({
      normalizedImagePath: "/tmp/normalized-1.png",
    })
    const secondResult = await provider.extractReceiptText({
      normalizedImagePath: "/tmp/normalized-2.png",
    })

    expect(createWorkerMock).toHaveBeenCalledOnce()
    expect(setParametersMock).toHaveBeenCalledOnce()
    expect(setParametersMock).toHaveBeenCalledWith({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "SINGLE_BLOCK",
      user_defined_dpi: "300",
    })
    expect(recognizeMock).toHaveBeenNthCalledWith(
      1,
      "/tmp/normalized-1.png",
      {},
      { blocks: true },
    )
    expect(recognizeMock).toHaveBeenNthCalledWith(
      2,
      "/tmp/normalized-2.png",
      {},
      { blocks: true },
    )
    expect(firstResult).toEqual({
      ocrTextRaw: "VAT REG IE938241L\nEUR 15.30",
      lines: [
        { confidence: 92.1, text: "VAT REG IE938241L" },
        { confidence: 88.4, text: "EUR 15.30" },
      ],
    })
    expect(secondResult).toEqual(firstResult)
  })

  it("falls back to ocrTextRaw when Tesseract lines are empty", async () => {
    recognizeMock.mockResolvedValueOnce({
      data: {
        lines: [],
        text: "  Boots\nTOTAL EUR 15.30\nCARD VISA ****4471\n",
      },
    })

    const { createTesseractOcr } = await import("./ocr")
    const provider = createTesseractOcr()
    const result = await provider.extractReceiptText({
      normalizedImagePath: "/tmp/normalized-3.png",
    })

    expect(result).toEqual({
      ocrTextRaw: "Boots\nTOTAL EUR 15.30\nCARD VISA ****4471",
      lines: [
        { confidence: null, text: "Boots" },
        { confidence: null, text: "TOTAL EUR 15.30" },
        { confidence: null, text: "CARD VISA ****4471" },
      ],
    })
  })
})
