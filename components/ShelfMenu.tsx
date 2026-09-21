'use client';

import { useEffect, useState } from 'react';
import { MENU_ZOOM_MAX, shelfMenuZoom } from '@/lib/shelfGrid';
import { LogoMenu } from './LogoMenu';

/**
 * THE MOUNTAIN BUTTON ON THE SHELF, AND THE ONE NUMBER IT NEEDS.
 *
 * The owner's 2026-09-21: the shelf's 遠東 logo is replaced by the landing
 * page's mountain button, "with the same scale and margins in relation to the
 * page border and the same functionality" — plus a fourth word, HOME, since
 * that logo was the page's only way back to /landing.
 *
 * Everything but the scale comes out of the bake: the 10px margins, the
 * button's 33px, the mark, the words and how they unfold are all in
 * `lib/shelfmenu-geometry.json`, and `LogoMenu` reads them. On the landing
 * page the SCALE is published by `CigScroller`, because there it is the tag
 * menu's own zoom and the two controls have to match; there is no row here,
 * so this states it.
 *
 * THIS COMPONENT EXISTS ONLY BECAUSE THE SCALE HAS TO BE MEASURED. A zoom is
 * a unitless number and CSS cannot divide a length by a length, so the
 * clamp — 0.7 wherever the row fits, less on a window too narrow for it —
 * cannot be written as a `min()`. See `shelfMenuZoom`.
 *
 * It renders `display: contents`, so it is a carrier for the property and
 * takes no space and no place in the layout; the menu inside is still
 * positioned against `.shelf` exactly as it would be on its own.
 */
export function ShelfMenu() {
  // The server cannot know the width, so it draws the landing page's own
  // scale and the client corrects it. Nothing is drawn at rest but the
  // button, so the correction is a couple of pixels of button.
  const [zoom, setZoom] = useState(MENU_ZOOM_MAX);

  useEffect(() => {
    const fit = () => setZoom(shelfMenuZoom(document.documentElement.clientWidth));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="shelf-menu" style={{ '--logo-menu-zoom': zoom } as React.CSSProperties}>
      <LogoMenu menu="shelf" />
    </div>
  );
}
