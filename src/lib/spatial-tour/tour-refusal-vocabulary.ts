/**
 * @fileoverview **ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΑΡΝΗΣΕΩΝ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — όσα μπορεί να πει ο διακομιστής στο σώμα `TOUR_REFUSED`.
 * @related ADR-884 §4.5 (Κ3α) · `server/spatial-tour/tour-capture-upload.ts` (`TourUploadRefusal`) · `app/api/spatial-tours/_shared`
 * @module lib/spatial-tour/tour-refusal-vocabulary
 *
 * 🔑 **Γιατί υπάρχει ως τιμή, όχι μόνο ως τύπος**: η οθόνη διαβάζει τον λόγο από **δίκτυο** — ένα `as` πάνω σε
 * ανεπαλήθευτο string θα ήταν ψέμα τύπων. Ο φρουρός {@link isTourRefusalName} είναι το σύνορο του πελάτη.
 * 🔒 Ο διακομιστής **δεσμεύεται** να λέει ακριβώς αυτά: η άγκυρα (`tour-refusal-vocabulary.test.ts`) συγκρίνει
 * το σύνολο με τον πίνακα HTTP της διαδρομής (`Record<TourUploadRefusal, …>`) — απόκλιση κοκκινίζει.
 *
 * **Layering**: leaf.
 */

export const TOUR_REFUSALS = [
  // ── Η περιήγηση και η πόρτα του υπευθύνου ──
  'tour-absent', 'not-requestable', 'not-manager', 'expiry-required', 'expiry-past', 'expiry-too-far',
  'request-absent', 'not-pending', 'not-active', 'reason-required', 'grant-absent', 'tour-custody-mismatch',
  'tour-unreadable',
  // ── Η πύλη θέασης και οι ρυθμίσεις (Κ3β) ──
  'sign-in-required', 'not-viewable', 'publish-needs-capture', 'visibility-unsupported',
  // ── Ο κριτής ανεβάσματος ──
  'no-capture-grant', 'revoked', 'expired', 'unreadable-expiry', 'scope-missing',
  // ── Τα bytes ──
  'not-jpeg', 'too-large', 'not-equirect', 'too-small', 'wrong-projection',
  // ── Η ροή ανεβάσματος ──
  'ticket-invalid', 'ticket-foreign', 'upload-missing', 'upload-incomplete', 'declaration-invalid',
] as const;

export type TourRefusalName = (typeof TOUR_REFUSALS)[number];

export function isTourRefusalName(value: unknown): value is TourRefusalName {
  return typeof value === 'string' && (TOUR_REFUSALS as readonly string[]).includes(value);
}
