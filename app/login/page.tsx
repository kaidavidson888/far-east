import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { LoginForm } from '@/components/AuthForm';
import { SealDivider } from '@/components/SealDivider';
import { SurfacePreference } from '@/components/SurfacePreference';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect('/favorites');
  const { next } = await searchParams;

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
          <LoginForm next={next && next.startsWith('/') ? next : '/favorites'} />
        </div>
      </div>
    </>
  );
}
