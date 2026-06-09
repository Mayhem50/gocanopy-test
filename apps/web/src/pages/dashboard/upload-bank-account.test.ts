import { afterEach, describe, expect, it, vi } from "vitest"

import { uploadBankAccount } from "./upload-bank-account"

describe("uploadBankAccount", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("posts the selected bank statement file as multipart form data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          statementImport: {
            statementImport: {
              statementImportId: "statement-1",
            },
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

    const file = new File(["csv"], "bank.csv", {
      type: "text/csv",
    })

    const result = await uploadBankAccount({
      apiBaseUrl: "http://127.0.0.1:9080",
      file,
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:9080/bank/statements",
    )

    const requestInit = fetchSpy.mock.calls[0]?.[1]
    expect(requestInit?.method).toBe("POST")
    expect(requestInit?.body).toBeInstanceOf(FormData)

    const uploadedFile = (requestInit?.body as FormData).get("statement")
    expect(uploadedFile).toBeInstanceOf(File)
    expect((uploadedFile as File).name).toBe("bank.csv")
    expect(result).toEqual({
      fileName: "bank.csv",
      ok: true,
      statementImportId: "statement-1",
    })
  })

  it("returns the API rejection message for a failed upload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: "statement_rejected",
          errors: ["invalid_statement_header"],
        }),
        {
          status: 422,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    )

    const file = new File(["bad"], "bank.csv", {
      type: "text/csv",
    })

    const result = await uploadBankAccount({
      apiBaseUrl: "http://127.0.0.1:9080",
      file,
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(
      ((fetchSpy.mock.calls[0]?.[1]?.body as FormData).get("statement") as File)
        .name,
    ).toBe("bank.csv")
    expect(result).toEqual({
      fileName: "bank.csv",
      message: "invalid_statement_header",
      ok: false,
    })
  })
})
