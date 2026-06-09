import { afterEach, describe, expect, it, vi } from "vitest"

import { uploadReceipt } from "./upload-receipts"

describe("uploadReceipt", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("posts the selected receipt files as multipart form data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          receipt: {
            receiptId: "receipt-1",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    )

    const file = new File(["image"], "receipt.png", {
      type: "image/png",
    })

    const result = await uploadReceipt({
      apiBaseUrl: "http://127.0.0.1:9080",
      file,
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:9080/scan/receipts",
    )

    const requestInit = fetchSpy.mock.calls[0]?.[1]
    expect(requestInit?.method).toBe("POST")
    expect(requestInit?.body).toBeInstanceOf(FormData)

    const uploadedFile = (requestInit?.body as FormData).get("receipt")
    expect(uploadedFile).toBeInstanceOf(File)
    expect((uploadedFile as File).name).toBe("receipt.png")
    expect(result).toEqual({
      fileName: "receipt.png",
      ok: true,
      receiptId: "receipt-1",
    })
  })

  it("returns the API rejection message for a failed upload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: "receipt_rejected",
          errors: ["vat_id_missing"],
        }),
        {
          status: 422,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    )

    const file = new File(["image"], "receipt.jpg", {
      type: "image/jpeg",
    })

    const result = await uploadReceipt({
      apiBaseUrl: "http://127.0.0.1:9080",
      file,
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(((fetchSpy.mock.calls[0]?.[1]?.body as FormData).get("receipt") as File).name).toBe(
      "receipt.jpg",
    )
    expect(result).toEqual({
      fileName: "receipt.jpg",
      message: "vat_id_missing",
      ok: false,
    })
  })
})
