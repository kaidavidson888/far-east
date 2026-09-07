'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

export type FacetGroup = { key: string; label: string; values: { value: string; count: number }[] };

const SORTS = [
  { value: 'rating', label: 'Reader rating' },
  { value: 'reviews', label: 'Most reviewed' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'tar_asc', label: 'Tar — low to high' },
  { value: 'tar_desc', label: 'Tar — high to low' },
  { value: 'price_asc', label: 'Price — low to high' },
  { value: 'price_desc', label: 'Price — high to low' },
];

const TAR_STEPS = [
  { value: '', label: 'Any tar level' },
  { value: '6', label: '6 mg or less' },
  { value: '10', label: '10 mg or less' },
  { value: '14', label: '14 mg or less' },
  { value: '20', label: '20 mg or less' },
];

export function CatalogFilters({ groups, resultCount }: { groups: FacetGroup[]; resultCount: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  const [open, setOpen] = useState<string | null>(null);

  // Re-sync the box when the URL changes from outside this component
  // (back button, "clear all", a link with its own query).
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setQ(urlQ);
  }

  const push = useCallback((next: URLSearchParams) => {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `/catalog?${qs}` : '/catalog', { scroll: false }));
  }, [router]);

  // Debounced free-text search.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (q === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set('q', q.trim()); else next.delete('q');
      push(next);
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, push]);

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const active = next.getAll(key);
    next.delete(key);
    const updated = active.includes(value) ? active.filter((v) => v !== value) : [...active, value];
    updated.forEach((v) => next.append(key, v));
    push(next);
  }

  function setSingle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    push(next);
  }

  const activeCount = groups.reduce((n, g) => n + params.getAll(g.key).length, 0)
    + (params.get('maxTar') ? 1 : 0) + (params.get('q') ? 1 : 0);

  return (
    <div className="stack-lg" aria-busy={pending}>
      {/* search + sort */}
      <div className="row wrap" style={{ gap: 'var(--sm)', alignItems: 'flex-end' }}>
        <label className="field grow" style={{ minWidth: 240 }}>
          <span className="label">Search</span>
          <input
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Brand, name, country, 中华…"
            aria-label="Search the catalogue"
          />
        </label>
        <label className="field" style={{ minWidth: 190 }}>
          <span className="label">Max tar</span>
          <select className="select" value={params.get('maxTar') ?? ''} onChange={(e) => setSingle('maxTar', e.target.value)}>
            {TAR_STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 210 }}>
          <span className="label">Sort by</span>
          <select className="select" value={params.get('sort') ?? 'rating'} onChange={(e) => setSingle('sort', e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {/* facet groups */}
      <div className="stack-md">
        {groups.map((g) => {
          const selected = params.getAll(g.key);
          const isLong = g.values.length > 8;
          const shown = isLong && open !== g.key ? g.values.slice(0, 8) : g.values;
          return (
            <div key={g.key} className="stack-xs">
              <span className="label muted">{g.label}</span>
              <div className="chip-row">
                {shown.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="chip"
                    data-selected={selected.includes(v.value)}
                    aria-pressed={selected.includes(v.value)}
                    onClick={() => toggle(g.key, v.value)}
                  >
                    {v.value}
                    <span style={{ marginLeft: 8, opacity: 0.6 }}>{v.count}</span>
                  </button>
                ))}
                {isLong ? (
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(open === g.key ? null : g.key)}>
                    {open === g.key ? 'Show fewer' : `+${g.values.length - 8} more`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row-between wrap" style={{ paddingTop: 'var(--md)', borderTop: '1px solid var(--hairline)' }}>
        <p className="ui muted" role="status">
          <strong className="ink">{resultCount}</strong> {resultCount === 1 ? 'cigarette' : 'cigarettes'}
          {activeCount ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} applied` : ''}
          {pending ? ' · updating…' : ''}
        </p>
        {activeCount ? (
          <button type="button" className="btn btn-ghost" onClick={() => push(new URLSearchParams())}>
            Clear all filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
