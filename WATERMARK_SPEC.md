# Watermark Design Handoff — for VibeLive SDK (server-injected)

**From:** TinyRoom (room.tinywins.space)
**Re:** Restyle the SDK-injected `.makedo-watermark` element

The watermark is injected by the SDK onto each registered tile. Below is the
design we'd like, plus one behavior request. Since it's server/SDK-side, the
change needs to happen in the SDK injection — TinyRoom can't change it cleanly
from the client (inline styles require `!important` overrides, which is fragile).

---

## 1. Watermark markup + styles (glass pill)

```html
<div class="makedo-watermark" style="
    position: absolute;
    top: 8px;
    left: 8px;
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.92);
    background: rgba(15, 23, 41, 0.65);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 3px 8px;
    border-radius: 999px;
    border: 0.5px solid rgba(255, 255, 255, 0.12);
    letter-spacing: 0.2px;
    pointer-events: none;
    z-index: 10;
">
    Powered by&nbsp;<span style="color: #5DCAA5; font-weight: 500;">VibeLive</span>
</div>
```

**Key design choices:**
- Frosted-glass pill (`backdrop-filter: blur(10px)`) over a dark navy tint —
  stays legible on dark, light, busy, and photo backgrounds.
- Brand word "VibeLive" in teal `#5DCAA5`, medium weight; "Powered by" in white 0.92.
- Hairline border (`0.5px`) for a crisp edge.
- `pointer-events: none` so it never blocks tile interaction.

---

## 2. Behavior request — hide on small camera-strip tiles

In presentation mode (someone sharing screen), camera tiles shrink into a small
horizontal strip. At that size the pill covers a big chunk of the tile and looks
cluttered — especially on mobile.

**Request:** suppress the watermark on small/secondary tiles, keep it on the
dominant tile.

Suggested rule:
- **Screenshare tile** (large, primary surface) → **show** watermark.
- **Camera tiles in the strip** (small, secondary) → **hide** watermark.
- **Normal grid mode** (no screen share) → show on all tiles (they're large enough).

If the SDK can expose a size threshold or a "primary vs secondary tile" flag,
that'd let it decide automatically. Otherwise, a per-tile opt-out at
`registerTile()` time would work, e.g.:

```js
VibeLive.registerTile(memberId, 'camera', el, { watermark: false });
```

---

## 3. Live preview (built in TinyRoom)

- Small tiles (presentation mode): https://room.tinywins.space/watermark-v2-small.html

---

## 4. Open question on branding terms

Is it acceptable to suppress the watermark on the small strip tiles as long as it
stays clearly visible on the dominant screenshare tile (and on all tiles in normal
grid mode)? Want to confirm this respects VibeLive's branding requirements before
shipping.
