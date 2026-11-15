// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('defaults to type="button" so forms never submit implicitly', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('supports the native submit type', () => {
    render(<Button type="submit">Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'submit')
  })

  it('does not fire onClick while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Export
      </Button>
    )

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('fires onClick when enabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Restore</Button>)

    await user.click(screen.getByRole('button', { name: 'Restore' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['primary', 'bg-primary'],
    ['secondary', 'bg-elevated'],
    ['ghost', 'bg-transparent']
  ] as const)('applies the %s variant class', (variant, expectedClass) => {
    render(<Button variant={variant}>{variant}</Button>)
    expect(screen.getByRole('button', { name: variant })).toHaveClass(expectedClass)
  })
})
