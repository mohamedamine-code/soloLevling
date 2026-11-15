import { cn } from '@/utils/cn'

interface ProgressBarProps {
  /** 0–100. Values are clamped. */
  value: number
  className?: string
  /** Accessible label announced to screen readers. */
  label?: string
}

export function ProgressBar({ value, className, label }: ProgressBarProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label ?? 'Progress'}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
