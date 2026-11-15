import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react'
import { cn } from '@/utils/cn'

const controlClasses = cn(
  'w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground',
  'placeholder:text-muted/70 transition-colors',
  'focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20'
)

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input className={cn(controlClasses, 'h-10', className)} {...rest} />
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return <textarea className={cn(controlClasses, 'min-h-20 resize-none', className)} {...rest} />
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select className={cn(controlClasses, 'h-10 cursor-pointer appearance-none', className)} {...rest}>
      {children}
    </select>
  )
}

interface FieldProps {
  label: string
  /** Optional right-aligned hint next to the label (e.g. "optional"). */
  hint?: string
  error?: string | null
  children: ReactNode
  className?: string
}

export function Field({ label, hint, error, children, className }: FieldProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: Array<{ value: T; label: string; description?: string }>
  onChange: (value: T) => void
  className?: string
}

/** Small segmented control for mutually exclusive choices. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div className={cn('flex rounded-lg bg-elevated p-1', className)} role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.description}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-sm transition-colors',
            value === option.value
              ? 'bg-surface font-medium text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
