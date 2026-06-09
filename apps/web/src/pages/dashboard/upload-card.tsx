import type { ChangeEvent, ReactNode, RefObject } from "react"

type UploadCardProps = {
  accent: "dark" | "light"
  buttonId: string
  children: ReactNode
  emptyLabel: string
  filledLabel: string
  inputAccept: string
  inputRef: RefObject<HTMLInputElement | null>
  isDisabled?: boolean
  isMultiple?: boolean
  kicker: string
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpen: () => void
  statusMessage?: {
    tone: "danger" | "neutral" | "success"
    text: string
  }
  statusCount: number
  title: string
}

function UploadStatus({
  count,
  emptyLabel,
  filledLabel,
}: {
  count: number
  emptyLabel: string
  filledLabel: string
}) {
  if (count === 0) {
    return <span className="text-sm text-[var(--muted)]">{emptyLabel}</span>
  }

  return (
    <span className="text-sm font-medium text-[var(--ink)]">
      {count} {filledLabel}
    </span>
  )
}

export function UploadCard({
  accent,
  buttonId,
  children,
  emptyLabel,
  filledLabel,
  inputAccept,
  inputRef,
  isDisabled = false,
  isMultiple = false,
  kicker,
  onFileChange,
  onOpen,
  statusMessage,
  statusCount,
  title,
}: UploadCardProps) {
  const isDark = accent === "dark"

  return (
    <>
      <input
        id={buttonId}
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={inputAccept}
        multiple={isMultiple}
        onChange={onFileChange}
      />
      <button
        className={[
          "group flex cursor-pointer flex-col gap-5 rounded-[1.6rem] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-70",
          isDark
            ? "border-[var(--line)] bg-[linear-gradient(180deg,rgba(38,70,83,0.96),rgba(20,35,42,0.96))] text-white hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(19,33,40,0.28)]"
            : "border-[var(--line)] bg-[var(--panel)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_18px_40px_rgba(31,111,95,0.12)]",
        ].join(" ")}
        disabled={isDisabled}
        type="button"
        onClick={onOpen}
      >
        <div className="flex items-center justify-between">
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
              isDark
                ? "bg-white/12 text-white/80"
                : "bg-[var(--accent-soft)] text-[var(--accent)]",
            ].join(" ")}
          >
            {kicker}
          </span>
          <span className="text-2xl transition group-hover:translate-x-1">
            +
          </span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
          <p className={isDark ? "text-sm leading-6 text-white/72" : "text-sm leading-6 text-[var(--muted)]"}>
            {children}
          </p>
        </div>
        <UploadStatus
          count={statusCount}
          emptyLabel={emptyLabel}
          filledLabel={filledLabel}
        />
        {statusMessage ? (
          <span
            className={[
              "text-sm",
              statusMessage.tone === "success"
                ? isDark
                  ? "text-emerald-200"
                  : "text-emerald-700"
                : statusMessage.tone === "danger"
                  ? isDark
                    ? "text-rose-200"
                    : "text-rose-700"
                  : isDark
                    ? "text-white/72"
                    : "text-[var(--muted)]",
            ].join(" ")}
          >
            {statusMessage.text}
          </span>
        ) : null}
      </button>
    </>
  )
}
