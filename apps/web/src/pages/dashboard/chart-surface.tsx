import { useEffect, useRef, useState, type ReactNode } from "react"

type ChartSize = {
  height: number
  width: number
}

type ChartSurfaceProps = {
  children: (size: ChartSize) => ReactNode
  className: string
  fallbackSize: ChartSize
}

export function ChartSurface({
  children,
  className,
  fallbackSize,
}: ChartSurfaceProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [isReady, setIsReady] = useState(typeof ResizeObserver === "undefined")
  const [size, setSize] = useState<ChartSize>(fallbackSize)

  useEffect(() => {
    const frame = frameRef.current

    if (frame === null) {
      return
    }

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const syncSize = (nextWidth: number, nextHeight: number) => {
      if (nextWidth <= 0 || nextHeight <= 0) {
        return
      }

      setSize({
        width: Math.floor(nextWidth),
        height: Math.floor(nextHeight),
      })
      setIsReady(true)
    }

    const rect = frame.getBoundingClientRect()
    syncSize(rect.width, rect.height)

    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return
      }

      syncSize(entry.contentRect.width, entry.contentRect.height)
    })

    observer.observe(frame)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={frameRef} className={className}>
      {isReady ? children(size) : null}
    </div>
  )
}
