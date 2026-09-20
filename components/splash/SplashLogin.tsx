'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginStageAction, loginStepAction, type LoginStepResult } from '@/app/loginActions';
import type { LoginStep } from '@/lib/loginBox';
import { SplashLoginRow } from './SplashLoginRow';

/**
 * THE SEQUENCE THE ROW WALKS THROUGH.
 *
 * The row draws one section; this says which one, and hands what is typed to
 * the server. It keeps almost no state on purpose — the server's own row
 * (lib/loginState.ts) is the authority on which section is live, and every
 * answer it gives names the next one, so a reader who reloads mid-flow comes
 * back where they were rather than at PHONE # with a half-made account.
 *
 * Two answers are not steps at all:
 *   'done'    they are in; go where they were headed.
 *   blocked   three failures of one section, so the site is shut for half an
 *             hour — the owner's rule. /blocked is the red page.
 */
export function SplashLogin({
  centre,
  next = '',
  notice = null,
  onFieldFocus,
  onReady,
  live = true,
}: {
  centre: { x: number; y: number };
  next?: string;
  notice?: string | null;
  onFieldFocus?: (on: boolean) => void;
  onReady?: () => void;
  live?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('phone');
  const asked = useRef(false);

  /*
   * An attempt can be half done — a reader who typed a number, got the text and
   * came back. The server knows; ask it once, as the box becomes live, so the
   * first word drawn is the one they are actually on.
   */
  useEffect(() => {
    if (!live || asked.current) return;
    asked.current = true;
    void loginStageAction().then((s) => {
      if (s.blocked) { router.replace('/blocked'); return; }
      setStep(s.stage);
    }).catch(() => {});
  }, [live, router]);

  const submit = useCallback(
    async (at: LoginStep, value: string): Promise<{ ok: true; next: LoginStep | 'done' } | { ok: false; error?: string }> => {
      let res: LoginStepResult;
      try {
        res = await loginStepAction(at, value, next);
      } catch {
        return { ok: false };
      }
      if (!res.ok) {
        if (res.blocked) { router.replace('/blocked'); return { ok: false }; }
        return { ok: false, error: res.error };
      }
      if (res.next === 'done') {
        router.replace(res.go || '/landing');
        router.refresh();
      }
      return { ok: true, next: res.next };
    },
    [next, router],
  );

  return (
    <SplashLoginRow
      centre={centre}
      step={step}
      onStep={(to) => { if (to !== 'done') setStep(to); }}
      submit={submit}
      notice={notice}
      onFieldFocus={onFieldFocus}
      onReady={onReady}
      live={live}
    />
  );
}
