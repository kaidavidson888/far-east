import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { RegisterForm } from '@/components/AuthForm';
import { SealDivider } from '@/components/SealDivider';
import { SurfacePreference } from '@/components/SurfacePreference';

export const metadata: Metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  if (await currentUser()) redirect('/favorites');

  return (
    <>
      <SurfacePreference mode="dark" />
      <div className="container band-sm" style={{ maxWidth: 520 }}>
        <div className="stack-lg">
          <SealDivider short />
          <h1 className="display-md">Create an account</h1>
          <p className="body-md">
            A name, an email and a password. We do not ask for anything else, we do not sell what
            you give us, and there is nothing to buy here.
          </p>
          <RegisterForm />
          <p className="health-band caption">
            Smoking causes serious, often fatal disease. Far East reviews products that exist; it
            does not encourage anyone to smoke them.
          </p>
        </div>
      </div>
    </>
  );
}
