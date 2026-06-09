import { useEffect, useId, useRef, useState, type ChangeEvent } from "react"
import {
  loadMerchantTransactions,
  type MerchantTransactionTableRow,
} from "./load-merchant-transactions"
import { loadSpendMix, type SpendMixSlice } from "./load-spend-mix"
import { MerchantTransactionsCard } from "./merchant-transactions-card"
import { SpendMixCard } from "./spend-mix-card"
import { SummaryPanel } from "./summary-panel"
import { uploadBankAccount } from "./upload-bank-account"
import { UploadCard } from "./upload-card"
import { uploadReceipt } from "./upload-receipts"

type SpendSlice = {
  amount: number
  color: string
  label: string
}

function readFileCount(event: ChangeEvent<HTMLInputElement>) {
  return event.target.files?.length ?? 0
}

const spendMixPalette = [
  "#1f6f5f",
  "#f4a261",
  "#264653",
  "#e76f51",
  "#7a8f5c",
  "#b56576",
]

function toSpendMixSlices(slices: SpendMixSlice[]): SpendSlice[] {
  return slices.map((slice, index) => ({
    amount: slice.amount,
    color: spendMixPalette[index % spendMixPalette.length] ?? "#264653",
    label: slice.label,
  }))
}

type ReceiptUploadState =
  | {
      status: "idle"
    }
  | {
      fileCount: number
      status: "uploading"
    }
  | {
      failedCount: number
      status: "uploaded"
      uploadedCount: number
    }
  | {
      message: string
      status: "error"
    }

type BankAccountUploadState =
  | {
      status: "idle"
    }
  | {
      fileCount: number
      status: "uploading"
    }
  | {
      failedCount: number
      status: "uploaded"
      uploadedCount: number
    }
  | {
      message: string
      status: "error"
    }

function getReceiptUploadStatusMessage(state: ReceiptUploadState):
  | {
      text: string
      tone: "danger" | "neutral" | "success"
    }
  | undefined {
  if (state.status === "idle") {
    return undefined
  }

  if (state.status === "uploading") {
    return {
      text: "Uploading receipt...",
      tone: "neutral",
    }
  }

  if (state.status === "error") {
    return {
      text: state.message,
      tone: "danger",
    }
  }

  if (state.failedCount > 0) {
    return {
      text: `${state.uploadedCount} uploaded, ${state.failedCount} failed.`,
      tone: "danger",
    }
  }

  return {
    text: "Receipt uploaded successfully.",
    tone: "success",
  }
}

function getBankAccountUploadStatusMessage(state: BankAccountUploadState):
  | {
      text: string
      tone: "danger" | "neutral" | "success"
    }
  | undefined {
  if (state.status === "idle") {
    return undefined
  }

  if (state.status === "uploading") {
    return {
      text: "Importing bank statement...",
      tone: "neutral",
    }
  }

  if (state.status === "error") {
    return {
      text: state.message,
      tone: "danger",
    }
  }

  if (state.failedCount > 0) {
    return {
      text: `${state.uploadedCount} imported, ${state.failedCount} failed.`,
      tone: "danger",
    }
  }

  return {
    text: "Bank statement imported successfully.",
    tone: "success",
  }
}

export function DashboardPage() {
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:9080"
  const receiptUploadId = useId()
  const bankAccountUploadId = useId()
  const receiptUploadRef = useRef<HTMLInputElement | null>(null)
  const bankAccountUploadRef = useRef<HTMLInputElement | null>(null)
  const [receiptUploadCount, setReceiptUploadCount] = useState(0)
  const [bankAccountUploadCount, setBankAccountUploadCount] = useState(0)
  const [receiptUploadState, setReceiptUploadState] =
    useState<ReceiptUploadState>({
      status: "idle",
    })
  const [bankAccountUploadState, setBankAccountUploadState] =
    useState<BankAccountUploadState>({
      status: "idle",
    })
  const [spendMixSlices, setSpendMixSlices] = useState<SpendSlice[]>([])
  const [merchantTransactionRows, setMerchantTransactionRows] = useState<
    MerchantTransactionTableRow[]
  >([])

  useEffect(() => {
    let isDisposed = false

    async function refreshDashboardData() {
      try {
        const [slices, merchantTransactions] = await Promise.all([
          loadSpendMix(apiBaseUrl),
          loadMerchantTransactions(apiBaseUrl),
        ])

        if (!isDisposed) {
          setSpendMixSlices(toSpendMixSlices(slices))
          setMerchantTransactionRows(merchantTransactions)
        }
      } catch {
        if (!isDisposed) {
          setSpendMixSlices([])
          setMerchantTransactionRows([])
        }
      }
    }

    void refreshDashboardData()

    return () => {
      isDisposed = true
    }
  }, [apiBaseUrl])

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_24px_80px_rgba(22,36,34,0.12)] backdrop-blur">
          <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Receipt cockpit
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  Front dashboard with one receipt flow and one bank account flow.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                  One upload accepts receipt documents one file at a time. The
                  second upload is reserved for the bank account import flow,
                  so the front already matches the real product split.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <UploadCard
                  accent="light"
                  buttonId={receiptUploadId}
                  emptyLabel="PNG or JPEG"
                  filledLabel="receipt selected"
                  inputAccept=".png,.jpeg,.jpg,image/png,image/jpeg"
                  inputRef={receiptUploadRef}
                  isDisabled={receiptUploadState.status === "uploading"}
                  kicker="Receipt upload"
                  onFileChange={async (event) => {
                    const file = event.target.files?.[0] ?? null
                    setReceiptUploadCount(readFileCount(event))
                    event.target.value = ""

                    if (file === null) {
                      setReceiptUploadState({ status: "idle" })
                      return
                    }

                    setReceiptUploadState({
                      fileCount: 1,
                      status: "uploading",
                    })

                    try {
                      const result = await uploadReceipt({
                        apiBaseUrl,
                        file,
                      })

                      setReceiptUploadState({
                        failedCount: result.ok ? 0 : 1,
                        status: "uploaded",
                        uploadedCount: result.ok ? 1 : 0,
                      })

                      if (result.ok) {
                        const [slices, merchantTransactions] = await Promise.all([
                          loadSpendMix(apiBaseUrl),
                          loadMerchantTransactions(apiBaseUrl),
                        ])

                        setSpendMixSlices(toSpendMixSlices(slices))
                        setMerchantTransactionRows(merchantTransactions)
                      }
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "receipt_upload_failed"

                      setReceiptUploadState({
                        message,
                        status: "error",
                      })
                    }
                  }}
                  onOpen={() => {
                    receiptUploadRef.current?.click()
                  }}
                  statusMessage={getReceiptUploadStatusMessage(
                    receiptUploadState,
                  )}
                  statusCount={receiptUploadCount}
                  title="Upload receipts"
                >
                  Supports one receipt file per upload for OCR and extraction.
                </UploadCard>

                <UploadCard
                  accent="dark"
                  buttonId={bankAccountUploadId}
                  emptyLabel="CSV only"
                  filledLabel="bank statement selected"
                  inputAccept=".csv,text/csv"
                  inputRef={bankAccountUploadRef}
                  isDisabled={bankAccountUploadState.status === "uploading"}
                  kicker="Bank account"
                  onFileChange={async (event) => {
                    const file = event.target.files?.[0] ?? null
                    setBankAccountUploadCount(readFileCount(event))
                    event.target.value = ""

                    if (file === null) {
                      setBankAccountUploadState({ status: "idle" })
                      return
                    }

                    setBankAccountUploadState({
                      fileCount: 1,
                      status: "uploading",
                    })

                    try {
                      const result = await uploadBankAccount({
                        apiBaseUrl,
                        file,
                      })

                      setBankAccountUploadState({
                        failedCount: result.ok ? 0 : 1,
                        status: "uploaded",
                        uploadedCount: result.ok ? 1 : 0,
                      })

                      if (result.ok) {
                        const [slices, merchantTransactions] = await Promise.all([
                          loadSpendMix(apiBaseUrl),
                          loadMerchantTransactions(apiBaseUrl),
                        ])

                        setSpendMixSlices(toSpendMixSlices(slices))
                        setMerchantTransactionRows(merchantTransactions)
                      }
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "bank_statement_upload_failed"

                      setBankAccountUploadState({
                        message,
                        status: "error",
                      })
                    }
                  }}
                  onOpen={() => {
                    bankAccountUploadRef.current?.click()
                  }}
                  statusMessage={getBankAccountUploadStatusMessage(
                    bankAccountUploadState,
                  )}
                  statusCount={bankAccountUploadCount}
                  title="Upload bank account"
                >
                  Dedicated import flow for account statements in CSV format,
                  separate from receipt ingestion.
                </UploadCard>
              </div>
            </div>

            <SummaryPanel />
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SpendMixCard slices={spendMixSlices} />
          <MerchantTransactionsCard rows={merchantTransactionRows} />
        </section>
      </div>
    </main>
  )
}
