type Size = 'lg' | 'sm' | 'xs';

/**
 * score-seal — always square, always cinnabar, never colour-graded to the value.
 * Carries the reader average; there is no editorial score. Has an explicit
 * accessible name because "/10" is visually separated from the digit.
 */
export function ScoreSeal({
  score, size = 'lg', label = 'Reader rating',
}: { score: number | null; size?: Size; label?: string }) {
  const cls = `score-seal${size === 'sm' ? ' sm' : size === 'xs' ? ' xs' : ''}${score == null ? ' empty' : ''}`;
  if (score == null) {
    return (
      <div className={cls} role="img" aria-label={`${label}: no ratings yet`}>
        <span className="num">—</span>
        <span className="den">/10</span>
      </div>
    );
  }
  return (
    <div className={cls} role="img" aria-label={`${label}: ${score} out of 10`}>
      <span className="num" aria-hidden="true">{score}</span>
      <span className="den" aria-hidden="true">/10</span>
    </div>
  );
}
