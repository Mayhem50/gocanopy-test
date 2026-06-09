import type { MerchantTransactionTableRow } from "./load-merchant-transactions"

type MerchantTransactionsCardProps = {
  rows: MerchantTransactionTableRow[]
}

const matchStatusLabelMap: Record<MerchantTransactionTableRow["matchStatus"], string> = {
  ambiguous: "Ambiguous",
  bank_only: "Bank only",
  cash: "Cash",
  receipt_only: "Receipt only",
  reconciled: "Reconciled",
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amount)
}

export function MerchantTransactionsCard({
  rows,
}: MerchantTransactionsCardProps) {
  return (
    <article className="flex h-full flex-col rounded-[1.8rem] border border-[var(--line)] bg-white/88 p-5 shadow-[0_20px_60px_rgba(22,36,34,0.08)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Merchant transactions
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Compact ledger view
          </h2>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          {rows.length} rows
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-80 flex-1 items-center justify-center rounded-3xl border border-dashed border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--muted)]">
          No merchant transactions yet.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="h-full min-h-80 w-full overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-[var(--panel)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Merchant</th>
                  <th className="px-4 py-3 font-semibold">Label</th>
                  <th className="px-4 py-3 font-semibold">Match</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.merchantTransactionId}
                    className="border-t border-[var(--line)] text-[var(--ink)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                      {row.effectiveDate}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.merchantName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium">
                        {row.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {matchStatusLabelMap[row.matchStatus]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {formatAmount(row.amount, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  )
}
