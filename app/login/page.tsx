import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { LoginForm } from '@/components/AuthForm';
import { GoogleButton } from '@/components/GoogleButton';
import { SealDivider } from '@/components/SealDivider';
import { SurfacePreference } from '@/components/SurfacePreference';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * What went wrong on the way back from a provider, in words a reader can do
 * something about. `provider` is nearly always the provider being switched off
 * in the Supabase dashboard rather than anything the reader did, so it does
 * not blame them.
 */
const TROUBLE: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. Nothing has changed.',
  provider: 'Google sign-in is not available at the moment. Try again in a little while.',
  expired: 'That sign-in did not complete in time. Please start again.',
};

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await currentUser()) redirect('/favorites');
  const { next, error } = await searchParams;
  const where = next && next.startsWith('/') ? next : '/favorites';
  const trouble = error ? TROUBLE[error] ?? TROUBLE.provider : null;

  return (
    <>
      <SurfacePreference mode="dark" />
      <div className="container band-sm" style={{ maxWidth: 520 }}>
        <div className="stack-lg">
          <SealDivider short />
          <h1 className="display-md">Sign in</h1>
          <p className="body-md">
            You only need an account to rate, review and keep a shelf. Everything else on Far East
            is open.
          </p>
          {trouble ? <p className="notice">{trouble}</p> : null}
          <GoogleButton next={where} />
          <p className="auth-or"><span>or</span></p>
          <LoginForm next={where} />
        </div>
      </div>
    </>
  );
}
