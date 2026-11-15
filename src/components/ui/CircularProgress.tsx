import { cn } from '@/utils/cn'

interface CircularProgressProps {
  /** 0–100. Values are clamped. */
  value: number
  /** Outer size in pixels. */
  size?: number
  /** Ring thickness in pixels. */
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
}

/**
 * SVG circular progress indicator. Animates via CSS transition on the
 * stroke-dashoffset, which respects the global reduced-motion rule.
 */
export function CircularProgress({
  value,
  size = 96,
  strokeWidth = 8,
  className,
  children
}: CircularProgressProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Progress ${Math.round(clamped)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-elevated"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
