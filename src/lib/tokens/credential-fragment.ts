/**
 * @fileoverview **Ο ΣΥΝΔΕΣΜΟΣ ΤΟΥ ΟΠΟΙΟΥ ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ ΖΕΙ ΣΤΟ FRAGMENT** — η μία γραμματική, για κάθε πύλη χωρίς λογαριασμό.
 * @related ADR-876 §5 (πύλη προμηθευτή — η πρώτη) · ADR-915 §28 (σύνδεσμος ανάθεσης — η δεύτερη) · W3C TAG *Capability URLs*
 * @module lib/tokens/credential-fragment
 *
 * Ο browser **δεν στέλνει ποτέ** το `#…` στον server — ούτε σε access log, ούτε σε `Referer`, ούτε στα Safe Links που
 * «πατούν» τον σύνδεσμο πριν τον άνθρωπο. Γραμματική: `<διαδρομή>#t=<token>[&<όνομα>=<τιμή>…]`.
 *
 * Εξήχθη από το `vendor-portal-links.ts` (ADR-915 §28) με την άφιξη της **δεύτερης** πύλης: κατασκευαστής και αναγνώστης
 * πρέπει να δένονται στα **ίδια** ονόματα· δύο αντίγραφα θα απέκλιναν στο πρώτο νέο πεδίο.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, χωρίς `window`.
 */

/** Το κλειδί του διαπιστευτηρίου στο fragment — ίδιο σε κάθε πύλη. */
const FRAGMENT_TOKEN_KEY = 't';

/** `/διαδρομή#t=<token>&…` — **σχετική** τοποθεσία· το origin το βάζει ο καλών (κάθε πύλη ξέρει το δικό της «γιατί»). */
export function credentialFragmentLocation(path: string, token: string, extras: Readonly<Record<string, string>> = {}): string {
  const fragment = new URLSearchParams({ [FRAGMENT_TOKEN_KEY]: token });
  for (const [key, value] of Object.entries(extras)) fragment.set(key, value);
  return `${path}#${fragment.toString()}`;
}

export interface CredentialFragment {
  readonly token: string | null;
  /** Τα υπόλοιπα πεδία, ωμά — η πύλη τα διαβάζει με δικό της κλειστό σύνολο (σκουπίδι ⇒ κανένα). */
  readonly params: URLSearchParams;
}

/** `#t=…&…` → {token, params}. Απουσία ή κενό ⇒ `token: null`. */
export function readCredentialFragment(hash: string): CredentialFragment {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const token = params.get(FRAGMENT_TOKEN_KEY);
  params.delete(FRAGMENT_TOKEN_KEY);
  return { token: token && token.length > 0 ? token : null, params };
}
