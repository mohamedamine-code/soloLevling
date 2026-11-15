// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function renderDialog(
  onConfirm: () => void = vi.fn(),
  onCancel: () => void = vi.fn(),
  destructive = false
) {
  return render(
    <ConfirmDialog
      open
      title="Delete habit?"
      message="This cannot be undone."
      confirmLabel="Delete"
      destructive={destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    renderDialog()
    expect(screen.getByText('Delete habit?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderDialog(onConfirm)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog(vi.fn(), onCancel)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="Should not appear"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument()
  })
})
