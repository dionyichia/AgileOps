# AgileOps (Axis) Frontend Design Reference

Design system reference for the Axis brand — the public-facing name for the AgileOps platform.

---

## Color Palette

### Brand Gradient
The primary brand expression is a violet-to-coral gradient. Used on CTAs, active nav items, progress fills, and accent elements.

| Stop | Hex | Use |
|------|-----|-----|
| Violet 900 | `#5E149F` | Gradient start |
| Orchid 700 | `#B4308B` | Gradient mid-left |
| Pink 500 | `#E2409B` | Gradient mid-right |
| Coral 400 | `#F75A8C` | Gradient end |

CSS variable: `--axis-button-gradient: linear-gradient(90deg, #5E149F 0%, #B4308B 38%, #E2409B 72%, #F75A8C 100%)`
Tailwind class: `axis-gradient-button`

### Semantic Colors (status / data)

| Name | 500 value | Purpose |
|------|-----------|---------|
| Gold | `#FFBF00` | Warning, in-progress, revenue metrics |
| Magenta | `#E83F6F` | Error accents, destructive actions |
| Cerulean | `#2274A5` | Info, links, navigation accents |
| Sea | `#32936F` | Success, positive ROI, savings |

All four have full 50–900 shade scales in `tailwind.config.js`. Use the `/15` opacity modifier for tinted badge backgrounds (e.g. `bg-sea-500/15 text-sea-300`).

### Surface Palette

| Context | Value | Tailwind |
|---------|-------|----------|
| Light page background | `#F7F4FB` | — |
| White card | `#FFFFFF` | `bg-white` |
| Dark page background | `#080C18` | `bg-navy-900` |
| Dark card | `#0F1629` | `bg-navy-800` |
| Dark sidebar/panel | `#162040` | `bg-navy-700` |
| Dark interactive | `#1E2D4A` | `bg-navy-600` |

### Borders & Overlays
- Light borders: `border-black/[0.08]` – `border-black/[0.14]`
- Dark borders: `border-slate-800`
- Modal overlay: `bg-black/60 backdrop-blur-sm`
- Sticky headers: `bg-white/90 backdrop-blur-sm`

---

## Typography

**Font family:** Plus Jakarta Sans (`font-sans`). Falls back to `system-ui, sans-serif`.

### Scale

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Hero headline | 56–70px | 700 | `tracking-[-0.04em]` |
| Page title | 36–46px | 700 | `tracking-[-0.04em]` |
| Section heading | 28–34px | 700 | |
| Card title | 18–24px | 600–700 | |
| Large body | 18–24px | 400–500 | |
| Body | 16–17px | 400 | |
| UI label | 13–15px | 600–700 | `uppercase tracking-[0.16em]` |
| Caption / meta | 10–12px | 400 | Often uppercase |
| Micro label | 9–10px | 700 | `tracking-[0.18em]` |

### Rules
- Headings always use tight tracking (`-0.04em`).
- Uppercase labels always use wide tracking (`0.14em`–`0.18em`).
- Body text opacity is typically `text-black/70`–`text-black/84` on white, never full black.

---

## Spacing & Layout

### Page Structure
- Max content width: `max-w-7xl mx-auto`
- Horizontal padding: `px-6 md:px-10`
- Vertical section gaps: `py-16`–`py-24`
- Card-to-card gaps: `gap-4`–`gap-6`

### Standard Card
```
rounded-[24px]–[28px]
border border-black/[0.08]
shadow: 0 18px 40px rgba(15,23,42,0.05)–(0.10)
p-5–p-9
```

### Two-Panel Layout (Workflow pages)
- Left panel: fixed `w-72`, `sticky top-0 h-screen`, scrollable
- Right panel: `flex-1 min-w-0`, full height, contains React Flow

### Sidebar (Dashboard)
- Width: `w-64`
- Background: `bg-white`
- Nav item height: `py-3 px-4 rounded-2xl`
- Active: gradient background + white text + shadow
- Inactive hover: `hover:bg-black/[0.03]`

---

## Components

### Buttons

**Primary (gradient pill)**
```
axis-gradient-button
rounded-full px-6–8 py-3–4
text-white font-semibold text-sm–base
hover:brightness-[1.02]
disabled:opacity-40 disabled:cursor-not-allowed
```

**Secondary (outlined)**
```
rounded-full px-6 py-3
border border-black/[0.10] hover:border-black/[0.18]
text-sm font-medium
```

**Icon button**
```
p-2 rounded-xl
hover:bg-black/[0.03]
```

### Inputs & Forms
```
bg-[#F6F6F6] or bg-[#F7F4FB]
border border-black/[0.10]
focus:border-[#B4308B] focus:outline-none
rounded-[14px]–[18px]
px-4–5 py-3–4
placeholder:text-black/[0.28]–[0.35]
text-sm–base
```

Selects use the same styling with a `ChevronDown` icon absolutely positioned on the right.

Pill-toggle pattern (responsibilities selector):
- Unselected: `bg-white border-black/[0.08] text-black/72`
- Selected: `bg-[#5E149F]/10 border-[#B4308B] text-[#5E149F]`

### Badges / Status Pills

```
rounded-full px-2.5 py-1
text-xs font-semibold uppercase tracking-wide
```

| State | Background | Text |
|-------|-----------|------|
| Success | `bg-sea-500/15` | `text-sea-300` |
| Warning | `bg-gold-500/15` | `text-gold-300` |
| Info | `bg-cerulean-500/15` | `text-cerulean-300` |
| Error | `bg-magenta-500/15` | `text-magenta-300` |

### Cards (content variants)

**Stat card**
- Border: `border-[rgba(94,20,159,0.12)]`
- Metric label: `text-xs uppercase tracking-widest text-black/42`
- Value: `text-3xl font-bold`
- Progress bar: gradient fill on `bg-black/[0.06]` track, `rounded-full h-1.5`

**Category badge (tool stack)**
- Inline pill on tool list headers
- Each category gets a consistent color — use Cerulean for CRM, Gold for communication, Sea for project mgmt, Magenta for analytics

### Modals
```
fixed inset-0 bg-black/60 backdrop-blur-sm z-50
flex items-center justify-center p-4

inner: bg-white rounded-2xl border border-black/[0.08]
       shadow: 0 32px 80px rgba(15,23,42,0.14)
       max-w-4xl w-full p-8
```

### Step Indicator (StepLayout)
- Each step: numbered circle + label
- Pending: `bg-black/[0.06] text-black/40`
- Active: gradient background + white text + `shadow-[0_4px_14px_rgba(94,20,159,0.35)]`
- Complete: `bg-[#5E149F]/10 text-[#5E149F]`
- Connector line: `bg-black/[0.08]` pending → gradient when complete

### Skeleton / Loading States
- `SkeletonLine`: `h-3 bg-slate-800 rounded animate-pulse`
- `SkeletonCard`: dark navy card with 3–4 stacked skeleton lines
- `PageLoader`: centered spinner + "Loading…" label on dark background
- `ErrorState`: icon + message + "Retry" outlined button

---

## React Flow (Workflow Visualization)

### Background
- Pattern: dots
- Color: `#E8D8F4` on light pages, `rgba(255,255,255,0.04)` on dark

### TaskNode
```
rounded-[18px]
bg-white border border-black/[0.08]
shadow: 0 16px 30px rgba(15,23,42,0.08)
p-3–4 min-w-[160px]
```
- New/highlighted: `border-[#B4308B] border-2`
- "NEW" badge: `bg-[#F75A8C]/15 text-[#F75A8C] text-[9px] uppercase tracking-[0.18em]`
- Tool tags: pill badges, colored by category
- Duration: `text-[11px] text-black/50`
- Automatable badge:
  - High: `bg-[#5E149F]/12 text-[#5E149F]`
  - Medium: `bg-[#E2409B]/12 text-[#E2409B]`
  - Low: `bg-[#F75A8C]/12 text-[#F75A8C]`

### Handles
```
width: 8px height: 8px
border: 2px solid #D29AE8
background: white
border-radius: 50%
```

### TerminalNode
- Success: `bg-[#F4E8FB] text-[#5E149F] border-[#D29AE8]`
- Fail: `bg-[#FFE9EF] text-[#F75A8C] border-[#F75A8C]/30`
- Neutral: white background

### Edge Colors (legend)
- Standard path: Cerulean (`#2274A5`)
- Success path: Sea green (`#32936F`)
- Fail/retry path: Magenta (`#E83F6F`)
- New (simulated) path: Gold (`#FFBF00`)

---

## Animation

Defined in `tailwind.config.js`:

| Class | Keyframes | Duration | Use |
|-------|-----------|----------|-----|
| `animate-fade-in` | opacity 0→1 + translateY 16px→0 | 0.4s ease-out | Page/section entry |
| `animate-slide-up` | translateY 16px→0 | 0.4s ease-out | Card entry |
| `animate-pulse-slow` | opacity pulse | 2.5s infinite | Loading indicators |
| `animate-bounce-slow` | 6px vertical bounce | 2s ease-in-out | Empty state icons |

All interactive transitions use `transition-all duration-200` unless a slower feel is needed (`duration-300`).

---

## Page-by-Page Design Notes

### `/` — LandingPage
- White background throughout
- Hero: full-viewport, centered headline, gradient CTA, placeholder hero image
- "How It Works" cards: full-bleed gradient fills (160deg, violet→coral), white text
- "What You Get" section: gradient vertical background, white icon cards
- Footer: gradient background, 3-column link grid, CTA box with glass border (`border-white/18 bg-white/10 backdrop-blur-sm`)

### `/dashboard` — Client Dashboard
- Background: `#F7F4FB` (light lavender)
- White sidebar left, white cards in grid
- Workflow map card: full-width, 520px React Flow height, animated comment panel slides in from right
- Tool stack sidebar (inside card): click tool → show feature breakdown → gradient Simulate button

### `/internal` routes — Dark Theme
- Background: `#080C18` / `#0F1629`
- All cards use dark navy (`bg-[#111827]`, `border-slate-800`, `text-slate-300`)
- Action links colored (cerulean for primary, sea for view, magenta for destructive)
- Status badges same semantic colors but on dark backgrounds

### `/projects/:id/transcripts` — TranscriptInput
- 3+2 column split, dark theme
- Form card: white on dark background (contrasting island)
- Transcript history: dark collapsible rows, monospace expanded text
- Pipeline actions: dark card, conditional button states, animated progress bars

### Simulation loading overlay
- Centered card: `rounded-[32px]`, subtle gradient background
- Progress bar: gradient fill tracks job stages
- Stage indicators: check (done), animated dot (active), hollow circle (pending)

---

## Responsive Breakpoints

| Breakpoint | px | Notes |
|------------|----|-------|
| `sm` | 640 | Rarely used — mobile-first then jump to md |
| `md` | 768 | 2-column layouts activate, larger text |
| `lg` | 1024 | 3–4 column grids, full sidebars |
| `xl` | 1280 | Max content containers fully expressed |

Pattern: mobile = stacked single column, `md:` = 2-col, `lg:` = 3–4 col. Sidebars are always hidden on mobile.

---

## Dos and Don'ts

**Do**
- Use `rounded-[24px]` or `rounded-[28px]` for cards (not `rounded-xl`)
- Pair every status color with an icon — never rely on color alone
- Use the brand gradient for the single most important action on a page
- Use tight tracking (`-0.04em`) on all headings
- Use `border-black/[0.08]` for subtle card borders on white backgrounds

**Don't**
- Use fully opaque black text — use `text-black/70`–`text-black/84` for body
- Mix light and dark card styles on the same surface
- Use flat fill colors for primary CTAs — always gradient
- Add shadows larger than `0 18px 40px rgba(15,23,42,0.10)` on cards
- Use `rounded-lg` or standard Tailwind rounding on primary cards
