---
colors:
  # brand
  cinnabar: "#c1272d"
  cinnabar-deep: "#96181f"
  cinnabar-soft: "#f5e3e2"
  cobalt: "#1b4d8f"
  cobalt-soft: "#e4ebf4"
  indigo: "#12335e"

  # dark mode surfaces
  canvas-dark: "#0d0d0d"
  surface-dark: "#171717"
  elevated-dark: "#222222"
  hairline-dark: "#333333"
  hairline-dark-strong: "#4a4a4a"

  # light mode surfaces
  canvas-light: "#f7f4ef"
  surface-light: "#ffffff"
  elevated-light: "#fffdfa"
  hairline-light: "#e2dcd2"
  hairline-light-strong: "#c9c1b4"

  # dark mode text
  ink-dark: "#ffffff"
  body-dark: "#c4c0ba"
  muted-dark: "#8a857e"
  disabled-dark: "#5a5652"

  # light mode text
  ink-light: "#14120f"
  body-light: "#4a4742"
  muted-light: "#857f76"
  disabled-light: "#b0aaa1"

  # semantic
  positive: "#1f7a4c"
  positive-soft: "#e3f0e8"
  caution: "#b5871b"
  caution-soft: "#f7eed9"
  negative: "#6b6560"
  negative-soft: "#eae7e3"

  # inverse
  on-cinnabar: "#ffffff"
  on-cobalt: "#ffffff"
  on-light: "#14120f"
  on-dark: "#ffffff"

typography:
  display-xl:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 72px
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: -0.5px
  display-lg:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 52px
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: -0.3px
  display-md:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 38px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: -0.2px
  display-sm:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0
  score-display:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 56px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -1px
  title-lg:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  title-md:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  label-uppercase:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 1.5px
  body-lg:
    fontFamily: "Noto Serif, serif"
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-md:
    fontFamily: "Noto Serif, serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0
  body-sm:
    fontFamily: "Noto Serif, serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  ui-md:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.3px
  spec-value:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.2px
  button:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 1.5px
  nav-link:
    fontFamily: "Exo 2, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.5px
  cjk-display:
    fontFamily: "Noto Serif CJK TC, serif"
    fontSize: 38px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.05em
  cjk-body:
    fontFamily: "Noto Serif CJK TC, serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: 0.02em

rounded:
  none: 0px
  xs: 2px
  sm: 4px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  section: 96px

components:
  top-nav:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.none}"
    height: 68px
  seal-divider:
    backgroundColor: transparent
    height: 5px
  button-primary:
    backgroundColor: "{colors.cinnabar}"
    textColor: "{colors.on-cinnabar}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 16px 32px
    height: 48px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.ink-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 16px 32px
    height: 48px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.body-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: 12px 16px
    height: 40px
  button-icon:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.full}"
    size: 44px
  text-link:
    backgroundColor: transparent
    textColor: "{colors.cinnabar}"
    typography: "{typography.label-uppercase}"
  score-seal:
    backgroundColor: "{colors.cinnabar}"
    textColor: "{colors.on-cinnabar}"
    typography: "{typography.score-display}"
    rounded: "{rounded.none}"
    size: 96px
  award-seal:
    backgroundColor: "{colors.cinnabar}"
    textColor: "{colors.on-cinnabar}"
    typography: "{typography.label-uppercase}"
    rounded: "{rounded.none}"
    size: 120px
  verdict-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.none}"
    padding: 40px
  pros-cons-list:
    backgroundColor: transparent
    textColor: "{colors.body-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 0
  criteria-bar:
    backgroundColor: "{colors.hairline-dark}"
    fillColor: "{colors.cobalt}"
    typography: "{typography.label-uppercase}"
    rounded: "{rounded.none}"
    height: 6px
  review-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.title-lg}"
    rounded: "{rounded.none}"
    padding: 24px
  product-hero:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.none}"
    padding: 64px
  spec-cell:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.spec-value}"
    rounded: "{rounded.none}"
    padding: 24px
  comparison-table:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.body-dark}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.none}"
    padding: 16px
  price-row:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.none}"
    padding: 16px 24px
    height: 64px
  affiliate-disclosure:
    backgroundColor: "{colors.elevated-dark}"
    textColor: "{colors.muted-dark}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    padding: 12px 16px
  tested-stamp:
    backgroundColor: transparent
    textColor: "{colors.muted-dark}"
    typography: "{typography.label-uppercase}"
    rounded: "{rounded.none}"
  author-byline:
    backgroundColor: transparent
    textColor: "{colors.body-dark}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
  pull-quote:
    backgroundColor: transparent
    textColor: "{colors.ink-dark}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.none}"
    padding: 40px 0
  category-tab:
    backgroundColor: transparent
    textColor: "{colors.body-dark}"
    typography: "{typography.label-uppercase}"
    rounded: "{rounded.none}"
    padding: 14px 0
  category-tab-active:
    backgroundColor: transparent
    textColor: "{colors.ink-dark}"
    typography: "{typography.label-uppercase}"
    rounded: "{rounded.none}"
    padding: 14px 0
  filter-chip:
    backgroundColor: transparent
    textColor: "{colors.body-dark}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    padding: 8px 14px
    height: 34px
  text-input:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.none}"
    padding: 12px 16px
    height: 48px
  select:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.none}"
    padding: 12px 16px
    height: 48px
  newsletter-band:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-md}"
    rounded: "{rounded.none}"
    padding: 64px
  surface-toggle:
    backgroundColor: transparent
    textColor: "{colors.body-dark}"
    rounded: "{rounded.full}"
    size: 36px
  footer:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.muted-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: 64px
---

## Overview

Far East is a product review site, and the entire system is organised around one idea: **the
seal is a verdict**. The logo is a chop — the stamp that has signed Chinese documents and
paintings for two thousand years — and a review site is fundamentally in the business of
stamping things. That link is not decoration; it is the reason the identity works here, and
it is what `{component.score-seal}` and `{component.award-seal}` exist to exploit.

The surface language is inherited from a black-canvas, zero-radius, uppercase-label
tradition: sharp rectangles, hairline dividers, letterspaced all-caps labels, no gradients,
no drop shadows. What is different is that a review site has to be **readable for fifteen
minutes at a time**, so long-form body copy runs in a serif (Noto Serif) rather than the
display sans, and the system ships **two surface modes** rather than one.

Cinnabar (`{colors.cinnabar}` — #c1272d) is the only brand colour. Cobalt
(`{colors.cobalt}` — #1b4d8f) is a single accent used for data — criteria bars, chart fills,
the wordmark rule. Everything else is neutral. A review site that colours its interface
loses the ability to make a colour mean something, and here cinnabar means *we have judged
this*.

**Key Characteristics:**
- Two full surface modes. Dark (`{colors.canvas-dark}`) is the default for the homepage,
  category browsing, and product heroes. Light (`{colors.canvas-light}` — a warm paper
  ivory, not white) is the default for article bodies and long reviews.
- Cinnabar is reserved for the mark, the score seal, primary CTAs, and inline links.
  Never for backgrounds, never for warnings or errors.
- **Red is not an error colour in this system.** Because cinnabar carries brand meaning,
  negative states use `{colors.negative}` (a desaturated warm gray), not red. This is the
  single most important deviation from a conventional palette.
- Border radius is 0 everywhere except circular icon buttons. The sharp square of the seal
  is the shape language of the whole system.
- Display type is Exo 2 at 700/800 with slight negative tracking. Body type is Noto Serif
  at 400. Labels are uppercase Exo 2 at 1.5px tracking.
- Scores are never traffic-lit. A 3/10 and a 9/10 render in the same cinnabar seal — the
  number carries the judgement, not the colour.
- Spacing is grid-aligned on a 4px base, with `{spacing.section}` (96px) between major bands.

## Colors

### Brand & Accent
- **Cinnabar** (`{colors.cinnabar}` — #c1272d): 朱砂, the pigment in seal ink and on temple
  doors. The seal field, primary CTA fill, inline link colour, and score seal. This is the
  brand.
- **Cinnabar Deep** (`{colors.cinnabar-deep}` — #96181f): Pressed and active states on
  cinnabar surfaces. Also the cinnabar substitute on light mode when a large field would
  be too loud.
- **Cinnabar Soft** (`{colors.cinnabar-soft}` — #f5e3e2): Light-mode tint for highlighted
  table rows and "editor's pick" row backgrounds. Never used in dark mode.
- **Cobalt** (`{colors.cobalt}` — #1b4d8f): 青花, the blue of blue-and-white porcelain.
  Data only — criteria bars, chart fills, the rule under the wordmark. Never a CTA.
- **Cobalt Soft** (`{colors.cobalt-soft}` — #e4ebf4): Light-mode chart backgrounds and
  unfilled bar tracks.
- **Indigo** (`{colors.indigo}` — #12335e): A deeper supporting tone. Newsletter band,
  full-width interstitials, and the one place the system uses a coloured section background.

### Surface — Dark Mode
- **Canvas Dark** (`{colors.canvas-dark}` — #0d0d0d): Page floor. Marginally off-black
  rather than #000, because long reading against pure black causes halation on OLED.
- **Surface Dark** (`{colors.surface-dark}` — #171717): Cards, verdict blocks, spec cells,
  inputs.
- **Elevated Dark** (`{colors.elevated-dark}` — #222222): Nested cards, disclosure strips,
  dropdown panels.

### Surface — Light Mode
- **Canvas Light** (`{colors.canvas-light}` — #f7f4ef): Page floor. A warm ivory that reads
  as paper. Deliberately not #ffffff — cinnabar on pure white goes shrill, and on ivory it
  sits the way seal ink sits on rice paper.
- **Surface Light** (`{colors.surface-light}` — #ffffff): Cards and raised content. In light
  mode the *card* is the white and the *page* is the ivory, which is the inverse of the
  usual arrangement.
- **Elevated Light** (`{colors.elevated-light}` — #fffdfa): Nested cards and popovers.

### Hairlines & Borders
- **Hairline Dark** (`{colors.hairline-dark}` — #333333) / **Hairline Light**
  (`{colors.hairline-light}` — #e2dcd2): The 1px divider on each surface. Used between
  sections, table rows, and around card outlines.
- **Hairline Strong** (`{colors.hairline-dark-strong}` — #4a4a4a /
  `{colors.hairline-light-strong}` — #c9c1b4): Emphasised dividers, input borders on focus,
  table header underlines.

### Text
- **Ink** (`{colors.ink-dark}` — #ffffff / `{colors.ink-light}` — #14120f): Headlines and
  primary text. Light-mode ink is a warm near-black, not #000, to match the ivory canvas.
- **Body** (`{colors.body-dark}` — #c4c0ba / `{colors.body-light}` — #4a4742): Running text.
  Both carry a slight warm cast so serif body copy doesn't read as cold against cinnabar.
- **Muted** (`{colors.muted-dark}` — #8a857e / `{colors.muted-light}` — #857f76): Captions,
  bylines, timestamps, footer links, disclosure text.
- **Disabled** (`{colors.disabled-dark}` — #5a5652 / `{colors.disabled-light}` — #b0aaa1).

### Semantic
- **Positive** (`{colors.positive}` — #1f7a4c): Pros list markers, "in stock", "recommended"
  chips, passing test results.
- **Caution** (`{colors.caution}` — #b5871b): Caveats, "tested on pre-release firmware",
  price-volatility notes.
- **Negative** (`{colors.negative}` — #6b6560): Cons list markers, failing test results,
  "not recommended". **Deliberately gray, not red.** Cinnabar owns red in this system; a red
  con-marker sitting next to a cinnabar score seal makes the score look like a warning.
- Each has a `-soft` tint for light-mode chip backgrounds. Dark mode uses the base colour
  at 12% opacity over `{colors.surface-dark}` rather than a separate token.

### Scoring
Scores are **not** colour-coded. There is no green-to-red gradient across the 1–10 range.
Every `{component.score-seal}` renders in cinnabar regardless of the number it carries. The
reasoning: a review site's credibility rests on the reader trusting the number, and a
colour-coded score tells them how to feel before they have read the verdict. Let the number
speak.

`{component.criteria-bar}` fills in cobalt at every value for the same reason.

## Typography

### Font Family
Three families, each with a job.

- **Exo 2** — display, navigation, labels, buttons, scores, UI. The wordmark in the logo is
  Exo 2 ExtraBold, so this is the family that ties the interface to the mark. Weights used:
  800 (display), 700 (titles, labels, buttons), 600 (sub-titles), 500 (nav), 400 (UI text).
- **Noto Serif** — all long-form body copy. Reviews are long, and a geometric sans at 17px
  for 2,000 words is fatiguing. The serif also echoes the Ming-serif construction of 遠東
  in the logo, so the pairing has a reason beyond readability.
- **Noto Serif CJK TC** — Chinese text anywhere on the site, and the source of the logo
  characters. Sits at the same optical weight as Noto Serif, so mixed-script paragraphs
  don't fracture.
- **JetBrains Mono** — spec values, measured results, dimensions, prices in comparison
  tables. Monospace figures align in columns, which is the entire point.

Fallback stack for Exo 2: `"Exo 2", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
Fallback for Noto Serif: `"Noto Serif", Georgia, "Times New Roman", serif`.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 72px | 800 | 1.02 | -0.5px | Homepage hero, category landing h1 |
| `{typography.display-lg}` | 52px | 800 | 1.06 | -0.3px | Review headline, section heads |
| `{typography.display-md}` | 38px | 700 | 1.12 | -0.2px | Sub-section heads, newsletter band |
| `{typography.display-sm}` | 28px | 700 | 1.2 | 0 | Pull quotes, CTA band heads |
| `{typography.score-display}` | 56px | 800 | 1.0 | -1px | The numeral inside `{component.score-seal}` |
| `{typography.title-lg}` | 22px | 700 | 1.3 | 0 | Review card titles, verdict heading |
| `{typography.title-md}` | 19px | 600 | 1.4 | 0 | Card sub-titles, spec group heads |
| `{typography.title-sm}` | 17px | 600 | 1.4 | 0 | Price row product names, list headers |
| `{typography.label-uppercase}` | 13px | 700 | 1.3 | 1.5px | Category tabs, "TESTED", inline links |
| `{typography.body-lg}` | 19px | 400 | 1.7 | 0 | Verdict paragraph, article lead |
| `{typography.body-md}` | 17px | 400 | 1.65 | 0 | Default review body — Noto Serif |
| `{typography.body-sm}` | 15px | 400 | 1.6 | 0 | Footnotes, footer body, methodology |
| `{typography.ui-md}` | 15px | 400 | 1.5 | 0 | Inputs, dropdowns, table cells — Exo 2 |
| `{typography.caption}` | 13px | 400 | 1.4 | 0.3px | Photo captions, bylines, disclosures |
| `{typography.spec-value}` | 18px | 500 | 1.3 | -0.2px | Measured values — JetBrains Mono |
| `{typography.button}` | 14px | 700 | 1.0 | 1.5px | All button labels — uppercase |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0.5px | Top-nav menu items |
| `{typography.cjk-display}` | 38px | 700 | 1.3 | 0.05em | Chinese headings |
| `{typography.cjk-body}` | 17px | 400 | 1.9 | 0.02em | Chinese body — note the taller leading |

### Principles
Display type carries **negative tracking**; label type carries **positive tracking**. Exo 2
is slightly wide by default, so headlines need to be pulled in at large sizes, while
uppercase labels need to be opened up to read as machined rather than jammed.

Headlines are **sentence case**, not uppercase. This is a departure worth stating: an
all-caps display voice reads as promotional, and a review site's headline is usually a
factual claim ("The Anker 737 is still the one to buy"). Uppercase is reserved for
`{typography.label-uppercase}` and `{typography.button}`.

Chinese body copy takes 1.9 line-height, meaningfully looser than the Latin 1.65. CJK
glyphs have no ascenders or descenders to create visual gaps between lines, so they need
the extra leading to breathe.

### Note on Font Substitutes
If Exo 2 is unavailable, **Saira** is the closest open substitute at the same widths.
**Inter** works but is noticeably more neutral — you lose the slight technical character
that makes the wordmark distinctive. For the serif, **Source Serif 4** substitutes cleanly
for Noto Serif; **Lora** is warmer if the reviews skew lifestyle rather than technical.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px ·
  `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 40px · `{spacing.xxl}` 64px ·
  `{spacing.section}` 96px.
- **Section padding (vertical):** `{spacing.section}` (96px) between major bands.
- **Article rhythm:** `{spacing.xl}` (40px) between body sections inside a review;
  `{spacing.lg}` (24px) between paragraph and following subhead.
- **Card internal padding:** `{spacing.lg}` (24px) for review cards; `{spacing.xl}` (40px)
  for `{component.verdict-card}`, which needs to feel like a distinct object.
- **Gutters:** `{spacing.lg}` (24px) in card grids; `{spacing.md}` (16px) in spec tables.

### Grid & Container
- **Max content width:** 1280px for browse and comparison pages.
- **Article measure:** 680px for review body copy. Non-negotiable — a 1280px-wide serif
  paragraph is unreadable, and long reviews are the product.
- **Full-bleed exceptions:** product hero photography, comparison tables, and the newsletter
  band break the measure and run to 1280px or edge-to-edge.
- **Card grids:** 3-up desktop, 2-up tablet, 1-up mobile.
- **Sidebar:** on review pages, a 300px sticky rail holds `{component.score-seal}`,
  `{component.price-row}` stack, and jump links. Collapses above the article body on mobile.

### Whitespace Philosophy
The system trusts the measure. Because body copy is constrained to 680px on a 1280px page,
there is a large quiet margin on either side of every review — that margin is the
whitespace strategy, and it should not be filled with floating callouts, share widgets, or
related-article rails on desktop. Put those below the article.

Between bands, whitespace is uniform `{spacing.section}`. No atmospheric backdrops, no
gradients, no decorative shapes in empty space.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No border, no shadow | Body sections, nav, footer, article text |
| Hairline | 1px `{colors.hairline-dark}` / `{colors.hairline-light}` | Dividers, table rows, card outlines |
| Card | `{colors.surface-dark}` / `{colors.surface-light}` fill, no shadow | Review cards, verdict block, spec cells |
| Elevated | `{colors.elevated-dark}` / `{colors.elevated-light}` fill | Nested cards, dropdowns, popovers |
| Seal | Cinnabar fill | Score seal, award seal, primary CTA — the only saturated surface |

No drop shadows anywhere. Depth is carried by surface value steps and hairlines. The one
exception is a focus ring, which is a 2px `{colors.cobalt}` outline offset 2px — functional,
not decorative.

### Decorative Depth
- **Seal Divider** (`{component.seal-divider}`): A 5px horizontal rule split into two
  segments — `{colors.cobalt}` then `{colors.cinnabar}`, equal widths. Used under the
  wordmark, between major editorial bands, and beneath active category tabs. This is the
  system's only decorative element. Two bars, not three.
- **Paper texture (light mode only):** an optional 2% noise overlay on
  `{colors.canvas-light}`. Reinforces the paper reading; must never appear in dark mode,
  where it turns to visible grain.
- **Photography:** product shots on a flat neutral ground, shot consistently. Depth on this
  site comes from the products, not from chrome.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Everything — buttons, cards, inputs, seals, images, chips |
| `{rounded.xs}` | 2px | Reserved. Currently unused. |
| `{rounded.sm}` | 4px | Inline code spans and keyboard glyphs only |
| `{rounded.full}` | 9999px | Circular icon buttons, author avatars, the surface toggle |

The rule is binary: square or circle, nothing between. This comes directly from the logo —
the seal is a hard square, and softening the interface's corners would make the mark look
like a foreign object on its own site.

### Photography Geometry
Product photography is square (1:1) in card grids and 3:2 in review heroes, always with
sharp corners. Comparison shots use a consistent 4:3 crop so products can be visually
sized against each other. Author avatars are the one circular image. Gallery thumbnails are
64px squares with a 2px cinnabar outline on the active item.

## Surface Modes

The system ships two complete modes. This is not a preference toggle bolted on at the end —
each mode has a default context.

**Dark is default for:** homepage, category browse, comparison tables, product heroes,
anything image-led. Product photography sits better on dark, and browse pages are scanned
rather than read.

**Light is default for:** review article bodies, buying guides, methodology pages, about
and policy pages. Anything over roughly 800 words.

**`{component.surface-toggle}`** lets the reader override, and the choice persists. When a
reader lands on an article from a dark browse page, the transition is expected — the
article surface is a signal that they have moved from browsing to reading.

Rules that hold across both modes:
- Cinnabar does not change hex between modes. `{colors.cinnabar-deep}` is used for large
  cinnabar fields in light mode only if the standard value proves too loud in testing.
- Hairlines swap; surfaces swap; ink swaps. Semantic colours keep their hue and swap only
  their tint pairing.
- The logo swaps file, not colour — `far-east-logo-horizontal.svg` on dark,
  `far-east-logo-horizontal-light.svg` on light. The seal stays cinnabar in both.

## Components

### Navigation

**`top-nav`** — 68px, `{colors.canvas-dark}`, pinned. Carries the horizontal logo lockup at
left, primary menu (Reviews, Buying guides, How we test, Deals) in
`{typography.nav-link}`, and a right cluster with search, the surface toggle, and account.
Sits above a `{component.seal-divider}`.

**`category-tab`** / **`category-tab-active`** — Text-only labels in
`{typography.label-uppercase}`. Active state changes ink from `{colors.body-dark}` to
`{colors.ink-dark}` and places a 3px cinnabar underline beneath. No fill, no radius.

**`filter-chip`** — 34px, transparent with a 1px hairline border,
`{typography.caption}`. Selected state inverts to `{colors.ink-dark}` fill with
`{colors.canvas-dark}` text. Square corners — chips are the most common place designers
reach for pills, and this system does not.

### Buttons

**`button-primary`** — Cinnabar fill, white uppercase label, 0px radius, 48px tall,
16×32px padding. Used for "Check price", "Read the full review", newsletter submit. One
per view. Pressed state fills `{colors.cinnabar-deep}`.

**`button-secondary`** — Transparent with a 1px `{colors.ink-dark}` border, same geometry.
The default button. Used for everything that is not the single primary action.

**`button-ghost`** — No border, no fill, `{colors.body-dark}` label at 40px. Table row
actions, "show more specs", dismissals.

**`button-icon`** — 44px circle, `{colors.surface-dark}` fill. Gallery arrows, share,
bookmark. The only circular control.

**`text-link`** — Inline links in body copy render in `{colors.cinnabar}` with a 1px
underline at 0.15em offset. Navigational links in chrome use
`{typography.label-uppercase}` with a trailing → and no underline.

### Verdict & Scoring

**`score-seal`** — The system's signature component. A 96px cinnabar square carrying the
score in `{typography.score-display}` white, with a small "/10" in
`{typography.label-uppercase}` beneath the numeral. Sits at the top of the sticky sidebar
and repeats in `{component.review-card}` at 56px. Always square, always cinnabar, never
colour-graded to the score value.

**`award-seal`** — Reserved for top picks. The full 遠東 chop from the logo system at 120px,
with "SEAL OF APPROVAL" set in `{typography.label-uppercase}` beneath it. This is the only
place the logo mark is used as a content element rather than as site identity, and that
restriction is what gives it weight. Awarding it to more than roughly one product per
category per year devalues it.

**`verdict-card`** — `{colors.surface-dark}` fill, 40px padding, no radius. Holds the
verdict heading in `{typography.title-lg}`, two or three paragraphs in
`{typography.body-lg}`, and the `{component.pros-cons-list}` in two columns beneath. Appears
once, immediately after the article lead, so a reader who wants only the conclusion can
stop there.

**`pros-cons-list`** — Two columns, no card fill. Pros marked with a `{colors.positive}`
square bullet; cons with a `{colors.negative}` square bullet. Square bullets, not
checkmarks and crosses — icons imply a verdict the text should be making.

**`criteria-bar`** — 6px track in `{colors.hairline-dark}`, fill in `{colors.cobalt}`, 0px
radius. Label above in `{typography.label-uppercase}`, value at right in
`{typography.spec-value}`. Used for the sub-score breakdown (build, battery, value, and so
on). Never coloured by value.

### Content Cards

**`review-card`** — Grid item. `{colors.surface-dark}` fill, 24px padding, square product
image at top, product name in `{typography.title-lg}`, one-line summary in
`{typography.body-sm}`, and a 56px `{component.score-seal}` overlapping the image's bottom-
left corner by 16px. The overlap is deliberate and is the card's identifying feature.

**`product-hero`** — Full-bleed band, 64px vertical padding. Product photography at 3:2
alongside the review headline in `{typography.display-lg}`,
`{component.author-byline}`, and `{component.tested-stamp}`.

**`pull-quote`** — No card, no rule box. `{typography.display-sm}`, 40px vertical padding,
indented to the article measure with a 3px cinnabar rule on the left edge. Because it uses
a single-sided border, radius stays 0.

**`buying-guide-card`** — A wider variant of `{component.review-card}` used in guide
listings. Horizontal layout: 4:3 image left, content right, `{component.score-seal}` at
top right of the content column.

### Data & Specs

**`spec-cell`** — `{colors.surface-dark}`, 24px padding, 0px radius. Value on top in
`{typography.spec-value}` (monospace), label beneath in `{typography.label-uppercase}`.
Grids 4-up on desktop.

**`comparison-table`** — Full-width, hairline row dividers, no vertical rules, no zebra
striping. Numeric columns right-aligned in `{typography.spec-value}`; text columns left-
aligned in `{typography.ui-md}`. The recommended row gets a `{colors.cinnabar-soft}`
background in light mode, or a 3px cinnabar left border in dark mode. Sticky header row and
sticky first column on scroll.

**`price-row`** — 64px, `{colors.surface-dark}`, 16×24px padding. Retailer name at left,
price in `{typography.spec-value}`, `{component.button-secondary}` at right. Stacks in the
sticky sidebar. Prices carry a "checked [date]" note in `{typography.caption}`.

### Trust & Provenance

These components exist because a review site's asset is credibility, and credibility is a
design problem as much as an editorial one.

**`affiliate-disclosure`** — `{colors.elevated-dark}`, 12×16px padding,
`{typography.caption}` in `{colors.muted-dark}`. Sits directly beneath the byline, above the
fold. Never in the footer, never collapsed behind a toggle.

**`tested-stamp`** — `{typography.label-uppercase}` in `{colors.muted-dark}`, reading
"TESTED 14 DAYS · MARCH 2026" or "NOT TESTED — HANDS-ON ONLY". The negative case must be as
prominent as the positive one.

**`author-byline`** — Circular 40px avatar, author name in `{typography.title-sm}`, role and
date in `{typography.caption}`. Links to a bio page listing what that reviewer covers.

### Inputs & Forms

**`text-input`** — 48px, `{colors.surface-dark}`, 1px hairline border, 0px radius, 12×16px
padding. Focus adds a 2px `{colors.cobalt}` ring at 2px offset and thickens the border to
`{colors.hairline-dark-strong}`.

**`select`** — Same geometry as `{component.text-input}` with a chevron at right. Used for
sort order and comparison pickers.

**`newsletter-band`** — `{colors.indigo}` full-width band, 64px padding, heading in
`{typography.display-md}`, single email input plus `{component.button-primary}`. The only
coloured section background in the system.

### Footer

**`footer`** — `{colors.canvas-dark}` in both modes; the footer does not invert. 64px
vertical padding, 4-column link list (Reviews / Guides / About / Legal), the stacked logo
lockup, and a bottom row carrying the affiliate disclosure statement and the editorial
independence link in `{typography.body-sm}`.

## Do's and Don'ts

### Do
- Use cinnabar to mean *judged*: the seal, the score, the primary action, inline links.
- Keep review body copy at the 680px measure regardless of viewport width.
- Set headlines in sentence case. Reserve uppercase for labels and buttons.
- Put `{component.verdict-card}` above the fold of the article body. Readers who want the
  answer should not have to scroll for it.
- Show `{component.tested-stamp}` on every review, including when the answer is "we didn't
  test this."
- Use `{rounded.none}` by default. Circles only for icon buttons and avatars.
- Let the serif body and the sans display stay in their lanes.

### Don't
- Don't colour-code scores. No green 9s, no red 3s. The seal is always cinnabar.
- Don't use red for errors, warnings, or cons. `{colors.negative}` is gray for a reason.
- Don't put the `{component.award-seal}` on more than a small handful of products. It is
  scarce or it is worthless.
- Don't round the corners of chips, cards, inputs, or images.
- Don't set long-form body copy in Exo 2. It is a display and UI face here.
- Don't add drop shadows to lift a card. Step the surface value instead.
- Don't run cinnabar as a large background field in light mode without testing it — on
  ivory it can vibrate. `{colors.cinnabar-deep}` is the fallback.
- Don't stack a second brand colour into the seal divider. Two bars, cobalt then cinnabar.
- Don't place related-content rails alongside the article measure on desktop.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Hamburger nav; hero 72→40px; sidebar collapses above article; card grids 1-up; comparison table scrolls horizontally with sticky first column; footer 4 cols → 1 |
| Tablet | 768–1024px | Nav stays horizontal and tightens; card grids 2-up; sidebar moves below verdict; spec cells 2-up |
| Desktop | 1024–1440px | Full nav; 3-up card grids; 300px sticky sidebar appears; spec cells 4-up |
| Wide | > 1440px | Content caps at 1280px; article measure stays 680px; extra width becomes margin |

### Touch Targets
- `{component.button-primary}` and `{component.button-secondary}` are 48px tall.
- `{component.button-icon}` is 44px — the minimum.
- `{component.text-input}` and `{component.select}` are 48px.
- `{component.filter-chip}` is 34px visually but carries 8px vertical margin, giving a 50px
  effective tap area.
- `{component.category-tab}` labels carry 14px vertical padding.

### Collapsing Strategy
- The sticky sidebar becomes a horizontal strip pinned beneath the nav on mobile, carrying
  only `{component.score-seal}` and the best price.
- `{component.comparison-table}` never reflows into cards. It scrolls horizontally with the
  product-name column pinned — reflowing a comparison destroys the comparison.
- `{component.verdict-card}` padding drops from 40px to 24px below 768px.
- Card grids reduce columns rather than shrinking cards.
- `{component.pros-cons-list}` goes from two columns to stacked, pros first.

### Image Behavior
- Product photography keeps its aspect ratio at every breakpoint; the system never
  letterboxes.
- Hero images crop from 3:2 to 4:3 on mobile rather than scaling down.
- Gallery thumbnails stay 64px and scroll horizontally.
- The `{component.score-seal}` overlap on `{component.review-card}` reduces from 16px to 8px
  below 768px.

## Iteration Guide

1. Work on ONE component at a time and reference its YAML key
   (`{component.verdict-card}`, `{component.score-seal}`).
2. New components default to `{rounded.none}`. Circles only for icon buttons and avatars.
3. Every new component must be specified in both surface modes before it ships.
4. Variants (`-active`, `-selected`, `-disabled`) live as separate entries under
   `components:`.
5. Use `{token.refs}` everywhere — never inline hex.
6. Document default and active/pressed states only. Hover is not documented.
7. Before adding a colour, ask what it means. If the answer is "to make this stand out,"
   use a value step or type weight instead.
8. Cinnabar is the judgement colour. If a new component uses it and is not making a
   judgement, it is wrong.

## Known Gaps

- **The award seal's ring lockup is not drawn.** `{component.award-seal}` is specified as
  the chop plus a label, but the version with the text set around a square frame — the way a
  real seal impression carries border text — has not been produced.
- **Chart and graph styling beyond `{component.criteria-bar}` is not covered.** Battery
  curves, benchmark bars, and price-history lines will need a small chart spec; cobalt plus
  two neutral tints is the intended starting palette.
- **No dark-mode paper texture equivalent.** The light mode gets a 2% noise overlay; dark
  mode has no analogous treatment, and it may end up feeling flatter as a result.
- **Search results and empty states are unspecified.**
- **The 2% noise overlay has not been tested for its effect on text rendering** on low-DPI
  displays. Verify before shipping it.
- **Motion is out of scope.** No transition durations, easing curves, or scroll behaviour
  are documented.
- **Contrast has been reasoned, not measured.** `{colors.muted-light}` (#857f76) on
  `{colors.canvas-light}` (#f7f4ef) is close to the 4.5:1 line and should be checked with a
  tool before launch; the same goes for `{colors.caution}` on light surfaces.
- **Accessibility of the score seal.** A cinnabar square with a white numeral needs an
  explicit accessible name ("Score: 8 out of 10") since the "/10" is visually separated
  from the digit.
