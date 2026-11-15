import { useEffect, useState } from 'react'
import type { ActiveTimerSession } from '@shared/types'

/**
 * Live timer readout. The parent mounts it with a key that changes when the
 * session or its status changes, so state initializes at mount. Ticks once
 * per second while running — no IPC spam.
 */
export function TimerDisplay({ session }: { session: ActiveTimerSession }): React.JSX.Element {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const isRunning = session.status === 'running'

  useEffect(() => {
    if (!isRunning) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [isRunning])

  const delta = isRunning ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
  return (
    <span className="font-mono text-xs tabular-nums text-primary">
      {formatElapsedShort(session.elapsedSeconds + delta)}
    </span>
  )
}

/** Formats seconds as mm:ss (or h:mm:ss beyond an hour). */
export function formatElapsedShort(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
