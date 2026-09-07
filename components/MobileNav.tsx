'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type Item = { href: string; label: string };

export function MobileNav({ menu, account }: { menu: Item[]; account: Item[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Close the panel whenever the route changes.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="btn-icon mobile-only"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2 5h14M2 9h14M2 13h14" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open ? (
        <div id="mobile-menu" className="mobile-menu">
          <nav className="container stack-md" aria-label="Primary, mobile">
            {menu.map((m) => (
              <Link key={m.href} href={m.href} className="title-md" style={{ color: '#fff' }}>
                {m.label}
              </Link>
            ))}
            <hr className="hairline" style={{ background: '#333' }} />
            {account.map((m) => (
              <Link key={m.href} href={m.href} className="ui" style={{ color: '#c4c0ba' }}>{m.label}</Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
