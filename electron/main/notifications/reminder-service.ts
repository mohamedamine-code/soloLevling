import { Notification } from 'electron'
import type { SettingsRepository } from '../db/repositories/settings-repository'
import type { TrackingService } from '../services/tracking-service'
import { toLocalDateKey } from '@shared/utils/date'

/**
 * Daily habit reminders (Windows toasts).
 *
 * A once-per-minute scheduler checks, for today:
 * - `notifications.enabled` === '1'
 * - the reminder time (`notifications.time`, 'HH:MM' local, default 09:00)
 *   has been reached
 * - no reminder was already fired today (`notifications.lastFired`)
 * - at least one scheduled, non-skipped habit is not yet completed
 *
 * Fires at most ONE notification per day. If nothing is scheduled at the
 * check time the day is not marked as fired, so completing habits later
 * after adding them still produces a reminder that day.
 */

const DEFAULT_TIME = '09:00'
const CHECK_INTERVAL_MS = 60_000

export interface ReminderServiceDeps {
  settings: SettingsRepository
  trackingService: TrackingService
  /** Focuses/recreates the main window when a notification is clicked. */
  openMainWindow: () => void
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function startReminderService(deps: ReminderServiceDeps): void {
  if (!Notification.isSupported()) {
    // Honest fallback: silently no-op on systems without notification support.
    console.info('[notifications] not supported on this system; reminders disabled')
    return
  }

  const check = (): void => {
    try {
      checkAndMaybeNotify(deps)
    } catch (error) {
      // A reminder failure must never crash the scheduler.
      console.error('[notifications] reminder check failed:', error)
    }
  }

  setTimeout(check, 10_000)
  setInterval(check, CHECK_INTERVAL_MS)
}

/** Shows a test notification immediately (Settings "test" button). */
export function sendTestNotification(): void {
  if (!Notification.isSupported()) {
    throw new Error('Notifications are not supported on this system')
  }
  const notification = new Notification({
    title: 'soloLeving',
    body: 'Test notification — reminders will look like this.',
    silent: false
  })
  notification.show()
}

function checkAndMaybeNotify(deps: ReminderServiceDeps): void {
  const { settings, trackingService, openMainWindow } = deps

  if (settings.get('notifications.enabled') !== '1') return

  const now = new Date()
  const todayKey = toLocalDateKey(now)
  if (settings.get('notifications.lastFired') === todayKey) return

  const reminderTime = settings.get('notifications.time') ?? DEFAULT_TIME
  if (!TIME_PATTERN.test(reminderTime)) return

  const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number) as [number, number]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const reminderMinutes = reminderHour * 60 + reminderMinute
  if (nowMinutes < reminderMinutes) return

  const snapshot = trackingService.getDaySnapshot(todayKey)
  const open = snapshot.states.filter((state) => !state.skipped && state.status !== 'completed')
  if (open.length === 0) return

  const completed = snapshot.progress.completedCount
  const total = snapshot.progress.includedCount
  showReminder(`${open.length} habit${open.length === 1 ? '' : 's'} still open today`, `${completed} of ${total} done so far. Time to check in with yourself.`, openMainWindow)

  settings.set('notifications.lastFired', todayKey)
}

function showReminder(body: string, detail: string, openMainWindow: () => void): void {
  const notification = new Notification({
    title: 'Habit reminder',
    body: `${body}. ${detail}`,
    silent: false
  })
  notification.on('click', () => openMainWindow())
  notification.show()
}
