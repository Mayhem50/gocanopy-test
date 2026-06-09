import { afterEach, describe, expect, it, vi } from "vitest"

import { loadSpendMix } from "./load-spend-mix"

describe("loadSpendMix", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("loads spend mix slices from the projection API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          spendMix: {
            slices: [
              {
                amount: 42.5,
                label: "Restaurant",
              },
            ],
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

    await expect(loadSpendMix("http://127.0.0.1:9080")).resolves.toEqual([
      {
        amount: 42.5,
        label: "Restaurant",
      },
    ])
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:9080/projection/charts/spend-mix",
    )
  })
})
