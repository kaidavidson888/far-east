'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ArtPart } from '@/lib/artpage';

/**
 * A footer button that reacts.
 *
 * Two kinds, both in the same component because they are the same row of
 * marks and differ only in what pressing them means.
 *
 * The one for the page you are already on goes nowhere, so it sits at half
 * opacity and fades further as you approach — it is there to say where you
 * are, not to be used. Pressing it anyway flashes the whole square red for
 * a quarter second, an acknowledgement rather than a navigation.
 *
 * The other two lead somewhere. Hovering fills the box black behind its
 * label — a second image, since anything painted over the box would bury
 * the label — and drops the whole button to three-quarters opacity.
 */
const FLASH_MS = 250;

export function ArtPartButton({
  part,
  style,
  className,
  children,
}: {
  part: ArtPart;
  style: React.CSSProperties;
  className: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = () => {
    window.clearTimeout(timer.current);
    setFlashing(true);
    timer.current = window.setTimeout(() => setFlashing(false), FLASH_MS);
  };

  const shared = {
    className: `${className} artpage-nav${part.current ? ' artpage-nav-current' : ''}`,
    'aria-label': part.label,
    style,
    'data-hover': hover ? '' : undefined,
    'data-flashing': flashing ? '' : undefined,
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
  };

  const body = (
    <>
      {children}
      {part.hoverSrc ? (
        // stacked rather than swapped, so the hover state is already decoded
        <img className="artpage-nav-hover" src={part.hoverSrc} alt="" draggable={false} />
      ) : null}
      {part.current ? <span className="artpage-nav-flash" aria-hidden="true" /> : null}
    </>
  );

  if (part.current) {
    return (
      <button type="button" {...shared} aria-current="page" onClick={flash}>
        {body}
      </button>
    );
  }
  return (
    <Link href={part.href!} {...shared}>
      {body}
    </Link>
  );
}
