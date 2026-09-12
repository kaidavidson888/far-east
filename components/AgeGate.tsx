'use client';

import { useState, useSyncExternalStore } from 'react';

const KEY = 'fe-age-confirmed';
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener('storage', fn);
  return () => { listeners.delete(fn); window.removeEventListener('storage', fn); };
}

function isConfirmed() {
  try { return localStorage.getItem(KEY) === 'yes'; } catch { return false; }
}

function confirm() {
  try { localStorage.setItem(KEY, 'yes'); } catch { /* storage may be unavailable */ }
  listeners.forEach((fn) => fn());
}

export function AgeGate() {
  // Server renders as "already confirmed" so the gate never ships in the HTML;
  // the real answer arrives on hydration.
  const confirmed = useSyncExternalStore(subscribe, isConfirmed, () => true);
  const [declined, setDeclined] = useState(false);

  if (confirmed) return null;

  if (declined) {
    return (
      <div className="gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="gate-blocked">
        <div className="gate-panel stack-md">
          <h2 id="gate-blocked" className="display-sm">You need to be of legal smoking age.</h2>
          <div className="seal-divider short" aria-hidden="true"><span /><span /></div>
          <p className="body-md">
            Far East publishes reviews of tobacco products and is restricted to adults at or above
            the legal smoking age in their country. Thanks for stopping by.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate-panel stack-lg">
        <div className="stack-md">
          <h2 id="gate-title" className="display-sm">Are you of legal smoking age?</h2>
          <div className="seal-divider short" aria-hidden="true"><span /><span /></div>
          {/* the two lower paragraphs share one rule, so they read as one block
              of terms against the question above them */}
          <div className="gate-terms stack-md">
            <p className="body-md">
              Far East reviews tobacco products. Entry is limited to adults at or above the legal
              smoking age where they live.
            </p>
            <p className="caption">
              Smoking causes serious, often fatal disease. Nothing on this site is a recommendation
              to start or to continue smoking.
            </p>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 'var(--sm)' }}>
          <button type="button" className="btn btn-primary" onClick={confirm}>Yes, I am</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDeclined(true)}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}
