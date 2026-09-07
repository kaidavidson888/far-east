/**
 * Stand-in for product photography: a flat neutral ground with a consistently
 * framed pack. Every product is rendered identically apart from the strength
 * band, whose height encodes Full / Medium / Light / Ultra light. Swap this
 * component for real 1:1 and 3:2 photography when it is shot.
 */
const BAND_BY_STRENGTH: Record<string, number> = {
  'Full': 26, 'Medium': 18, 'Light': 11, 'Ultra light': 6,
};

export function PackShot({
  name, brand, cjk, strength, ratio = '1:1',
}: {
  name: string; brand: string; cjk?: string | null; strength: string;
  ratio?: '1:1' | '3:2';
}) {
  const w = ratio === '3:2' ? 600 : 400;
  const h = ratio === '3:2' ? 400 : 400;
  const band = BAND_BY_STRENGTH[strength] ?? 14;

  // Pack geometry, centred on the ground.
  const pw = 150, ph = 236, pd = 26;
  const px = (w - pw) / 2, py = (h - ph) / 2 + 6;

  const initials = brand
    .split(/\s+/).map((p) => p[0]).join('').slice(0, 3).toUpperCase();

  return (
    <svg
      className={ratio === '3:2' ? 'pack-shot pack-shot-hero' : 'pack-shot'}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${name} pack illustration`}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* ground */}
      <rect x="0" y="0" width={w} height={h} fill="var(--pack-ground)" />

      {/* pack top face (perspective sliver) */}
      <polygon className="p-top" points={`${px},${py} ${px + pd},${py - pd * 0.55} ${px + pw + pd},${py - pd * 0.55} ${px + pw},${py}`} />
      {/* pack side */}
      <polygon className="p-top" points={`${px + pw},${py} ${px + pw + pd},${py - pd * 0.55} ${px + pw + pd},${py + ph - pd * 0.55} ${px + pw},${py + ph}`} opacity="0.72" />
      {/* pack front */}
      <rect className="p-body" x={px} y={py} width={pw} height={ph} />
      <rect className="p-edge" x={px + 0.5} y={py + 0.5} width={pw - 1} height={ph - 1} fill="none" strokeWidth="1" />

      {/* strength band — height encodes strength. Neutral: cinnabar means "judged", and a pack is not a judgement. */}
      <rect className="p-band" x={px} y={py + ph - band - 34} width={pw} height={band} />

      {/* wordmark block */}
      <text
        className="p-ink" x={px + pw / 2} y={py + 74}
        textAnchor="middle" fontFamily="'Exo 2', sans-serif" fontWeight="800"
        fontSize="34" letterSpacing="1"
      >{initials}</text>

      {cjk ? (
        <text
          className="p-ink" x={px + pw / 2} y={py + 118}
          textAnchor="middle" fontFamily="'Noto Serif TC', 'Noto Serif', serif"
          fontWeight="700" fontSize="26" letterSpacing="3"
        >{cjk.slice(0, 3)}</text>
      ) : null}

      <text
        className="p-dim" x={px + pw / 2} y={py + ph - band - 52}
        textAnchor="middle" fontFamily="'Exo 2', sans-serif" fontWeight="700"
        fontSize="10" letterSpacing="2"
      >{strength.toUpperCase()}</text>

      {/* base warning strip, as every pack carries */}
      <rect className="p-edge" x={px} y={py + ph - 28} width={pw} height={28} fill="none" strokeWidth="1" />
      <text
        className="p-dim" x={px + pw / 2} y={py + ph - 10}
        textAnchor="middle" fontFamily="'Exo 2', sans-serif" fontWeight="700"
        fontSize="8" letterSpacing="1.2"
      >SMOKING KILLS</text>
    </svg>
  );
}
