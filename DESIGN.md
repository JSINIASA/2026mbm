# Efron's Dice Design System

## 1. Atmosphere & Identity

A tabletop casino presented as a warmly lit felt table. The signature is the contrast between daylight-green felt and a deep-blue night table, with brass controls and slot-machine reds holding the interface together.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Felt dark | `--felt-dark` | `#0a3d2e` | Primary day background |
| Felt mid | `--felt-mid` | `#0f5c44` | Day depth and stage surfaces |
| Night navy | `--night-deep` | `#030a12` | Night transition destination |
| Brass | `--gold` | `#d4af37` | Borders and controls |
| Highlight brass | `--gold-light` | `#f0d875` | Headings, active labels, progress |
| Cream | `--cream` | `#f5f0e6` | Primary text and reel face |
| Machine red | `--machine-red` | `#4a0508` | Slot-machine body |
| Shadow | `--shadow` | `rgba(0, 0, 0, 0.45)` | Elevation and vignette |

## 3. Typography

Primary font: `Segoe UI, system-ui, sans-serif`.

| Level | Size | Weight | Usage |
|---|---:|---:|---|
| Page title | 1.75rem | 700 | Main panel heading |
| Section title | 1.05rem | 700 | Machine name |
| Body | 1rem | 400 | Buttons and results |
| Detail | 0.78–0.95rem | 400–800 | Metadata, captions, progress |

## 4. Spacing & Layout

Spacing uses a 4px base: 8px for compact gaps, 12–16px for controls and cards, 20–24px for grouped content, and 32px+ for panel rhythm. Content is centered at 960px; machine cards use a responsive grid that collapses to one readable column.

## 5. Components

### Casino button
- **Structure:** button or anchor using `.btn-casino`.
- **States:** default brass gradient, hover lift, disabled opacity, visible browser focus.
- **Motion:** 150ms transform and shadow transition.

### Slot machine
- **Structure:** machine head, three reels, payline, result, action.
- **States:** idle, spinning, complete, disabled.
- **Motion:** reels only translate; winning symbols gain a brass-red glow.

### Player win total
- **Structure:** labelled statistic panel with total and supporting detail.
- **States:** zero, updated, reduced-motion update.
- **Accessibility:** live announcement occurs through the individual result, while the total is readable at all times.

### Day-to-night transition
- **Structure:** full-screen sky, sun, horizon, stars, caption.
- **States:** hidden, active, reduced-motion.
- **Motion:** a horizontal sky sweep, sun descent, and star reveal; it contains no clock imagery.

## 6. Motion & Interaction

Micro interactions use 150ms ease-out. Slot reels use 120–380ms cubic-bezier `(0.15, 0.85, 0.25, 1)` transforms. The phase transition takes 2.8s with transform and opacity only: the daytime scene slides out, the sun descends, then stars fade up. This follows the beui loader pattern's reduced-motion treatment: reduced motion swaps movement for a calm opacity change.

## 7. Depth & Surface

Mixed depth: dark translucent panels sit over radial felt lighting; brass borders establish component edges; machines use layered gradients, inset highlights, and a broad shadow. The transition overlay replaces the scene completely to make the phase change feel environmental rather than like a page refresh.

## 8. Accessibility Constraints & Accepted Debt

WCAG 2.2 AA is the target. Keyboard-reachable controls retain native focus behavior, result text uses polite live regions, and `prefers-reduced-motion` removes non-essential motion. No accepted design debt.
