# Product Specification — soloLeving

Condensed working spec. The full behavioral requirements live in the original master
development prompt; this file captures decisions and scope as implemented.

## Identity

- **Name:** soloLeving
- **Category:** Personal Productivity / Habit Tracking
- **Platform:** Windows 10/11 (Electron)
- **Data:** 100% local. No cloud, no telemetry, no accounts.
- **Language:** English first; structure supports future localization.

## Differentiator

A compact **floating desktop widget** (independent `BrowserWindow`, ~320×190,
frameless, transparent, always-on-top, draggable, position-persistent) showing today's
progress ring, completed/total count, up to 3 habit previews, and quick actions —
always synchronized with the main app through the same main-process progress service.

## Modules

1. **Today Dashboard** — greeting, date, completion %, counts, progress ring, habits
   grouped by category, streak, quick actions, optional daily note. Updates
   immediately after every tracking action. Honest empty state when nothing is scheduled.
2. **Habit Management** — CRUD, archive/restore, delete-with-confirm, search, filter
   by category, reorder, schedule (every day / weekdays / custom, start/end dates),
   daily targets, optional reminders. Three tracking types:
   - *Boolean* — complete/incomplete.
   - *Quantity* — `current / target`, increment/decrement/manual edit, no negatives.
   - *Duration* — start/pause/resume/stop timer + manual entry; sessions persist
     across restarts; one active session at a time.
3. **Scheduling & daily logic** — unscheduled habits never count as incomplete;
   explicit **Skip for today** removes a habit from the denominator and pauses its
   streak; streaks respect scheduled days, not calendar days; all dates are local
   `YYYY-MM-DD`.
4. **Progress engine** — single domain service (never duplicated in UI or widget):
   boolean → 0/1; quantity → `min(actual/target, 1)`; duration → `min(actual/target, 1)`;
   daily % = mean of included habits × 100. Targets > 0; no habit contributes > 100%.
5. **Routines** — reusable groups of existing habits (morning, evening, study, gym).
6. **Analytics** — daily/weekly/monthly/yearly completion, per-habit performance,
   current/best streak, time totals, consistency %, heatmap. Never count unscheduled
   days as failures. Real data only — no fake chart filler.
7. **History** — browse prior days: completed, missed, skipped.
8. **Settings** — appearance, widget behavior, notifications, startup, backup/restore.
9. **Notifications & tray** — per-habit optional reminders respecting schedules and
   avoiding spam; tray with open app / show-hide widget / real exit; main window
   close-to-tray (configurable); optional Windows startup via login item settings.
10. **Backup** — atomic DB backup/restore with validation and overwrite protection.

## Non-goals

- Cloud sync, multi-user, authentication.
- Arbitrary plugin systems.
- Cross-platform polish beyond Windows (Linux/macOS may work but are untested).
