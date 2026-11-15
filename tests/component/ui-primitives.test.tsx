// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { EmptyState } from '@/components/ui/EmptyState'

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge tone="success">Done</Badge>)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it.each([
    ['neutral', 'bg-elevated'],
    ['success', 'bg-primary/12'],
    ['warning', 'bg-warning/12']
  ] as const)('applies tone styling for %s', (tone, expectedClass) => {
    render(<Badge tone={tone}>{tone}</Badge>)
    expect(screen.getByText(tone)).toHaveClass(expectedClass)
  })
})

describe('CircularProgress', () => {
  it('clamps values above 100 to a full ring', () => {
    render(<CircularProgress value={150}>x</CircularProgress>)
    expect(screen.getByRole('img', { name: 'Progress 100 percent' })).toBeInTheDocument()
  })

  it('clamps negative values to an empty ring', () => {
    render(<CircularProgress value={-20}>x</CircularProgress>)
    expect(screen.getByRole('img', { name: 'Progress 0 percent' })).toBeInTheDocument()
  })

  it('labels the rounded percent', () => {
    render(<CircularProgress value={45.4}>x</CircularProgress>)
    expect(screen.getByRole('img', { name: 'Progress 45 percent' })).toBeInTheDocument()
  })

  it('renders children in the center', () => {
    render(<CircularProgress value={50}>42%</CircularProgress>)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders icon, title, description, and actions', () => {
    render(
      <EmptyState
        icon={CalendarClock}
        title="No habits yet"
        description="Create your first habit."
      >
        <button type="button">Add habit</button>
      </EmptyState>
    )
    expect(screen.getByText('No habits yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first habit.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add habit' })).toBeInTheDocument()
  })
})
