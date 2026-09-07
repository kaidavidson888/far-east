# Far East — logo system

The mark is a seal. A cinnabar square carrying 遠東 in outlined strokes, referencing the
chop that has signed Chinese documents, paintings and contracts for two thousand years.
The outline treatment is the modern move — it exposes the internal structure of the
characters instead of rendering them as solid blocks, which is what keeps the mark from
reading as a heritage pastiche.

All type in the delivered files is converted to outlines. No webfont is required to
render them, and nothing will shift if a font fails to load.

---

## Lockups

| File | Use |
|---|---|
| `far-east-logo-horizontal.svg` | Primary. Site header, dark backgrounds, email signatures. |
| `far-east-logo-horizontal-light.svg` | Same lockup with a black wordmark, for light surfaces. |
| `far-east-logo-stacked.svg` | Narrow contexts — mobile header, square ad units, merchandise. |
| `far-east-seal-panel.svg` | Hero and splash use only. A brand moment, not a logo. |
| `far-east-icon-512.svg` | App icon, social avatar, any square slot 64px and up. |
| `far-east-favicon-32.svg` | Browser tab and anything below 64px. Solid strokes, not outlined. |
| `far-east-favicon-16.svg` | 16px fallback. See "Small sizes" below. |
| `far-east-logo-mono-white.svg` | One colour, white. Photography, embossing, single-ink print. |
| `far-east-logo-mono-black.svg` | One colour, black. Faxes, stamps, light single-ink print. |

The horizontal lockup is the default. Reach for the stacked version only when horizontal
space genuinely runs out, not for variety.

---

## Clear space

Measure the height of the seal square. Call it **S**. Keep a margin of **S ÷ 4** clear on
all four sides of the lockup — no type, no rules, no photographic detail, no other logo.

At the delivered artboard size (S = 240) that is 60 units. The rule scales with the mark,
so it holds at every size.

The seal square's own internal padding is already correct. Do not add a second border
around it or set it inside another box.

---

## Minimum sizes

| Asset | Screen minimum | Print minimum |
|---|---|---|
| Horizontal lockup | 140px wide | 32mm wide |
| Stacked lockup | 96px wide | 22mm wide |
| Icon (outlined) | 64px | 16mm |
| Favicon (solid) | 24px | not for print |

**Small sizes.** The outlined characters close up and turn to mush below roughly 64px —
this was tested, not assumed. Below that threshold, switch to `far-east-favicon-32.svg`,
which uses solid strokes.

At 16px even the solid characters stop resolving. `far-east-favicon-16.svg` falls back to
**FE** in the wordmark type. This is a deliberate call: an illegible 16px glyph is worse
than a legible Latin abbreviation. Ship both and let the browser pick.

---

## Colour

| Token | Hex | Notes |
|---|---|---|
| `cinnabar` | `#C1272D` | 朱砂. The seal field. The single brand colour. |
| `cobalt` | `#1B4D8F` | 青花, the blue of blue-and-white porcelain. Accent rule only. |
| `indigo` | `#12335E` | Supporting depth. Section backgrounds, hover states. Not in the mark. |
| `canvas` | `#000000` | Page floor. |
| `ink` | `#FFFFFF` | Primary text and glyph strokes. |
| `body` | `#BBBBBB` | Secondary text. |
| `hairline` | `#3C3C3C` | Dividers and card borders. |
| `surface` | `#1A1A1A` | Card fill. |

Cinnabar and cobalt are a historical pairing — the two pigments turn up together
constantly in Chinese decorative arts, which is why the combination feels found rather
than art-directed.

**Radius is 0 everywhere.** Sharp rectangles only. The one exception in the system would
be a circular icon button, and the logo never sits inside one.

---

## Typography

**Exo 2** for all Latin text. The wordmark is Exo 2 ExtraBold (800), uppercase, tracked at
0.16em. Do not re-typeset it — use the supplied outlines, since the tracking and optical
left alignment are baked in.

**Noto Serif CJK TC Bold** for Chinese text in body copy and headings, which matches the
characters in the mark. If you need a lighter weight for long-form Chinese text, drop to
Regular rather than switching families.

Pair heavy display with light body. Keep body copy at 300.

---

## Do

- Put the mark on black, white, or a flat cinnabar field. Those three are the system.
- Use the cobalt rule as an accent under the wordmark or as a section divider.
- Let the seal panel carry a hero on its own. It does not need supporting graphics.
- Use the mono files when printing in one ink, rather than screening the cinnabar.

## Don't

- Don't recolour the characters. They are white on cinnabar, or single-ink. Never blue,
  never gradient, never split across two colours.
- Don't rotate, skew, or arch the mark.
- Don't set the seal on a busy photograph. If it must go over an image, use the mono
  white lockup on a darkened area.
- Don't add a drop shadow, glow, or outer stroke to the seal square.
- Don't stretch the lockup. Scale proportionally or use the stacked file.
- Don't place the mark on a red that isn't `#C1272D`. Two near-identical reds fighting
  each other is the most common way this system will get broken.

---

## Known gaps

- **The characters are Noto Serif CJK TC, converted to outlines.** They are not custom
  drawn. For a finished identity, a type designer should redraw 遠 in particular — the
  辶 radical carries a lot of visual weight on the lower left and could be tightened to
  balance better against 東.
- **No animated variant.** If you want the seal to stamp or the strokes to draw on,
  that needs to be authored against these paths.
- **PNG and ICO exports are not included.** Generate them from the SVGs at the sizes your
  hosting needs; the vectors are the source of truth.
- **Trademark clearance has not been done.** "Far East" is a common phrase and there are
  existing marks using 遠東 — Far Eastern Group in Taiwan is the obvious one. Worth a
  search before you commit to signage or filings.
