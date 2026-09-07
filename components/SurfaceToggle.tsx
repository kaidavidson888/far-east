'use client';

import { useEffect, useState } from 'react';

const KEY = 'fe-surface';

export function SurfaceToggle() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const read = () =>
      setMode((document.documentElement.dataset.surface as 'dark' | 'light') || 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-surface'] });
    return () => obs.disconnect();
  }, []);

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.surface = next;
    try { localStorage.setItem(KEY, next); } catch { /* storage may be unavailable */ }
    setMode(next);
  }

  return (
    <button
      type="button"
      className="btn-icon"
      onClick={toggle}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} surface`}
      title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} surface`}
    >
      {mode === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="9" r="3.5" />
          <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M14.5 3.5l-1.4 1.4M4.9 13.1l-1.4 1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 11.2A6.6 6.6 0 0 1 6.8 3a6.8 6.8 0 1 0 8.2 8.2Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
