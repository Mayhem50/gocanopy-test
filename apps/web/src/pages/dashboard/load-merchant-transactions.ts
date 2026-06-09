export type MerchantTransactionTableRow = {
  amount: number
  currency: string
  effectiveDate: string
  label: string
  matchStatus:
    | "ambiguous"
    | "bank_only"
    | "cash"
    | "receipt_only"
    | "reconciled"
  merchantTransactionId: string
  merchantName: string
}

type LoadMerchantTransactionsApiSuccess = {
  merchantTransactions: {
    rows: MerchantTransactionTableRow[]
  }
  ok: true
}

type LoadMerchantTransactionsApiFailure = {
  error?: string
  ok: false
}

export async function loadMerchantTransactions(
  apiBaseUrl: string,
): Promise<MerchantTransactionTableRow[]> {
  const response = await fetch(`${apiBaseUrl}/projection/merchant-transactions`)
  const payload = (await response.json().catch(
    () => null,
  )) as
    | LoadMerchantTransactionsApiFailure
    | LoadMerchantTransactionsApiSuccess
    | null

  if (response.ok && payload && "merchantTransactions" in payload) {
    return payload.merchantTransactions.rows
  }

  const errorMessage =
    payload && "error" in payload ? payload.error : undefined

  throw new Error(
    errorMessage ?? `merchant_transactions_load_failed_${response.status}`,
  )
}
