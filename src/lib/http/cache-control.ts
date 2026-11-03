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
