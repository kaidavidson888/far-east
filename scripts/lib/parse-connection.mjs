/**
 * Parses a Supabase pooler connection URI into its parts.
 * Returns { ok: false, error } rather than throwing, so callers can explain.
 */
export function parseConnection(raw) {
  const trimmed = String(raw ?? '').trim().replace(/^["']|["']$/g, '');
  const m = trimmed.match(/^(postgres(?:ql)?:\/\/)([^:]+):([^@]*)@([^/]+)\/([^?]+)(\?.*)?$/);
  if (!m) {
    return { ok: false, error: 'not-a-uri' };
  }
  const [, scheme, user, , hostPort, dbName] = m;

  if (!user.includes('.')) {
    return { ok: false, error: 'not-pooler-user', user };
  }
  const ref = user.split('.').slice(1).join('.');
  const port = hostPort.split(':')[1] ?? '5432';

  return {
    ok: true,
    scheme, user, hostPort, dbName, ref, port,
    projectUrl: `https://${ref}.supabase.co`,
    isTransactionPooler: port === '6543',
  };
}
