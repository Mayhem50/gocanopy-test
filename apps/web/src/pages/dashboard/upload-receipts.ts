export type ReceiptUploadResult =
  | {
      fileName: string
      ok: true
      receiptId: string
    }
  | {
      fileName: string
      message: string
      ok: false
    }

type UploadReceiptInput = {
  apiBaseUrl: string
  file: File
}

type UploadReceiptApiSuccess = {
  ok: true
  receipt: {
    receiptId: string
  }
}

type UploadReceiptApiFailure = {
  error?: string
  errors?: string[]
  issues?: Array<{
    fileName?: string
    message?: string
  }>
  ok: false
}

function resolveUploadFailureMessage(input: {
  payload: UploadReceiptApiFailure | null
  status: number
}): string {
  const issueMessage = input.payload?.issues?.[0]?.message

  if (issueMessage) {
    return issueMessage
  }

  const errorMessage = input.payload?.errors?.[0]

  if (errorMessage) {
    return errorMessage
  }

  if (input.payload?.error) {
    return input.payload.error
  }

  return `upload_failed_${input.status}`
}

export async function uploadReceipt({
  apiBaseUrl,
  file,
}: UploadReceiptInput): Promise<ReceiptUploadResult> {
  const formData = new FormData()

  formData.append("receipt", file, file.name)
  const response = await fetch(`${apiBaseUrl}/scan/receipts`, {
    method: "POST",
    body: formData,
  })
  const payload = (await response.json().catch(
    () => null,
  )) as UploadReceiptApiFailure | UploadReceiptApiSuccess | null

  if (response.ok && payload && "receipt" in payload) {
    return {
      fileName: file.name,
      ok: true,
      receiptId: payload.receipt.receiptId,
    }
  }

  return {
    fileName: file.name,
    message: resolveUploadFailureMessage({
      payload: payload as UploadReceiptApiFailure | null,
      status: response.status,
    }),
    ok: false,
  }
}
