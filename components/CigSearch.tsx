'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CIG_CONTROLS } from '@/lib/cigRow';
import { CIG_SEARCH, SEARCH_MISS_MS } from '@/lib/cigSearch';
import { SEARCH_GLYPH } from '@/lib/searchGlyph';

const ROW = CIG_SEARCH.row;
/** The dashed line's own height, and what the bar has above it. */
const LINE_H = Math.round((ROW.lineY1 - ROW.lineY0) * CIG_SEARCH.box);
const BAND_H = CIG_CONTROLS.height - LINE_H;
/** The tick is taller than the bar has room for; it is shown from the line up. */
const TICK_Y0 = ROW.lineY0 - BAND_H / CIG_SEARCH.box;
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
function win(x0: number, y0: number, x1: number, y1: number, left: number, top: number): React.CSSProperties {
  const B = CIG_SEARCH.box;
  return {
    left: `${+left.toFixed(2)}px`,
    top: `${+top.toFixed(2)}px`,
    width: `${+((x1 - x0) * B).toFixed(2)}px`,
    height: `${+((y1 - y0) * B).toFixed(2)}px`,
    backgroundImage: `url(${CIG_SEARCH.sprite})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${+B.toFixed(2)}px ${+B.toFixed(2)}px`,
    backgroundPosition: `${+(-x0 * B).toFixed(2)}px ${+(-y0 * B).toFixed(2)}px`,
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
 * THE BAR IS A ROW OF THE LOGIN BOX, LARGER. See `CIG_SEARCH` for why its
 * marks are windows onto the splash's own sprite rather than drawn here. The
 * ☁ stands where typing starts and steps aside once there is something typed,
 * as the login box's does; it is a masked block rather than an image so that
 * going red is one colour changing.
 *
 * THE BUTTON IS ALSO "SEARCH". The owner: "hits enter or search". Shut, a
 * press opens the bar; open with something typed, it searches, exactly as
 * Enter does; open and empty, it shuts the bar again. Escape shuts it too.
 *
 * NOTHING FOUND: the ☁ goes red at once, holds half a second and fades back,
 * and what was typed is deleted — the login box's own rejection, aimed at the
 * sigil rather than the whole box.
 */
export type SearchPlace = { left: number; top: number; s: number };

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(missTimer.current), []);

  // opening puts the caret in the field; shutting takes it out again, or a
  // hidden field would still be swallowing the arrow keys meant for the row
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (open) el.focus({ preventScroll: true });
    else el.blur();
  }, [open]);

  const run = useCallback(() => {
    const q = query.trim();
    if (!q || locked) return;
    if (onSearch(q)) return;
    // nothing found: the ☁ red, and what was typed gone
    setQuery('');
    setMiss(true);
    clearTimeout(missTimer.current);
    missTimer.current = setTimeout(() => setMiss(false), SEARCH_MISS_MS);
    inputRef.current?.focus({ preventScroll: true });
  }, [locked, onSearch, query]);

  /**
   * A LONG QUERY IS SET SMALLER, ON THE SAME BASELINE. The login box's type is
   * large for its line — about a ninth of its length — so a dozen characters
   * fill it, and "great hall of the people" is twice that. The run is measured
   * with the field's own font and the size brought down until it fits, never
   * below what reads.
   */
  const avail = CIG_SEARCH.fieldW - TEXT_LEFT - 2;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || !query) {
      setSize(CIG_SEARCH.type);
      return;
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = `700 ${CIG_SEARCH.type}px ${getComputedStyle(el).fontFamily}`;
    const w = ctx.measureText(query).width;
    setSize(w <= avail ? CIG_SEARCH.type : Math.max(CIG_SEARCH.typeMin, +((CIG_SEARCH.type * avail) / w).toFixed(2)));
  }, [avail, query]);

  const g = SEARCH_GLYPH;
  return (
    <div
      className="cig-search"
      data-open={open ? '' : undefined}
      data-placed={place ? '' : undefined}
      data-slides={slides ? '' : undefined}
      style={
        place
          ? ({ left: `${place.left}px`, top: `${place.top}px`, '--cig-menu-zoom': place.s } as React.CSSProperties)
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
          type="button"
          className="cig-search-toggle"
          aria-expanded={open}
          aria-label={open ? (query.trim() ? 'Search' : 'Close the search') : 'Search the cigarettes'}
          onClick={() => {
            if (!open) onOpenChange(true);
            else if (query.trim()) run();
            else onOpenChange(false);
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
              const a = ROW.x0 + ((ROW.x1 - ROW.x0) * k) / CIG_SEARCH.segments;
              const b = ROW.x0 + ((ROW.x1 - ROW.x0) * (k + 1)) / CIG_SEARCH.segments;
              return (
                <span
                  key={k}
                  className="cig-search-slot"
                  style={{ '--i': k, ...win(a, ROW.lineY0, b, ROW.lineY1, (a - ROW.x0) * CIG_SEARCH.box, BAND_H) } as React.CSSProperties}
                />
              );
            })}
          </div>

          <span className="cig-search-slot" style={{ '--i': 1, left: `${TEXT_LEFT}px`, top: `${BAND_H - CIG_SEARCH.sigilH}px` } as React.CSSProperties} aria-hidden="true">
            <span
              className="cig-search-sigil"
              data-miss={miss ? '' : undefined}
              data-typed={query ? '' : undefined}
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
