import { Cell, Pie, PieChart, Tooltip } from "recharts"
import { ChartSurface } from "./chart-surface"

type SpendSlice = {
  amount: number
  color: string
  label: string
}

type SpendMixCardProps = {
  slices: SpendSlice[]
}

export function SpendMixCard({ slices }: SpendMixCardProps) {
  const totalAmount = slices.reduce(
    (currentAmount, slice) => currentAmount + slice.amount,
    0,
  )

  return (
    <article className="rounded-[1.8rem] border border-[var(--line)] bg-white/88 p-5 shadow-[0_20px_60px_rgba(22,36,34,0.08)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Spend mix
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Pie chart for category balance
          </h2>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Recharts
        </span>
      </div>

      <ChartSurface
        className="h-72 w-full"
        fallbackSize={{ width: 640, height: 288 }}
      >
        {({ height, width }) => (
          slices.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--muted)]">
              No spend data yet.
            </div>
          ) : (
            <PieChart width={width} height={height}>
              <Pie
                data={slices}
                dataKey="amount"
                innerRadius={72}
                nameKey="label"
                outerRadius={104}
                paddingAngle={3}
              >
                {slices.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}`}
                labelFormatter={(label) => label}
              />
            </PieChart>
          )
        )}
      </ChartSurface>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {slices.map((slice) => (
          <div
            key={slice.label}
            className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-medium">{slice.label}</span>
            </div>
            <span className="text-sm text-[var(--muted)]">
              {totalAmount === 0
                ? "0%"
                : `${Math.round((slice.amount / totalAmount) * 100)}%`}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}
