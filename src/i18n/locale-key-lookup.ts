/**
 * Ανάγνωση κλειδιού `a.b.c` μέσα σε locale bundle (JSON) — για κώδικα server και άγκυρες
 * που δεν περνούν από το i18next (ADR-901 Φ1).
 *
 * ⚠️ Το ίδιο `key.split('.').reduce(...)` υπάρχει αντιγραμμένο σε ~28 αρχεία (κυρίως tests)·
 *    η μετανάστευσή τους είναι καταγεγραμμένη στο `.claude-rules/pending-ratchet-work.md`.
 *    Νέος κώδικας χρησιμοποιεί ΑΥΤΟ.
 *
 * @module i18n/locale-key-lookup
 */

/** Η τιμή-κείμενο του κλειδιού, ή `undefined` αν λείπει / δεν είναι κείμενο. */
export function lookupLocaleString(bundle: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    bundle,
  );
  return typeof value === 'string' ? value : undefined;
}
