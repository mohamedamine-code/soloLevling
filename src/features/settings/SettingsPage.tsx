import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useThemeStore, type ThemeMode } from '@/stores/theme-store'
import { cn } from '@/utils/cn'
import type { AppInfo } from '@shared/types'
const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' }
]

function ThemeSelector(): React.JSX.Element {
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <div className="inline-flex rounded-lg bg-elevated p-1" role="radiogroup" aria-label="Theme">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          onClick={() => setMode(option.mode)}
          className={cn(
            'rounded-md px-3.5 py-1.5 text-sm transition-colors',
            mode === option.mode
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

function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.soloLeving.app.getInfo().then((value) => {
      if (!cancelled) setInfo(value)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return info
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-elevated'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

/** Persisted widget visibility: settings table + live show/hide in main. */
function useWidgetVisible(): { visible: boolean; setVisible: (value: boolean) => void } | null {
  const [visible, setStoredVisible] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.soloLeving.settings.get('widget.visible').then((value) => {
      if (!cancelled) setStoredVisible(value !== '0')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setVisible = (value: boolean): void => {
    setStoredVisible(value)
    void window.soloLeving.widget.setVisible(value)
  }

  return visible === null ? null : { visible, setVisible }
}

/** Generic persisted '1'/'0' flag from the settings table (null while loading). */
function useSettingFlag(key: string): {
  value: boolean | null
  setValue: (value: boolean) => void
} {
  const [value, setValueState] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.soloLeving.settings.get(key).then((raw) => {
      if (!cancelled) setValueState(raw === '1')
    })
    return () => {
      cancelled = true
    }
  }, [key])

  const setValue = (next: boolean): void => {
    setValueState(next)
    void window.soloLeving.settings.set(key, next ? '1' : '0')
  }

  return { value, setValue }
}

/** Persisted 'HH:MM' reminder time. */
function useReminderTime(): { time: string | null; setTime: (value: string) => void } {
  const [time, setTimeState] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.soloLeving.settings.get('notifications.time').then((value) => {
      if (!cancelled) setTimeState(value ?? '09:00')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setTime = (value: string): void => {
    setTimeState(value)
    void window.soloLeving.settings.set('notifications.time', value)
  }

  return { time, setTime }
}

export function SettingsPage(): React.JSX.Element {
  const appInfo = useAppInfo()
  const widget = useWidgetVisible()
  const closeToTray = useSettingFlag('window.closeToTray')
  const notifications = useSettingFlag('notifications.enabled')
  const reminderTime = useReminderTime()

  return (
    <div>
      <PageHeader title="Settings" subtitle="Appearance and application preferences." />

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Appearance</h2>
        <p className="mb-3 text-xs text-muted">Choose how soloLeving looks on your desktop.</p>
        <ThemeSelector />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Floating widget</h2>
        <p className="mb-3 text-xs text-muted">
          A compact always-on-top summary of today's progress, draggable anywhere on
          your desktop.
        </p>
        <SettingRow label="Show floating widget">
          {widget ? (
            <Toggle
              checked={widget.visible}
              onChange={(value) => widget.setVisible(value)}
              label="Show floating widget"
            />
          ) : (
            <span className="text-sm text-muted">…</span>
          )}
        </SettingRow>
        <div className="border-t border-border/60" />
        <SettingRow label="Widget position">
          <span className="text-sm text-muted">Drag the widget to move it</span>
        </SettingRow>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Notifications</h2>
        <p className="mb-3 text-xs text-muted">
          One daily reminder when scheduled habits are still open — never more than
          once per day.
        </p>
        <SettingRow label="Daily habit reminder">
          {notifications.value === null ? (
            <span className="text-sm text-muted">…</span>
          ) : (
            <Toggle
              checked={notifications.value}
              onChange={notifications.setValue}
              label="Daily habit reminder"
            />
          )}
        </SettingRow>
        <div className="border-t border-border/60" />
        <SettingRow label="Reminder time">
          {reminderTime.time === null ? (
            <span className="text-sm text-muted">…</span>
          ) : (
            <input
              type="time"
              value={reminderTime.time}
              onChange={(event) => {
                if (event.target.value !== '') reminderTime.setTime(event.target.value)
              }}
              aria-label="Reminder time"
              disabled={notifications.value !== true}
              className="h-8 rounded-lg bg-elevated px-2 text-sm tabular-nums text-foreground focus:outline-2 focus:outline-primary/60 disabled:opacity-50"
            />
          )}
        </SettingRow>
        <div className="border-t border-border/60" />
        <TestNotificationRow />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Behavior</h2>
        <SettingRow label="Close button keeps the app in the tray">
          {closeToTray.value === null ? (
            <span className="text-sm text-muted">…</span>
          ) : (
            <Toggle
              checked={closeToTray.value}
              onChange={closeToTray.setValue}
              label="Close button keeps the app in the tray"
            />
          )}
        </SettingRow>
        <p className="mt-1 text-xs text-muted">
          When enabled, closing the main window hides it to the tray instead of
          closing it. Quit soloLeving from the tray menu.
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Application</h2>
        <SettingRow label="Version">
          <span className="text-sm text-muted">{appInfo ? `v${appInfo.version}` : '…'}</span>
        </SettingRow>
        <div className="border-t border-border/60" />
        <SettingRow label="Electron runtime">
          <span className="text-sm text-muted">
            {appInfo ? `Electron ${appInfo.electron} · Node ${appInfo.node}` : '…'}
          </span>
        </SettingRow>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Coming in later phases</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
          <li>Database backup and restore (Phase 7)</li>
        </ul>
      </Card>
    </div>
  )
}

/** Test button with honest inline error feedback. */
function TestNotificationRow(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)

  const send = (): void => {
    setError(null)
    window.soloLeving.notifications
      .test()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not send a test notification')
      })
  }

  return (
    <>
      <SettingRow label="Test notification">
        <Button variant="secondary" size="sm" onClick={send}>
          Send test
        </Button>
      </SettingRow>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </>
  )
}
