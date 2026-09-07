'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { saveReviewAction, deleteReviewAction, type FormState } from '@/app/actions';

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary" disabled={pending}>
      {pending ? 'Publishing…' : editing ? 'Update review' : 'Publish review'}
    </button>
  );
}

export function ReviewForm({
  slug, signedIn, existing,
}: {
  slug: string;
  signedIn: boolean;
  existing: { rating: number; title: string; body: string } | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveReviewAction, null);
  const [rating, setRating] = useState(existing?.rating ?? 0);

  if (!signedIn) {
    return (
      <div className="card card-pad stack-md">
        <h3 className="title-lg">Rate this cigarette</h3>
        <p className="body-md">
          Reading is open to everyone, and every score on this site comes from readers like you.
          Rating, reviewing and building a shelf need an account — about twenty seconds, and we
          ask for nothing beyond a name and an email.
        </p>
        <div className="row wrap" style={{ gap: 'var(--sm)' }}>
          <Link href="/register" className="btn btn-secondary">Create an account</Link>
          <Link href={`/login?next=${encodeURIComponent(`/cigarette/${slug}`)}`} className="btn btn-secondary">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad stack-lg">
      <div className="row-between">
        <h3 className="title-lg">{existing ? 'Your review' : 'Rate this cigarette'}</h3>
        {existing ? (
          <form action={deleteReviewAction}>
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" className="btn btn-ghost">Delete</button>
          </form>
        ) : null}
      </div>

      <form action={formAction} className="stack-lg">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="rating" value={rating} />

        <fieldset className="stack-sm" style={{ border: 0 }}>
          <legend className="label muted" style={{ marginBottom: 'var(--xs)' }}>Your score — 1 to 10</legend>
          <div className="rating-scale" role="radiogroup" aria-label="Your score out of 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} out of 10`}
                data-selected={rating === n}
                onClick={() => setRating(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="label">Headline <span className="caption">(optional)</span></span>
          <input className="input" name="title" maxLength={120}
            defaultValue={existing?.title ?? ''} placeholder="One line on what it is really like" />
        </label>

        <label className="field">
          <span className="label">Your review <span className="caption">(optional)</span></span>
          <textarea className="textarea" name="body" maxLength={4000}
            defaultValue={existing?.body ?? ''}
            placeholder="Draw, burn, aroma, how it holds up over a pack — whatever you would want to have read before buying it." />
        </label>

        {state?.error ? <p className="notice">{state.error}</p> : null}
        {state?.ok ? <p className="notice positive">{state.ok}</p> : null}

        <div className="row wrap" style={{ gap: 'var(--sm)' }}>
          <Submit editing={!!existing} />
          <span className="caption">Published under your display name. You can edit or delete it at any time.</span>
        </div>
      </form>
    </div>
  );
}
