'use client';

import { useFormStatus } from 'react-dom';
import { cancelShareAction, generateShareAction } from '@/app/actions';
import { CopyLinkButton } from './CopyLinkButton';

function GenerateButton({ disabled, block = true }: { disabled: boolean; block?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`btn btn-primary${block ? ' btn-block' : ''}`}
      disabled={disabled || pending}
    >
      {pending ? 'Generating…' : 'Generate link'}
    </button>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="text-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
      {pending ? 'Cancelling…' : 'Cancel link'}
    </button>
  );
}

export function ShelfSharing({
  shelfName, share, itemCount, variant = 'panel',
}: {
  shelfName: string;
  /** The live link, or null if there isn't one. `generatedAt` is pre-formatted server-side. */
  share: { path: string; generatedAt: string; itemCount: number } | null;
  itemCount: number;
  /** 'bar' is the wide layout used at the top of the shelf page. */
  variant?: 'panel' | 'bar';
}) {
  if (variant === 'bar') {
    return (
      <div className="share-bar">
        {share ? (
          <>
            <div className="grow stack-xs">
              <span className="label muted">Share link · live</span>
              <p className="mono-sm" style={{ wordBreak: 'break-all', color: 'var(--ink)' }}>{share.path}</p>
              <p className="caption">
                Generated {share.generatedAt} · shows the {share.itemCount}{' '}
                {share.itemCount === 1 ? 'cigarette' : 'cigarettes'} on your shelf at that moment
              </p>
            </div>
            <div className="row wrap" style={{ gap: 'var(--md)' }}>
              <CopyLinkButton path={share.path} />
              <form action={cancelShareAction}>
                <CancelButton />
              </form>
            </div>
          </>
        ) : (
          <>
            <div className="grow stack-xs">
              <span className="label muted">Share this shelf</span>
              <p className="body-sm" style={{ maxWidth: '52ch' }}>
                Generating a link freezes your shelf as it stands. Anyone with it can open the
                list — no account needed — until you cancel it.
              </p>
            </div>
            <form action={generateShareAction}>
              <GenerateButton disabled={itemCount === 0} block={false} />
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card card-pad stack-lg">
      <h2 className="title-lg">Sharing</h2>

      <div className="stack-xs">
        <span className="label muted">Shelf name</span>
        <p className="title-md">{shelfName}</p>
        <p className="caption">Taken from your name. Change your name and the shelf follows.</p>
      </div>

      <hr className="hairline" />

      {share ? (
        <div className="stack-md">
          <div className="stack-xs">
            <span className="label muted">Link generated</span>
            <p className="spec-value">{share.generatedAt}</p>
            <p className="caption">
              Shows the {share.itemCount} {share.itemCount === 1 ? 'cigarette' : 'cigarettes'} that
              were on your shelf at that moment. Changes you make now will not appear in it.
            </p>
          </div>

          <p className="mono-sm" style={{ wordBreak: 'break-all', color: 'var(--ink)' }}>{share.path}</p>

          <div className="row wrap" style={{ gap: 'var(--md)' }}>
            <CopyLinkButton path={share.path} />
            <form action={cancelShareAction}>
              <CancelButton />
            </form>
          </div>

          <p className="caption">
            Cancelling stops every copy of the link working. Generate a new one to share an
            up-to-date shelf.
          </p>
        </div>
      ) : (
        <div className="stack-md">
          <p className="body-sm">
            Generating a link freezes your shelf as it stands. Anyone with the link can open it —
            no account needed — and it keeps showing that snapshot until you cancel it.
          </p>
          <form action={generateShareAction}>
            <GenerateButton disabled={itemCount === 0} />
          </form>
          {itemCount === 0 ? (
            <p className="caption">Add something to your shelf first.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
