/**
 * @fileoverview **«Αποθήκευσε αυτό ως αρχείο, με αυτό το όνομα»** — RFC 6266 + RFC 5987, γραμμένο μία φορά.
 * @related app/api/download/route.ts · app/api/pro/[companyId]/locations/[locationId]/vcard/route.ts
 * @module lib/http/content-disposition
 *
 * 🔴 **ΓΙΑΤΙ ΔΥΟ ΟΝΟΜΑΤΑ**: το `filename="…"` δέχεται **μόνο** ASCII· ένα ελληνικό όνομα εκεί φτάνει ως
 * ακατάληπτα bytes στον έναν φυλλομετρητή και κόβεται στον άλλο. Το `filename*=UTF-8''…` (RFC 5987) το
 * διαβάζουν όλοι οι σύγχρονοι· το ASCII μένει ως εφεδρεία για όσους δεν το διαβάζουν.
 *
 * ⚠️ **Το εισαγωγικό και η ανάστροφη κάθετος αντικαθίστανται στην εφεδρεία** — αλλιώς ένα όνομα με `"`
 * κλείνει το πεδίο νωρίς και ό,τι ακολουθεί διαβάζεται ως **άλλη παράμετρος** της κεφαλίδας.
 *
 * ⚠️ Το `encodeURIComponent` αφήνει ακωδικοποίητα τα `' ( ) *`, που το RFC 5987 **δεν** επιτρέπει στο
 * `attr-char` — κωδικοποιούνται εδώ. Ιδιαίτερα το `'` είναι ο διαχωριστής `UTF-8''`.
 *
 * **Layering**: leaf.
 */

const RFC5987_EXTRA = /['()*]/g;

function rfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    RFC5987_EXTRA,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** **Κεφαλίδα `Content-Disposition` για λήψη** — ελληνικό όνομα αρχείου χωρίς απώλειες. */
export function attachmentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987(filename)}`;
}
