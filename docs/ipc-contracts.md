# IPC Contracts

> Every exposed renderer API is documented here. Keep in sync with
> `shared/contracts/api.ts`, `shared/constants/ipc-channels.ts`, and
> `electron/main/ipc/register-handlers.ts`.

## Rules

- Channels are declared once in `shared/constants/ipc-channels.ts` (typed const object).
- Handlers are registered **only** in `electron/main/ipc/register-handlers.ts`.
- The preload wraps each channel behind the typed `SoloLevingApi` interface.
- From Phase 2 onward, all inputs crossing IPC are validated with Zod in the main
  process. Trust nothing from the renderer.

## Exposed API

### `window.soloLeving.app.getInfo()`

| | |
| --- | --- |
| Channel | `app:get-info` (`IPC_CHANNELS.AppGetInfo`) |
| Direction | renderer → main (invoke/handle) |
| Input | none |
| Returns | `Promise<AppInfo>` — `{ name, version, electron, chrome, node }` |
| Validation | no input to validate |
| Errors | none expected; rejects only on catastrophic IPC failure |
| Owner | main process (static data from `app`/`process.versions`) |

Example:

```ts
const info = await window.soloLeving.app.getInfo()
// { name: 'soloLeving', version: '0.1.0', electron: '45.x', ... }
```

### Habits (Phase 2)

All habit methods delegate to `HabitService` in `electron/main/services/habit-service.ts`,
which validates every input with Zod (`shared/validation/habit.ts`) and throws a
`ServiceError` (message string) on invalid input, unknown ids, or rule violations.
The renderer receives the rejection message for display.

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `habits.list()` | `habits:list` | none | `Promise<Habit[]>` (active + archived, ordered) |
| `habits.create(input)` | `habits:create` | `HabitCreateInput` (Zod: `habitCreateSchema`) | `Promise<Habit>` |
| `habits.update(id, input)` | `habits:update` | uuid + `HabitUpdateInput` (partial merge) | `Promise<Habit>` |
| `habits.archive(id)` | `habits:archive` | uuid | `Promise<Habit>` (archivedAt set, isActive false) |
| `habits.restore(id)` | `habits:restore` | uuid | `Promise<Habit>` (archivedAt cleared) |
| `habits.remove(id)` | `habits:delete` | uuid | `Promise<void>` (permanent, schedule cascades) |
| `habits.reorder(orderedIds)` | `habits:reorder` | array of uuids (all habits) | `Promise<Habit[]>` reordered |

Business rules enforced in the main process:

- `name` required (1–100 chars), `description` ≤ 500, `unit` ≤ 20.
- Boolean habits force `targetValue = 1` and clear `unit`.
- Quantity/duration habits require `targetValue > 0`.
- `weekdays` schedules require ≥ 1 selected weekday; `endDate ≥ startDate`.
- Unknown ids (update/archive/restore/delete) reject with "Habit not found".

### Settings (Phase 2, minimal)

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `settings.get(key)` | `settings:get` | key string (1–100 chars) | `Promise<string \| null>` |
| `settings.set(key, value)` | `settings:set` | key string + value string (≤ 2000 chars) | `Promise<void>` |

No UI consumes settings yet; the table and API exist so Phase 4+ preferences (theme
migration from localStorage, widget prefs, notifications) have a home.

### Tracking (Phase 3)
All tracking methods delegate to `TrackingService` in
`electron/main/services/tracking-service.ts`, which validates every input with Zod
(`shared/validation/tracking.ts`) and throws a `ServiceError` (message string) on
invalid input, unknown/archived habits, type mismatches, or the one-active-timer
rule. The renderer receives the rejection message for display.

**Convention: every mutation returns a fresh `DaySnapshot`** (`{ date, states,
progress, overallStreak, activeTimer }`) for the affected day — the single source
of truth for the dashboard and (later) the widget. Date inputs are local
`YYYY-MM-DD` keys; the main process re-validates them.

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `tracking.getDay(date)` | `tracking:get-day` | date key (Zod-validated) | `Promise<DaySnapshot>` |
| `tracking.complete(habitId, date)` | `tracking:complete` | uuid + date | `Promise<DaySnapshot>` (idempotent) |
| `tracking.uncomplete(habitId, date)` | `tracking:uncomplete` | uuid + date | `Promise<DaySnapshot>` |
| `tracking.setQuantity(habitId, date, value)` | `tracking:set-quantity` | uuid + date + number ≥ 0 | `Promise<DaySnapshot>` (replaces; 0 clears) |
| `tracking.incrementQuantity(habitId, date, delta)` | `tracking:increment-quantity` | uuid + date + delta (clamped at 0) | `Promise<DaySnapshot>` |
| `tracking.addDuration(habitId, date, minutes)` | `tracking:add-duration` | uuid + date + minutes 0.1–1440 | `Promise<DaySnapshot>` (appends entry) |
| `tracking.startTimer(habitId, date)` | `tracking:start-timer` | uuid + date | `Promise<DaySnapshot>` — rejects if any other timer is active |
| `tracking.pauseTimer(habitId)` | `tracking:pause-timer` | uuid | `Promise<DaySnapshot>` |
| `tracking.resumeTimer(habitId)` | `tracking:resume-timer` | uuid | `Promise<DaySnapshot>` |
| `tracking.stopTimer(habitId)` | `tracking:stop-timer` | uuid | `Promise<DaySnapshot>` — commits elapsed minutes as an entry |
| `tracking.getActiveTimer()` | `tracking:get-active-timer` | none | `Promise<ActiveTimerSession \| null>` |
| `tracking.skip(habitId, date)` | `tracking:skip` | uuid + date | `Promise<DaySnapshot>` |
| `tracking.unskip(habitId, date)` | `tracking:unskip` | uuid + date | `Promise<DaySnapshot>` |

Business rules enforced in the main process:

- Unknown ids reject with "Habit not found"; archived habits reject with
  "Archived habits cannot be tracked".
- Type guards: `setQuantity`/`incrementQuantity` reject non-quantity habits;
  `addDuration`/timers reject non-duration habits.
- Only ONE active timer session may exist app-wide. Starting a second timer
  rejects with "Finish the active timer first — only one timer can run at a time".
- Timer elapsed time is recomputed from `started_at`, so restarts never lose
  running time; stopping commits `accumulated` as a duration entry (0.1 min
  rounding, attributed to the session's start date).
- `skip`/`unskip` manipulate `habit_day_overrides` only — no tracking entries.

**Live updates:** every tracking mutation AND every habit mutation broadcasts a
fresh `DaySnapshot` to all windows (see Events below).

### Routines (Phase 5)

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `routines.list()` | `routines:list` | none | `Promise<Routine[]>` �" member habits resolved live, in display order |
| `routines.create(input)` | `routines:create` | `{ name, description?, habitIds[] }` | `Promise<Routine>` |
| `routines.update(id, input)` | `routines:update` | `{ name?, description?, habitIds? }` (partial) | `Promise<Routine>` |
| `routines.remove(id)` | `routines:delete` | uuid | `Promise<void>` �" member habits untouched |

Business rules enforced in the main process (Zod-validated):

- Name 1–80 chars after trim; description ��� 300.
- Member ids must exist, be active (not archived), and not duplicate; max 50 members.
- `habitIds` replaces the whole member list when provided (order = check order).
- Deleting a routine never touches the habits themselves.

### Range analytics (Phase 5)

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `tracking.getRange(fromDate, toDate)` | `tracking:get-range` | two local `YYYY-MM-DD` keys, from ��� to | `Promise<RangeAnalytics>` |

`RangeAnalytics` = `{ fromDate, toDate, days: DaySummaryPoint[], habits:
HabitRangeStats[], totalDurationMinutes, averagePercent }`. Rules:

- The effective end is clamped to today; future days produce no data (never fake
  chart filler) and an entirely-future range returns an empty `days` array.
- Per-day: `percent` is `null` when nothing counted that day; `skippedCount`
  excludes skipped habits from `includedCount`; `missedCount` = scheduled but
  not completed (only possible for past days).
- Per-habit: `scheduledDays`/`completedDays` count only counted days in range;
  `currentStreak`/`bestStreak` are lifetime streaks (computed from schedule
  start, not range start); `totalValue` = completed days for boolean habits,
  summed units/minutes otherwise.
- Inverted ranges (from > to) reject with a validation error.

### Widget (Phase 4)

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `widget.setVisible(visible)` | `widget:set-visible` | boolean | `Promise<void>` — persists `widget.visible` and shows (creating if needed) or hides the widget |
| `widget.hide()` | `widget:hide` | none | `Promise<void>` — hides the widget without persisting (its own close button) |
| `widget.openMain()` | `widget:open-main` | none | `Promise<void>` — focuses the main window, recreating it if closed |

### Notifications (Phase 6)

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `notifications.test()` | `notifications:test` | none | `Promise<void>` — shows a test toast immediately; rejects with "Notifications are not supported on this system" when unsupported |

Reminder preferences use the existing generic `settings:get`/`settings:set`
channels with these main-process-owned keys:

| Key | Values | Default | Notes |
| --- | --- | --- | --- |
| `notifications.enabled` | `'1'` / `'0'` | unset (off) | read by the reminder scheduler |
| `notifications.time` | `'HH:MM'` 24h local | `'09:00'` | invalid format → no fire |
| `notifications.lastFired` | local `YYYY-MM-DD` | — | written by the main process ONLY, never exposed in UI |
| `window.closeToTray` | `'1'` / `'0'` | unset (off) | read by the main-window close handler |

### Backup (Phase 7)

| Method | Channel | Input | Returns |
| --- | --- | --- | --- |
| `backup.export()` | `backup:export` | none | `Promise<BackupExportResult \| null>` — save dialog, then an atomic snapshot via the online backup API; `null` when canceled |
| `backup.import()` | `backup:import` | none | `Promise<BackupImportResult \| null>` — open dialog, validation, atomic swap + service rebuild + renderer reload; `null` when canceled |

Notes:

- `backup.import()` assumes the renderer ALREADY showed the destructive
  confirmation (Settings ConfirmDialog). The main process validates the
  file (integrity check, soloLeving tables, migration versions ≤ current
  schema) and rejects with a user-readable `ServiceError` message.
- A restore keeps a safety copy at `sololeving.db.pre-restore` and returns
  `migrationsApplied` (missing migrations applied on reopen).

## Events (main → renderer)

### `tracking:snapshot-changed` (Phase 4)

- **Direction:** main → all windows (`webContents.send`), subscribed via
  `window.soloLeving.tracking.onSnapshotChanged(callback)`, which returns an
  unsubscribe function.
- **Payload:** a fresh `DaySnapshot` for the day a mutation affected
  (`{ date, states, progress, overallStreak, activeTimer }`).
- **When:** after EVERY tracking mutation, and after habit
  create/update/archive/restore/delete/reorder (habit changes can affect what
  counts today; a snapshot for today's key is broadcast then).
- **Contract:** receivers replace their whole snapshot only when
  `snapshot.date` matches the day they render. Never patch snapshot state
  locally. This is currently the ONLY main→renderer push event; document any
  new event here with payload types and subscription semantics.
