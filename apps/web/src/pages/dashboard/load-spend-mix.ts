export type SpendMixSlice = {
  amount: number
  label: string
}

type LoadSpendMixApiSuccess = {
  ok: true
  spendMix: {
    slices: SpendMixSlice[]
  }
}

type LoadSpendMixApiFailure = {
  error?: string
  ok: false
}

export async function loadSpendMix(
  apiBaseUrl: string,
): Promise<SpendMixSlice[]> {
  const response = await fetch(`${apiBaseUrl}/projection/charts/spend-mix`)
  const payload = (await response.json().catch(
    () => null,
  )) as LoadSpendMixApiFailure | LoadSpendMixApiSuccess | null

  if (response.ok && payload && "spendMix" in payload) {
    return payload.spendMix.slices
  }

  const errorMessage =
    payload && "error" in payload ? payload.error : undefined

  throw new Error(errorMessage ?? `spend_mix_load_failed_${response.status}`)
}
