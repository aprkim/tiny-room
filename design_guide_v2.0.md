# DESIGN_GUIDE_v2.0

Version: 2.0
Last updated: 2026-02-09 4:15 PM

---

## Authority & Scope

This document defines **visual, interaction, and layout rules** for MiniChatCore-based apps.

### Authority Rule (Important)

When behavior or lifecycle rules conflict:

- **MINI_GUIDE defines system behavior and lifecycle semantics**
- **DESIGN_GUIDE defines visual presentation and interaction rules**

DESIGN_GUIDE must not override MiniChatCore lifecycle behavior.

---

## Lifecycle Model (Authoritative)

This guide follows the MiniChatCore lifecycle exactly:

```
PRE-LIVE → LIVE → PRE-LIVE / EXIT
```

### State Definitions

- **PRE-LIVE**
  - User is inside the room context
  - Camera and mic preview may be active
  - WebRTC is NOT connected
  - No media is transmitted

- **LIVE**
  - WebRTC is connected
  - Media is actively transmitted

- **EXIT**
  - User has fully left the room
  - Camera and mic are released
  - Tiles must be destroyed

> PRE-LIVE is NOT a lobby and NOT a partial join.

---

## Core Design Philosophy (from v2.0)

1. **Good defaults beat configuration** — if the user does nothing, the UI should still feel right.
2. **Visual fairness** — participants are equal unless explicitly designed otherwise.
3. **Space-aware layouts** — no cramped or floating tiles.
4. **Mobile-first, desktop-enhanced** — vertical clarity first, spatial balance later.
5. **Neutral first, accent second** — accents communicate meaning, not decoration.
6. **No emoji** — use inline SVG icons exclusively. Emoji are platform-inconsistent and not styleable.

---

## Color Theme & Tokens (Default: VibeLive Teal)

Default theme used unless overridden by product-specific theming.

- Accent: `#0EA5A4`
- Radius: `16px`
- Max content width: `980px`
- Font stack: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`

### Canonical CSS Variables

```css
:root {
  --radius: 16px;
  --max: 980px;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

  --bg: #f7f9f8;
  --card: #ffffff;
  --soft: #f0f4f3;
  --border: #e2e8f0;
  --borderSoft: #dbe2ea;

  --text: #1e293b;
  --muted: #64748b;
  --muted2: #9ca3af;

  --accent: #0EA5A4;
  --accentHover: #0d9488;
  --accentSoft: rgba(14,165,164,.10);
  --accentBorder: rgba(14,165,164,.35);

  --liveBg: #e8f4ed;
  --liveBorder: #a6c5a3;
  --liveText: #324252;

  --disabledBg: #f3f4f6;
  --disabledBorder: #e5e7eb;
  --disabledText: #6b7280;

  --dangerBg: #FEF2F2;
  --dangerBorder: #fca5a5;
  --dangerText: #b91c1c;

  --overlay: rgba(30, 41, 59, 0.5);
}
```

---

## Entry Flow

### Entry Screen (Required)

Use **two separated cards**:

#### Card Structure

```
┌─────────────────────────────┐
│  Name Card                  │
│  ┌───────────────────────┐  │
│  │ Your name             │  │
│  │ [___________________] │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Action Card                │
│                             │
│  [ + Start a Room ] (primary)│
│                             │
│  ────────── OR ──────────   │
│                             │
│  Join with room code        │
│  [_________] [ Join ]       │
│                             │
└─────────────────────────────┘
```

- **Name card**: Label + text input (max 24 chars), **autofocus on load** — typing your name is the default CTA
- **Action card**: Primary CTA, OR divider, then room code input + Join button side by side
- Both actions are **always visible** — no hiding/showing based on code input
- **Join row layout**: Room code input takes **75%**, Join button takes **25%** (`flex: 0 0 25%`)

#### Disabled Button Styling

- Disabled buttons appear at **full opacity** — no dimming, no grey overrides
- Only `cursor: not-allowed` is applied to indicate the disabled state
- Buttons retain their full color identity (accent for primary, soft for secondary) at all times
- This ensures the visual hierarchy and color cues are clear even before the user has typed a name

#### Name Validation Hint

- When a user clicks a disabled button without entering a name, show a **hint message** below the name input: "Please enter your name first"
- The hint uses `--dangerText` color and fades in/out
- The name input is auto-focused so the user can immediately start typing
- The hint disappears after 3 seconds or when the user starts typing

#### Button Loading Behavior

- **"Start a Room"** → shows spinner + "Creating..." while connecting (indicates room creation in progress)
- **"Join"** → label stays as **"Join"** while connecting (button is disabled only, no text change)

#### Dynamic Button Priority

- **No room code entered** → "Start a Room" = primary (accent color), "Join" = secondary
- **Room code entered** → "Join" = primary (accent color), "Start a Room" = secondary
- This guides users naturally toward the most relevant action

#### URL Deep Linking (`?code=`)

- Auto-fill room code from URL parameter
- Triggers dynamic priority swap → "Join" becomes primary

#### Shareable Invite Link

- Copy/share actions must produce a full URL with `?code=<roomCode>`, not the raw code alone
- This ensures recipients land directly into the join flow via deep linking

---

## Pre-Live Setup Screen (PRE-LIVE)

Purpose:
- Camera preview
- Mic / camera toggles
- Readiness confirmation

Rules:
- **Same topbar as live screen** — app name (left), room code + copy-code + copy-link buttons (right)
- Content below topbar is **vertically and horizontally centered**
- Camera preview uses **~70% of available space** — balanced size that avoids feeling cramped or overwhelming (e.g. use `min(70%, calc((100vh - offset) * 16/9 * 0.7))`)
- The content wrapper must use `align-self: stretch` so percentage-based widths resolve against the full viewport width
- Controls below preview
- **Go Live / Enter Room** is primary CTA, placed in an action row below controls
- **Back button** sits alongside "Go Live" in the same row — secondary styling (soft background, border), navigates back to the entry screen, exits the channel, and releases camera/mic preview
- No other participants visible
- Camera off → initials placeholder (stable tile size)
- **No drag/resize handles** — tile interaction controls (drag handle, resize handle) are hidden in pre-live; they only appear on live room tiles

---

## Video Tile Rules (Unified)

### Tile Anatomy (Camera Tiles)

Each **camera tile** contains:
- Video OR initials placeholder
- Name label (bottom-left) — local user shows **"Name (You)"** (e.g. "April (You)"), remote users show their display name
- Camera + mic indicators (**always visible**)
- **LIVE status badge** — shown on all tiles (local and remote) when the participant is live. Uses `--liveBg` / `--liveText` styling. Badge is hidden when the participant is not live.

Tiles never contain controls.

> **Screen share tiles** are an exception — they show content only (no name, no indicators, no badges). See [Screen Share Tile Semantics](#screen-share-tile-semantics).

### Initials Placeholder

When camera is off, show initials inside the placeholder:
- **Single name** (e.g. "April") → first letter only → **A**
- **Two or more names** (e.g. "April Kim") → first letter of first + last name → **AK**
- Empty/missing name → **?**

### Tile Sizing (Non-Negotiable)

- Size must be independent of camera state
- Use `::before` spacer (`padding-top: 56.25%`)
- Video and placeholder are absolute overlays
- **Hide browser-native video controls** — Chrome and Safari show play/pause overlays on `<video>` elements on hover. Suppress with `::-webkit-media-controls` pseudo-elements set to `display: none !important`

### Media Indicators

- Default state: cam OFF, mic OFF
- Icons required (no color-only meaning)
- **No emoji characters** — all icons must be inline SVG or icon font. Emoji rendering is inconsistent across platforms and does not meet design quality standards.

Indicator visibility must be **immediately obvious** at any tile size:
- ON → `--accent` icon color + accent-tinted background pill (`rgba(accent, .25)`)
- OFF → `--dangerText` icon color + danger-tinted background pill (`rgba(danger, .25)`)
- **On video tiles** (inside `.member-info`): indicators use **higher opacity backgrounds** (`rgba(accent, .7)` / `rgba(danger, .7)`) with white icon color to ensure visibility against any video content
- Do NOT rely on opacity alone to distinguish states — opacity differences are too subtle on dark backgrounds and at small sizes

---

## Tile Lifecycle Rules

- Create tile on room entry or member visibility
- **Remote tiles only appear when the participant is LIVE** — a participant in PRE-LIVE is not visible to others (no WebRTC connection, no media transmitted)
- **Do NOT remove tiles** on LIVE → PRE-LIVE
- Remove tiles only when displayStatus = **INACTIVE** or explicit exit

---

## Screen Share (Presentation Mode)

### Screen Share Priority

- Multiple participants may share their screen simultaneously
- All active screen shares are displayed **side by side** in the screenshare area
- On mobile (narrow viewports), multiple screenshares **stack vertically**
- Screen shares always occupy the primary visual surface above camera tiles

### Screen Share Layout Rules

- Each screen share creates a **separate tile** inside a shared `.screenshare-area` container
- Camera tiles always remain visible in the strip below
- Screen share tiles divide the available area equally (flexbox `flex: 1`)
- Each screen share must preserve its native aspect ratio
- Letterboxing is preferred over cropping
- Screen share tiles must never be visually smaller than participant camera tiles

### Participant Camera Strip

- Participant camera tiles are placed in a horizontal strip
- Default position: bottom
- Tiles are equal size
- Strip must not obscure critical screen content
- Strip may scroll horizontally if space is limited

### Screen Share Tile Semantics

- Screen share tiles:
  - Do NOT show name labels
  - Do NOT show mic/camera indicators
  - Do NOT show LIVE badges
- Screen share is content, not a participant

### Screen Share Transitions

- Entering or exiting screen share must use a smooth layout transition
- Avoid sudden jumps or full reflow
- Participant tile positions should remain stable where possible

Known SDK limitation: local self screenshare preview may appear black.

---

## Tile Layout Decision Model (Authoritative)

Tile layout selection must follow these steps **in order**.
Do not jump directly from tile count to grid.

### Step 1: Determine Context

Inputs:
- Visible tile count (exclude hidden / `display: none` tiles)
- Viewport width, height, and aspect ratio
- Screen type: desktop or mobile

### Step 2: Preserve Aspect Ratio (Hard Rule)

- All tiles must preserve **16:9**
- Cropping is allowed only as a last resort
- Letterboxing is preferred over distortion
- **Distortion is never allowed**

### Step 3: Choose Row-Based Layout First

Before using multi-row grids, attempt:
- Single-row layouts for 1–3 participants (desktop)
- Balanced row splits for odd counts (e.g. 3+2, 4+3)

### Step 4: Center the Group

- The entire tile group must be **visually centered**
- Empty space must be distributed symmetrically
- No top-left anchoring

### Step 5: Expand to Grid Only When Necessary

Use multi-row grids only when:
- A single row would reduce tiles below a comfortable size
- Or the viewport aspect ratio makes rows impractical

Tiles must always attempt to maximize usable screen space **without violating aspect ratio or visual balance**.

A layout that fills more space but feels cramped or uneven is considered incorrect.

### Space-Maximizing Principle

Single-participant and pre-live tiles must **fill the available viewport**, not use small fixed widths. Size the tile based on viewport height to maintain 16:9 without overflow:

```css
/* Example: solo tile fills available space */
width: min(100%, calc((100vh - chrome_offset) * 16 / 9));
```

Where `chrome_offset` accounts for topbar, controls bar, and padding. This ensures the tile is as large as possible regardless of screen size, and adapts correctly when the window resizes.

### Preferred Desktop Row Patterns

| Tile Count | Preferred Layout |
|-----------:|------------------|
| 1 | Single tile, centered |
| 2 | 1 row x 2 |
| 3 | 1 row x 3 (fallback: 2 + 1 centered) |
| 4 | 2 x 2 |
| 5 | 3 + 2 (centered) |
| 6 | 3 x 2 |
| 7 | 4 + 3 |
| 8 | 4 x 2 |

Notes:
- Row splits must be centered as a group
- Avoid single orphan tiles on their own row

### Three-Participant Layout Rule

Default behavior (desktop):
- Use a single-row layout (1 × 3)
- All tiles equal size
- Group centered

Fallback behavior:
- A 2 + 1 layout is permitted only when a single-row layout would reduce tiles below minimum readable size
- Fallback must preserve visual balance and must not imply hierarchy
- The single tile must be horizontally centered beneath the top row

### Mobile (<=640px)

- 2–3: vertical stack
- 4+: 2-column grid
- Remove column spanning

### Tile Layout Anti-Patterns (Do Not Implement)

- Jumping layout when a participant toggles camera
- Reordering tiles based on audio level
- Host tiles being larger by default
- Left-aligned grids with empty trailing space
- Shrinking all tiles to fit a new participant instantly

When implementing tile layout logic, **prioritize visual balance over mathematical simplicity**.

---

## Topbar (Consistent Across Screens)

PRE-LIVE and LIVE screens must share an **identical topbar**:

- **Left**: App name (e.g. "TinyRoom")
- **Right**: Room code (monospace, accent-colored pill) + copy-code button + copy-link button

This gives users persistent access to sharing tools and maintains visual continuity across state transitions. The topbar sits at the top edge, outside the centered content area.

### Copy Button Feedback

- When a copy button (copy-code or copy-link) is clicked, a **"Copied!" tooltip** appears directly below the button
- The tooltip fades in, stays for 1.5 seconds, then fades out
- Styled with inverted colors (`--text` background, `--bg` text) for contrast against the topbar
- No toast notification — feedback is localized to the button itself

---

## Controls Placement

Primary controls:
- Mic
- Camera
- Leave room

Secondary:
- Screen share
- Settings

Placement:
- Desktop: bottom center bar
- Mobile: floating bottom bar

Leave button must be visually separated (danger affordance).

### Leave Room Behavior

When the user leaves a room:
- Return to the **entry screen** (create/join), NOT the pre-live screen
- All video tiles must be destroyed
- Camera and mic preview must be released
- Room state is fully reset — the user can start or join a new room immediately

---

## Theme Mode: Light / Dark (User Choice)

Users must be able to choose between **Light mode** and **Dark mode**. The choice applies globally across entry, pre-live, and live room states.

### Principles

- **Dark mode is the default**
- Light mode is available as an equal, first-class option
- Mode switching must not affect layout, sizing, or behavior
- Only colors, shadows, and contrast change — **structure stays identical**

### Implementation Rules

- Use CSS variables for all colors (no hard-coded values)
- Theme switch is implemented by toggling a root attribute or class:
  - `data-theme="dark"` (default)
  - `data-theme="light"`
- All components must derive colors from semantic tokens (bg, card, text, accent, etc.)

### Dark Mode Token Guidance

Dark mode should:
- Reduce eye strain
- Preserve hierarchy and contrast
- Avoid pure black backgrounds

Recommended adjustments (example):

```css
[data-theme="dark"] {
  --bg: #0f172a;          /* deep slate */
  --card: #111827;        /* card surface */
  --soft: #1f2937;        /* subtle fill */
  --border: #273244;
  --borderSoft: #334155;

  --text: #e5e7eb;
  --muted: #9ca3af;
  --muted2: #6b7280;

  /* accent remains the same hue */
  --accent: #0EA5A4;
  --accentHover: #14b8a6;
  --accentSoft: rgba(14,165,164,.18);
  --accentBorder: rgba(14,165,164,.45);

  --liveBg: rgba(16,185,129,.15);
  --liveBorder: rgba(16,185,129,.4);
  --liveText: #a7f3d0;

  --dangerBg: rgba(239,68,68,.15);
  --dangerBorder: rgba(239,68,68,.4);
  --dangerText: #fca5a5;

  --overlay: rgba(0,0,0,0.6);
}
```

### UX Rules

- Theme choice must persist (localStorage or user preference)
- Theme toggle is placed in the **bottom-right corner** (fixed position, `z-index: 100`) — visible but unobtrusive across all screens
- Switching themes should be instant (no reload)
- Respect system preference on first visit (`prefers-color-scheme`)
- HTML root element must start with `data-theme="dark"` (dark is the default; JS upgrades to light if system preference or saved choice indicates light)

---

## Motion & Accessibility

Motion:
- Join / leave: soft scale + fade
- Layout reflow: smooth transitions
- Active speaker: subtle emphasis only

Accessibility:
- Never rely on color alone
- Respect reduced-motion
- Readable labels at small sizes
- Avoid flashing

---

## Summary

- MINI_GUIDE controls behavior
- DESIGN_GUIDE controls UI
- PRE-LIVE ≠ EXIT
- Tiles persist across LIVE ⇄ PRE-LIVE
- Media indicators always visible
- Screen share = separate tile
- Calm, human-first design

---

End of DESIGN_GUIDE_v2.3

