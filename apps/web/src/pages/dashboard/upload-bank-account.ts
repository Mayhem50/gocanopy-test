export type BankAccountUploadResult =
  | {
      fileName: string
      ok: true
      statementImportId: string
    }
  | {
      fileName: string
      message: string
      ok: false
    }

type UploadBankAccountInput = {
  apiBaseUrl: string
  file: File
}

type UploadBankAccountApiSuccess = {
  ok: true
  statementImport: {
    statementImport: {
      statementImportId: string
    }
  }
}

type UploadBankAccountApiFailure = {
  error?: string
  errors?: string[]
  issues?: Array<{
    fileName?: string
    message?: string
  }>
  ok: false
}

function resolveUploadFailureMessage(input: {
  payload: UploadBankAccountApiFailure | null
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

export async function uploadBankAccount({
  apiBaseUrl,
  file,
}: UploadBankAccountInput): Promise<BankAccountUploadResult> {
  const formData = new FormData()

  formData.append("statement", file, file.name)
  const response = await fetch(`${apiBaseUrl}/bank/statements`, {
    method: "POST",
    body: formData,
  })
  const payload = (await response.json().catch(
    () => null,
  )) as UploadBankAccountApiFailure | UploadBankAccountApiSuccess | null

  if (response.ok && payload && "statementImport" in payload) {
    return {
      fileName: file.name,
      ok: true,
      statementImportId: payload.statementImport.statementImport.statementImportId,
    }
  }

  return {
    fileName: file.name,
    message: resolveUploadFailureMessage({
      payload: payload as UploadBankAccountApiFailure | null,
      status: response.status,
    }),
    ok: false,
  }
}
