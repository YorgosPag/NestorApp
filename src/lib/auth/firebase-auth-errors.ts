/**
 * **«Δεν υπάρχει τέτοιος λογαριασμός»** — η ΜΙΑ αναγνώριση του σφάλματος του Firebase Admin Auth.
 *
 * 🔴 Μέχρι 2026-10-03 ο ίδιος έλεγχος ζούσε **αυτούσιος σε τρία αρχεία** (`revocation-watermark` ·
 * `auth-action-mail` · `citizen-identity`), σε τρεις ελαφρά διαφορετικές διατυπώσεις, και η ADR-862 Φ1 θα
 * έγραφε τέταρτο (εύρεση λογαριασμού επαγγελματία από email). Boy Scout (N.0.2).
 *
 * **Layering**: leaf — κανένα SDK, μόνο σχήμα σφάλματος.
 *
 * @module lib/auth/firebase-auth-errors
 */

/** Είναι αυτό το σφάλμα του Admin Auth το «ο λογαριασμός δεν υπάρχει» (`auth/user-not-found`); */
export function isAuthUserNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { readonly code?: unknown }).code === 'auth/user-not-found';
}
