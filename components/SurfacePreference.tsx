'use client';

import { useEffect } from 'react';

/**
 * Each context has a default surface: dark for browsing, light for long reads.
 * A stored reader choice always wins.
 *
 * The inline script handles the first paint (before React hydrates, so the page
 * never flashes the wrong mode); the effect handles client-side navigation
 * between pages with different defaults.
 */
export function SurfacePreference({ mode }: { mode: 'dark' | 'light' }) {
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem('fe-surface'); } catch { /* storage may be unavailable */ }
    document.documentElement.dataset.surface =
      stored === 'light' || stored === 'dark' ? stored : mode;
  }, [mode]);

  const js = `(function(){try{var s=localStorage.getItem('fe-surface');document.documentElement.dataset.surface=s==='light'||s==='dark'?s:'${mode}';}catch(e){document.documentElement.dataset.surface='${mode}';}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
