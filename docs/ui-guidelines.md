# UI Guidelines

> Phase 1 scope. Extend this file whenever tokens or components change.

## Theme philosophy — "Calm Productivity"

Minimal but not empty. Modern but restrained. The app should feel like a personal
companion, not a corporate dashboard. Avoid: heavy gradients, many colors, excess
borders/shadows/glass, oversized typography, decorative animations.

## Color tokens

Defined once in `src/styles/global.css`; raw variables live in `:root` (light) and
`.dark`. Tailwind classes derive from them via `@theme inline`.

| Token | Dark | Light | Usage |
| --- | --- | --- | --- |
| `background` | `#111318` | `#F7F8F6` | app background |
| `sidebar` | `#171A21` | `#FFFFFF` | sidebar |
| `surface` | `#1D222B` | `#FFFFFF` | cards, panels |
| `elevated` | `#252B35` | `#F0F3F0` | hover surfaces, wells, progress track |
| `primary` | `#32B77A` | `#18885C` | accent, progress, primary buttons |
| `primary-soft` | `#80CFA7` | `#62B78F` | secondary accent |
| `on-primary` | `#0E1512` | `#FFFFFF` | text on primary buttons |
| `foreground` | `#F4F6F5` | `#202722` | main text |
| `muted` | `#9CA6A1` | `#747E77` | secondary text |
| `border` | `#2A3038` | `#E6EAE6` | subtle borders |
| `danger` / `warning` | `#E5484F` / `#F5A524` | `#D5484F` / `#D99A2B` | destructive / pending |

**Rules:** never hardcode hex values in components; use Tailwind token classes
(`bg-surface`, `text-muted`, `border-border`...). Accent opacity modifiers
(`bg-primary/12`) are fine for tints.

## Typography

- Font: **Inter Variable** (bundled locally via `@fontsource-variable/inter` — fully offline).
- Scale: page title `text-2xl font-semibold tracking-tight`; section title
  `text-base font-medium`; body `text-sm`; secondary `text-sm text-muted`; meta `text-xs`.
- Avoid headings larger than `text-2xl`; avoid text smaller than `text-[11px]`.

## Spacing & shape

- Page container: `max-w-4xl mx-auto px-8 py-8`.
- Cards: `rounded-card` (0.75rem), `p-5`, border `border-border/60`, no shadow.
- Buttons: height 40px (`md`) / 32px (`sm`), radius `rounded-lg`.

## Components (`src/components/ui/`)

- **Button** — variants `primary | secondary | ghost`, sizes `sm | md`.
- **Card** — surface panel.
- **Badge** — tones `neutral | success | warning | muted`.
- **ProgressBar** — linear, animated width.
- **CircularProgress** — SVG ring with centered content.
- **EmptyState** — dashed-border panel with icon/title/description; used for every
  empty or not-yet-implemented feature. **Never fake data.**

Planned: Dialog, Input, Select, Tabs, Tooltip, Toast, ConfirmDialog, DateSelector,
HabitCard (Phases 2–3). Prefer shadcn/ui primitives as bases when they fit the tokens.

## Icons

Lucide React only. Standard: `size-[18px]` in nav/buttons, `size-5` in feature
graphics, `strokeWidth={1.75}`. Do not mix icon families.

## Motion

- Subtle only: 150–200ms color/opacity transitions, 500–700ms progress fills.
- `prefers-reduced-motion` is globally enforced in `global.css`.
- Animations must never delay tracking actions or block input.
- Add Motion for React (Framer) only when Phase 3+ needs enter/exit transitions.

## Widget visual language (Phase 4 target)

Compact (~320×190), transparent over the desktop, single accent for the progress
ring, `6 / 9 habits`-style count, up to 3 habit previews, quiet typography. Must
include a fallback opaque style for systems where transparency misbehaves.

## Interaction rules

- Every visible control must do something real; use `disabled` + honest labels otherwise.
- Keyboard focus is visible: `focus-visible:outline-2 focus-visible:outline-primary/60`.
- Text selection is disabled globally except inputs/textareas (desktop-app feel).
