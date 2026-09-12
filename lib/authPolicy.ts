/**
 * The two rules the sign-in box and the server both have to agree on.
 *
 * They live here rather than in app/actions.ts because **a 'use server' module
 * may only export async functions.** Exporting a plain constant from one does
 * not fail to compile and does not fail to typecheck — it strips every export
 * from the module, so the client's imports of the ACTIONS break too, and the
 * error arrives at runtime as "the module has no exports at all". A shared
 * plain module is the way to give both sides the same number.
 *
 * Both checks run twice on purpose. The overlay runs them so it can flash the
 * wrong row without a round trip; the action runs them again because a server
 * action is a public endpoint and nothing the browser says is evidence.
 */

/** Shallow on purpose: an address is only really checked by sending to it. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase's own floor is six; this site has always asked for eight. */
export const MIN_PASSWORD = 8;
