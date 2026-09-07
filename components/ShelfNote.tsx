'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveNoteAction, type FormState } from '@/app/actions';

function Save() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn btn-ghost" disabled={pending}>{pending ? 'Saving…' : 'Save note'}</button>;
}

export function ShelfNote({ cigaretteId, note }: { cigaretteId: number; note: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveNoteAction, null);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="stack-xs">
        {note ? <p className="body-sm" style={{ whiteSpace: 'pre-wrap' }}>{note}</p> : null}
        <button type="button" className="btn btn-ghost" style={{ marginLeft: -16 }} onClick={() => setEditing(true)}>
          {note ? 'Edit note' : 'Add a note'}
        </button>
        {state?.ok ? <p className="caption">{state.ok}</p> : null}
      </div>
    );
  }

  return (
    <form action={action} className="stack-xs" onSubmit={() => setEditing(false)}>
      <input type="hidden" name="cigarette_id" value={cigaretteId} />
      <label className="field">
        <span className="sr-only">Your note</span>
        <textarea className="textarea" name="note" defaultValue={note} maxLength={400}
          style={{ minHeight: 90 }} placeholder="Why it is on your shelf" />
      </label>
      <div className="row" style={{ gap: 'var(--xs)' }}>
        <Save />
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  );
}
