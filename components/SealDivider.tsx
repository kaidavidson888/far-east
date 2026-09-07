export function SealDivider({ short = false }: { short?: boolean }) {
  return (
    <div className={short ? 'seal-divider short' : 'seal-divider'} aria-hidden="true">
      <span /><span />
    </div>
  );
}
