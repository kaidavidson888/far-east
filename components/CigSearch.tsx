'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CIG_CONTROLS } from '@/lib/cigRow';
import { CIG_SEARCH, SEARCH_MISS_MS } from '@/lib/cigSearch';
import { SEARCH_GLYPH } from '@/lib/searchGlyph';

const ROW = CIG_SEARCH.row;
/** The dashed line's own height, and what the bar has above it. */
const LINE_H = Math.round((ROW.lineY1 - ROW.lineY0) * CIG_SEARCH.box * CIG_SEARCH.squash);
const BAND_H = CIG_CONTROLS.height - LINE_H;
/** The tick is taller than the bar has room for; it is shown from the line up. */
const TICK_Y0 = ROW.lineY0 - BAND_H / (CIG_SEARCH.box * CIG_SEARCH.squash);
const TICK_W = (ROW.tickX1 - ROW.x0) * CIG_SEARCH.box;
/** Where typing starts: past the tick, by the login box's own fraction of the line. */
const TEXT_LEFT = +(TICK_W + CIG_SEARCH.textX).toFixed(2);
/** The typed baseline: 0.06 of the type above the line, as the login box sets it. */
const BASELINE = BAND_H - Math.max(1, CIG_SEARCH.type * 0.06);

/**
 * A window onto the login box's sprite: the rect [x0,y0]-[x1,y1] of the box,
 * shown at (left, top) in the bar. The sprite is drawn `box` px across, so
 * that its dashed line comes out exactly the field's width.
 */
/**
 * A window onto the login box's sprite: the rect [x0,y0]-[x1,y1] of the box,
 * shown at (left, top) in the bar. The sprite is drawn `box` px across, so
 * that its dashed line comes out exactly the field's width — and `SQUASH`
 * shorter, which is the owner's "make the height of the dashed lines and
 * sigil 10% less tall": a drawn line has only its height to give, so the
 * sprite is scaled to a tenth less in Y and the dashes come out a tenth
 * thinner. Their length and their spacing are untouched.
 */
function win(x0: number, y0: number, x1: number, y1: number, left: number, top: number): React.CSSProperties {
  const B = CIG_SEARCH.box;
  const BY = B * CIG_SEARCH.squash;
  return {
    left: `${+left.toFixed(2)}px`,
    top: `${+top.toFixed(2)}px`,
    width: `${+((x1 - x0) * B).toFixed(2)}px`,
    height: `${+((y1 - y0) * BY).toFixed(2)}px`,
    backgroundImage: `url(${CIG_SEARCH.sprite})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${+B.toFixed(2)}px ${+BY.toFixed(2)}px`,
    backgroundPosition: `${+(-x0 * B).toFixed(2)}px ${+(-y0 * BY).toFixed(2)}px`,
  };
}

/**
 * THE ROW'S SEARCH: a magnifying glass in a box the plus's size, and the bar
 * that comes out of it (the owner's 2026-09-19 ask).
 *
 * It is a sibling of the tag menu and built the same way — placed in screen px
 * by `layoutMenu` in CigScroller, with a zoomed layer inside so that it is
 * drawn at the plus's own scale and its type is set at the size it is seen at.
 * Shut, the button stands where the owner put it: halfway between the pack
 * left of the framed one and the plus, and halfway between the red frame's
 * foot and the plus's top. Open, it slides onto the frame's left edge at that
 * same height, as the plus does, and the bar runs from it to the frame's right
 * — "fit between the edges of the red outline appearing from left to right
 * from the magnifying button like the menu from the + button".
 *
 * THE BAR IS A ROW OF THE LOGIN BOX, LARGER, AND IT IS THE WHOLE ROW: the
 * glass fades out as it arrives and the line runs edge to edge of the red
 * frame (the owner's 2026-09-20 ask). See `CIG_SEARCH` for why its marks are
 * windows onto the splash's own sprite rather than drawn here.
 *
 * THE ☁ IS THE CARET. It used to step aside once anything was typed, as the
 * login box's does; the owner asked instead for it to blink and "mark where
 * the next text will appear". So it stands at the end of the typed run —
 * measured with the field's own font — and blinks while the field has the
 * caret, and the browser's own caret is turned off, there being no sense in
 * two. It is a masked block rather than an image so that going red on a miss
 * is one colour changing.
 *
 * THE BUTTON IS ALSO "SEARCH". The owner: "hits enter or search". Shut, a
 * press opens the bar; open with something typed, it searches, exactly as
 * Enter does; open and empty, it shuts the bar again. Escape shuts it too.
 *
 * NOTHING FOUND: the ☁ goes red at once, holds half a second and fades back,
 * and what was typed is deleted — the login box's own rejection, aimed at the
 * sigil rather than the whole box.
 */
export type SearchPlace = {
  left: number;
  top: number;
  s: number;
  fit: number;
  /** how long the dashed line is drawn, in the bar's own px — see `searchLineW` */
  line: number;
};

export function CigSearch({
  open,
  locked,
  place,
  slides,
  onOpenChange,
  onSearch,
}: {
  open: boolean;
  /** a spin is running: the row cannot take another */
  locked: boolean;
  /** where the box goes, in screen px, and the scale it is drawn at */
  place: SearchPlace | null;
  /** whether its moves are animated yet — see `menuSlides` in CigScroller */
  slides: boolean;
  onOpenChange: (open: boolean) => void;
  /** run the search; false if it found nothing */
  onSearch: (query: string) => boolean;
}) {
  const [query, setQuery] = useState('');
  const [miss, setMiss] = useState(false);
  const [size, setSize] = useState<number>(CIG_SEARCH.type);
  /** Where the ☁ stands: the end of what is typed, in the bar's own px. */
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  /** What was last searched for and found: the glass shuts the bar on that, rather than searching it again. */
  const lastHit = useRef<string | null>(null);
  /** A search asked for while the row was spinning; it runs when the row lands. */
  const pending = useRef(false);
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(missTimer.current), []);

  // opening puts the caret in the field; shutting takes it out again, or a
  // hidden field would still be swallowing the arrow keys meant for the row
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (open) el.focus({ preventScroll: true });
    // Shutting hands the focus to the glass rather than dropping it on the
    // page: from BODY a keyboard reader's next Tab starts the page again.
    else if (document.activeElement === el) toggleRef.current?.focus({ preventScroll: true });
  }, [open]);

  const run = useCallback(() => {
    const q = query.trim();
    // Enter on an empty bar shuts it. With the glass faded out there would
    // otherwise be no way back but Escape or a hand on the row.
    if (!q) {
      onOpenChange(false);
      return;
    }
    // The spin is unskippable, so a search asked for during one is HELD and
    // run when the row lands — it used to be dropped without a sign.
    if (locked) {
      pending.current = true;
      return;
    }
    pending.current = false;
    if (onSearch(q)) {
      lastHit.current = q;
      return;
    }
    lastHit.current = null;
    // nothing found: the ☁ red, and what was typed gone
    setQuery('');
    setMiss(true);
    clearTimeout(missTimer.current);
    missTimer.current = setTimeout(() => setMiss(false), SEARCH_MISS_MS);
    inputRef.current?.focus({ preventScroll: true });
  }, [locked, onOpenChange, onSearch, query]);

  useEffect(() => {
    if (!locked && pending.current) run();
  }, [locked, run]);

  /**
   * A LONG QUERY IS SET SMALLER, ON THE SAME BASELINE. The login box's type is
   * large for its line — about a ninth of its length — so a dozen characters
   * fill it, and "great hall of the people" is twice that. The run is measured
   * with the field's own font and the size brought down until it fits, never
   * below what reads.
   */
  /**
   * The line as it is actually drawn — the design row, cut where the dots
   * button stands (`searchLineW`) — and the room for typing along it.
   */
  const lineW = place?.line ?? CIG_SEARCH.fieldW;
  const avail = Math.max(0, lineW - TEXT_LEFT - 2);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || !query) {
      setSize(CIG_SEARCH.type);
      setCaret(0);
      return;
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = `700 ${CIG_SEARCH.type}px ${getComputedStyle(el).fontFamily}`;
    const w = ctx.measureText(query).width;
    // THE FLOOR IS IN SCREEN PX, and the bar is zoomed TWICE: 12 design px is
    // 8.4 on a phone, under the 9 this site knows will not render solid. And
    // iOS zooms the whole page on focusing a field set under 16px and does not
    // zoom back, so on a touch screen the floor is 16; past it a long query
    // scrolls in the field, which a text input does by itself. Both zooms
    // count — the menu's and the bar's own `--cig-bar-fit`, which runs down to
    // 0.68 — or the floor is overstated by up to half again.
    const s = (place?.s ?? 1) * (place?.fit ?? 1);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const floor = Math.min(CIG_SEARCH.type, Math.max(CIG_SEARCH.typeMin, (coarse ? 16 : 9) / s));
    const next = w <= avail ? CIG_SEARCH.type : Math.max(floor, +((CIG_SEARCH.type * avail) / w).toFixed(2));
    setSize(next);
    // where the next letter will go: the run at the size it is actually set,
    // clamped to the line's end for a query long enough to scroll in the field
    ctx.font = `700 ${next}px ${getComputedStyle(el).fontFamily}`;
    setCaret(Math.min(avail, ctx.measureText(query).width) + next * CIG_SEARCH.caretGap);
  }, [avail, query, place?.s, place?.fit]);

  const g = SEARCH_GLYPH;
  return (
    <div
      className="cig-search"
      data-open={open ? '' : undefined}
      data-placed={place ? '' : undefined}
      data-slides={slides ? '' : undefined}
      style={
        place
          ? ({ left: `${place.left}px`, top: `${place.top}px`, '--cig-menu-zoom': place.s, '--cig-bar-fit': place.fit } as React.CSSProperties)
          : undefined
      }
    >
      <form
        className="cig-search-scale"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <button
          ref={toggleRef}
          type="button"
          className="cig-search-toggle"
          // IT FADES OUT WHEN THE BAR ARRIVES, and when the dots' words come
          // down over it, and takes no press while it is gone: a button
          // nobody can see is not one anybody should be able to hit or tab
          // to. Escape, or scrolling the row, is the way back from its own
          // bar; pressing the dots again brings it back from theirs.
          // NOTHING ELSE TAKES IT AWAY. The dots' words grow along this line
          // and cross it on a narrow window; for an afternoon the glass stood
          // down for them, and the owner's word on that is "dont make the
          // magnifying button disappear when the 3 dot menu is open"
          // (2026-09-20). It keeps its place and stays pressable.
          inert={open || undefined}
          aria-expanded={open}
          aria-label={open ? (query.trim() && query.trim() !== lastHit.current ? 'Search' : 'Close the search') : 'Search the cigarettes'}
          onClick={() => {
            // open with the text it has already found: the glass shuts the bar.
            // Otherwise the only way to close after a hit was to delete the query.
            if (!open) onOpenChange(true);
            else if (query.trim() && query.trim() !== lastHit.current) run();
            else onOpenChange(false);
          }}
          onKeyDown={(e) => {
            if (open && e.key === 'Escape') {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
        >
          <svg viewBox={g.viewBox} width={g.width} height={g.height} aria-hidden="true" focusable="false">
            <path d={g.d} fill="currentColor" fillRule={g.fillRule} />
          </svg>
        </button>

        {/* `inert` while shut: an invisible field that can still be typed into
            or tabbed to is the trap the tag menu's bar was fixed for */}
        <div className="cig-search-bar" data-open={open ? '' : undefined} inert={!open}>
          <div className="cig-search-marks" aria-hidden="true">
            <span className="cig-search-slot" style={{ '--i': 0, ...win(ROW.x0, TICK_Y0, ROW.tickX1, ROW.lineY0, 0, 0) } as React.CSSProperties} />
            {Array.from({ length: CIG_SEARCH.segments }, (_, k) => {
              // THE LINE IS CUT, NOT SQUEEZED: the windows stop earlier on a
              // sprite still drawn at its own size, so the dashes keep the
              // length and the spacing they were drawn with.
              const span = lineW / CIG_SEARCH.box;
              const a = ROW.x0 + (span * k) / CIG_SEARCH.segments;
              const b = ROW.x0 + (span * (k + 1)) / CIG_SEARCH.segments;
              return (
                <span
                  key={k}
                  className="cig-search-slot"
                  style={{ '--i': k, ...win(a, ROW.lineY0, b, ROW.lineY1, (a - ROW.x0) * CIG_SEARCH.box, BAND_H) } as React.CSSProperties}
                />
              );
            })}
          </div>

          <span
            className="cig-search-slot cig-search-caret"
            style={{ '--i': 1, left: `${+(TEXT_LEFT + caret).toFixed(2)}px`, top: `${BAND_H - CIG_SEARCH.sigilH}px` } as React.CSSProperties}
            aria-hidden="true"
          >
            {/* KEYED ON THE QUERY so that the blink restarts, solid, on every
                keystroke — which is what a caret does, and what tells the
                reader the mark is theirs rather than an ornament. */}
            <span
              key={query}
              className="cig-search-sigil"
              data-miss={miss ? '' : undefined}
              data-blink={focused && !miss ? '' : undefined}
              style={{ width: `${CIG_SEARCH.sigilW}px`, height: `${CIG_SEARCH.sigilH}px` }}
            />
          </span>

          <span className="cig-search-slot" style={{ '--i': 1, left: `${TEXT_LEFT}px`, top: 0 } as React.CSSProperties}>
            <input
              ref={inputRef}
              className="cig-search-input"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Search the cigarettes by name, brand or tag"
              value={query}
              tabIndex={open ? undefined : -1}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onOpenChange(false);
                }
                // the row listens for the arrow keys; a caret in a field has
                // first call on them
                e.stopPropagation();
              }}
              style={{
                width: `${avail}px`,
                height: `${size}px`,
                fontSize: `${size}px`,
                // the baseline stays where it is whatever the size: 0.825 of the
                // size down a line-height:1 box (measured in Chrome for the shelf)
                top: `${+(BASELINE - 0.825 * size).toFixed(2)}px`,
              }}
            />
          </span>
        </div>
      </form>
    </div>
  );
}
