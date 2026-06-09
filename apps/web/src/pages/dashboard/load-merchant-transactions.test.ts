import { afterEach, describe, expect, it, vi } from "vitest"

import { loadMerchantTransactions } from "./load-merchant-transactions"

describe("loadMerchantTransactions", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("loads merchant transactions from the projection API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          merchantTransactions: {
            rows: [
              {
                amount: 42.5,
                currency: "EUR",
                effectiveDate: "2026-06-09",
                label: "Restaurant",
                matchStatus: "reconciled",
                merchantTransactionId: "merchant-1",
                merchantName: "Caffe Nero",
              },
            ],
          },
          ok: true,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    )

    await expect(
      loadMerchantTransactions("http://127.0.0.1:9080"),
    ).resolves.toEqual([
      {
        amount: 42.5,
        currency: "EUR",
        effectiveDate: "2026-06-09",
        label: "Restaurant",
        matchStatus: "reconciled",
        merchantTransactionId: "merchant-1",
        merchantName: "Caffe Nero",
      },
    ])
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:9080/projection/merchant-transactions",
    )
  })
})
