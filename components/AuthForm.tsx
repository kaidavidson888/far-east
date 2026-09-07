'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, registerAction, type FormState } from '@/app/actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
      {pending ? 'Working…' : label}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <form action={action} className="stack-lg">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span className="label">Email</span>
        <input className="input" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error ? <p className="notice">{state.error}</p> : null}
      <Submit label="Sign in" />
      <p className="body-sm">
        No account yet? <Link href="/register" className="inline-link">Create one</Link>.
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, null);
  return (
    <form action={action} className="stack-lg">
      <label className="field">
        <span className="label">Display name</span>
        <input className="input" name="display_name" autoComplete="nickname" required
          placeholder="Shown on your reviews and shelf" />
      </label>
      <label className="field">
        <span className="label">Email</span>
        <input className="input" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input className="input" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </label>
      <label className="field">
        <span className="label">Confirm password</span>
        <input className="input" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </label>
      <label className="row" style={{ alignItems: 'flex-start', gap: 'var(--sm)' }}>
        <input type="checkbox" name="adult" style={{ width: 18, height: 18, marginTop: 3 }} />
        <span className="body-sm">
          I am at or above the legal smoking age where I live, and I understand that smoking
          causes serious, often fatal disease.
        </span>
      </label>
      {state?.error ? <p className="notice">{state.error}</p> : null}
      {state?.ok ? <p className="notice positive">{state.ok}</p> : null}
      <Submit label="Create account" />
      <p className="body-sm">
        Already have one? <Link href="/login" className="inline-link">Sign in</Link>.
      </p>
    </form>
  );
}
