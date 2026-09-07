'use client';

import { useState } from 'react';

export function CopyLinkButton({ path, label = 'Copy share link' }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={copy} aria-live="polite">
      {copied ? 'Link copied' : label}
    </button>
  );
}
