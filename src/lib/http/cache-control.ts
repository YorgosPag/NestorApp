/**
 * @fileoverview **Η ΜΙΑ ΠΗΓΗ ΤΗΣ ΚΕΦΑΛΙΔΑΣ «ΚΑΜΙΑ ΜΝΗΜΗ»** για αποκρίσεις που ανήκουν σε έναν συνδεδεμένο άνθρωπο (ADR-923 §5.14).
 * @module lib/http/cache-control
 *
 * 🔴 **Γιατί υπάρχει**: στην παραγωγή το `next.config.js` δεν βάζει `Cache-Control` στο `/api`, και ένα route handler
 * που απαντά JSON **δεν** παίρνει κεφαλίδα μόνο του. Μετρημένο ζωντανά 2026-11-03: οι όψεις τιμών του καταλόγου έφευγαν
 * **χωρίς** κεφαλίδα, άρα ο browser και κάθε ενδιάμεσος μπορούσαν να κρατήσουν **τιμές ενός κοινού** (RFC 9111 §4.2.2:
 * χωρίς ρητή διάρκεια επιτρέπεται ευρετική φρεσκάδα). OWASP ASVS V8.2.1: ευαίσθητα δεδομένα με `no-store`.
 *
 * - `private`: κανένας κοινόχρηστος ενδιάμεσος (CDN, proxy) δεν το αποθηκεύει.
 * - `no-store`: ούτε ο browser (RFC 9111 §5.2.2.5) — άρα ούτε στο «πίσω» μετά από αποσύνδεση.
 *
 * ⚠️ Ο δρόμος με το χέρι (`'no-store'` γραμμένο σε κάθε route) υπάρχει ακόμη σε ~40 αρχεία έξω από τον κατάλογο·
 * μεταφέρονται όταν αγγίζονται (`.claude-rules/pending-ratchet-work.md`). **Νέος κώδικας γράφει από εδώ.**
 *
 * **Layering**: leaf — χωρίς I/O.
 */

import type { NextResponse } from 'next/server';

/** Η τιμή της κεφαλίδας για απόκριση ενός συνδεδεμένου ανθρώπου. */
export const PRIVATE_NO_STORE = 'private, no-store';

/** Οι κεφαλίδες, έτοιμες για `NextResponse.json(body, { headers })`. */
export const PRIVATE_NO_STORE_HEADERS: Readonly<Record<'Cache-Control', string>> = { 'Cache-Control': PRIVATE_NO_STORE };

/**
 * Βάζει `private, no-store` **μόνο αν** η απόκριση δεν δήλωσε ήδη δική της πολιτική: ο route που ξέρει κάτι
 * αυστηρότερο ή ειδικότερο κερδίζει, ο route που δεν είπε τίποτα **δεν** μένει ποτέ χωρίς κεφαλίδα.
 */
export function withPrivateNoStore(response: NextResponse): NextResponse {
  if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', PRIVATE_NO_STORE);
  return response;
}

// =============================================================================
// ΔΗΛΩΜΕΝΗ ΠΟΛΙΤΙΚΗ ΑΝΑ ROUTE (ADR-603 §Ασπίδα · ADR-923 §23.5 Β2)
// =============================================================================

/**
 * Τι επιτρέπεται να κρατήσει **ο browser του ίδιου ανθρώπου** από μια **επιτυχή** απόκριση.
 *
 * - `no-store` — η προεπιλογή: τίποτα, πουθενά.
 * - `private` — μόνο ο browser, για `maxAgeSeconds`· `immutable` όταν το URL είναι εκδοχή (το περιεχόμενο δεν αλλάζει
 *   ποτέ κάτω από το ίδιο URL — RFC 8246). `maxAgeSeconds: 0` ⇒ `no-cache`: κρατά, αλλά ρωτά κάθε φορά (ETag).
 *
 * 🔑 **Δεν υπάρχει `public`, επίτηδες.** Κάθε route του `defineRoute` απαντά σε **συνδεδεμένο** άνθρωπο με cookie
 * συνεδρίας. Το RFC 9111 §3.5 προστατεύει από κοινόχρηστη αποθήκευση μόνο τα αιτήματα με κεφαλίδα `Authorization`·
 * ένα αίτημα με cookie δεν προστατεύεται ⇒ `public` εδώ σημαίνει «το CDN δίνει τα δεδομένα του ενός στον άλλο».
 */
export type ResponseCachePolicy =
  | { readonly kind: 'no-store' }
  | { readonly kind: 'private'; readonly maxAgeSeconds: number; readonly immutable?: boolean };

/** Η προεπιλογή κάθε απόκρισης που δεν δήλωσε τίποτα. */
export const NO_STORE_POLICY: ResponseCachePolicy = { kind: 'no-store' };

/**
 * Η τιμή της κεφαλίδας για μια δηλωμένη πολιτική. Άκυρη διάρκεια (αρνητική, κλάσμα, NaN) ⇒ **σφάλμα στη δήλωση**,
 * όχι σιωπηλή διόρθωση: το route φορτώνει μόνο αν η πολιτική του σημαίνει κάτι.
 */
export function cacheControlOf(policy: ResponseCachePolicy): string {
  if (policy.kind === 'no-store') return PRIVATE_NO_STORE;
  const { maxAgeSeconds, immutable } = policy;
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 0) {
    throw new RangeError(`Cache policy maxAgeSeconds must be a non-negative integer, got ${maxAgeSeconds}`);
  }
  if (maxAgeSeconds === 0) return 'private, no-cache';
  return immutable ? `private, max-age=${maxAgeSeconds}, immutable` : `private, max-age=${maxAgeSeconds}`;
}

/**
 * Η κεφαλίδα που **πρέπει** να φέρει μια απόκριση με αυτή την κατάσταση: άρνηση ή σφάλμα (≥400) ⇒ **πάντα**
 * `private, no-store`, ό,τι κι αν δήλωσε το route. Ένα 404 είναι ευρετικά αποθηκεύσιμο (RFC 9110 §15.1 · RFC 9111
 * §4.2.2) — χωρίς κεφαλίδα θα επέζησε της διόρθωσης που το έκανε 200.
 */
export function cacheControlFor(status: number, policy: ResponseCachePolicy): string {
  return status >= 400 ? PRIVATE_NO_STORE : cacheControlOf(policy);
}
