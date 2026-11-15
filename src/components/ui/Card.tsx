import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...rest }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-card border border-border/60 bg-surface p-5 shadow-none',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
