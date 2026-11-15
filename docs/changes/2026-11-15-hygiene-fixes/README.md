# Modification: Live-refresh, Midnight Rollover & External URL Validation

**Date:** 2026-11-15 · **Phase:** 6.x (hygiene) · **Status:** Implemented

## 1. Summary

Three audit-found fixes on top of Phase 6:

1. **Analytics/History live-refresh** — both pages now subscribe to
   `tracking:snapshot-changed` and re-fetch when a mutation affects the data
   they display, matching the Today dashboard and widget behavior.
2. **Midnight rollover** — a shared `useTodayKey()` hook re-evaluates the
   local date every 30s, so the Today dashboard and widget roll to the new
   day in long-running sessions (previously they kept rendering/mutating
   yesterday until restart).
3. **External URL validation** — renderer-supplied URLs reach
   `shell.openExternal` only after protocol validation (http/https only),
   enforcing the AGENTS.md security rule. Unit-tested.

## 2. Motivation

Known issues recorded in the audit and `agent-handoff.md`: stale analytics,
a midnight edge case, and an unvalidated external-open path.

## 3. Previous Behavior

- Analytics refreshed only on range change/page revisit; History never
  refreshed after load.
- `TodayPage`/`WidgetApp` captured `toLocalDateKey(new Date())` once at
  mount.
- `will-navigate` opened any non-internal URL externally; the main window's
  `setWindowOpenHandler` opened every URL externally without checks.

## 4. New Behavior

- Any snapshot broadcast with `date >= range start` bumps an internal
  refresh key in `AnalyticsContent` (silent in-place data refresh — no
  loading flash). History does the same for `date === selectedDate`.
- `useTodayKey()` ticks every 30s and returns the current local key; pages
  depending on it re-run their load effects when the day changes.
- `isSafeExternalUrl()` (new pure helper) gates both `will-navigate` and
  `setWindowOpenHandler`; unsafe schemes (`file:`, `javascript:`, `data:`,
  `vbscript:`, custom protocol handlers) are blocked outright.

## 5. Files Created

- `src/utils/useTodayKey.ts` — rollover hook.
- `electron/main/windows/external-url.ts` — `isSafeExternalUrl()`.
- `tests/unit/external-url.test.ts` — 3 tests (safe schemes, dangerous
  schemes, malformed input).

## 6. Files Modified

- `src/features/analytics/AnalyticsPage.tsx` — subscription + refresh key.
- `src/features/history/HistoryPage.tsx` — same pattern.
- `src/features/dashboard/TodayPage.tsx` and `src/widget/WidgetApp.tsx` —
  consume `useTodayKey()`.
- `electron/main/index.ts`, `electron/main/windows/main-window.ts` —
  validated external opening.

## 7. Architecture

No architectural changes — the existing broadcast-and-replace sync contract
now covers all four data surfaces (Today, widget, Analytics, History).
`useTodayKey` is the single rollover mechanism; do not capture
`new Date()` keys at mount in pages.

## 8. Database Changes

None.

## 9. IPC Changes

None (reuses `tracking:snapshot-changed`).

## 10. UI Changes

None visible except: Analytics/History update in place after tracking
actions from any window.

## 11. Testing

- `tests/unit/external-url.test.ts` (3 tests).
- Manual: complete a habit while Analytics is open → chart/stat cards and
  heatmap update without switching ranges; same for History on the viewed
  day; leave the widget open across midnight (simulated by waiting) → day
  rolls over.

## 12. Verification

Executed on 2026-11-15:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors |
| `npm.cmd run lint` | ✅ zero errors |
| `npm.cmd run test` | ✅ 100/100 passed (10 files) |
| `npm.cmd run build` | ✅ built in ~1.35s |

## 13. Known Issues

- The 30s rollover poll can be up to 30s late crossing midnight (by design,
  negligible).
- Analytics refetch is per-snapshot (one request per mutation) — acceptable
  at human interaction rates.

## 14. Future Considerations

- Debounce snapshot-driven refetches if mutation frequency grows.
- Push a lightweight "data changed" event instead of full snapshots if the
  payload becomes a bottleneck.

## 15. AI Agent Handoff

- Use `useTodayKey()` for anything that must track "today"; never capture a
  date key in a `useState` initializer without rollover.
- `isSafeExternalUrl` is the single gate for `shell.openExternal` — route
  any new external-open path through it.
