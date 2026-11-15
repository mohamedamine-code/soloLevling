import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** Optional actions rendered below the description. */
  children?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border/80 bg-surface/50 px-6 py-14 text-center',
        className
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-elevated">
        <Icon className="size-5 text-muted" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}
