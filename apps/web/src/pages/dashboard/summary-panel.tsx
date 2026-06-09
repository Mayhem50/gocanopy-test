export function SummaryPanel() {
  return (
    <div className="grid gap-4 rounded-[1.8rem] bg-[radial-gradient(circle_at_top,rgba(244,162,97,0.18),transparent_45%),var(--shell)] p-5 text-white">
      <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-white/64">
          Upload cadence
        </p>
        <p className="mt-4 text-5xl font-semibold tracking-[-0.05em]">24</p>
        <p className="mt-3 text-sm leading-6 text-white/70">
          receipts processed this week in the mocked slice.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-white/64">
            OCR confidence
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
            94.8%
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-white/64">
            Flagged fields
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">7</p>
        </div>
      </div>
    </div>
  )
}
