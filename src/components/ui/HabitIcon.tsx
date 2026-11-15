import type { LucideIcon } from 'lucide-react'
import { BookOpen, HeartPulse, ListChecks, Sparkles, User, Zap } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  HeartPulse,
  BookOpen,
  Zap,
  User
}

interface HabitIconProps {
  name: string
  className?: string
  strokeWidth?: number
}

/** Renders a habit icon by stored name, with a safe fallback. */
export function HabitIcon({ name, className, strokeWidth = 1.75 }: HabitIconProps): React.JSX.Element {
  const Icon = ICON_MAP[name] ?? ListChecks
  return <Icon className={className} strokeWidth={strokeWidth} />
}
