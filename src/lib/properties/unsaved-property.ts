/**
 * @fileoverview **Το ακίνητο που δεν σώθηκε ακόμη** — ο ΕΝΑΣ ορισμός του δείκτη θέσης `'__new__'`.
 * @related ADR-920 Β4.7 · hooks/energy-certificate/useEnergyCertificateImportPorts · lib/terrain/publication/terrain-publish-target
 * @module lib/properties/unsaved-property
 *
 * Η φόρμα δημιουργίας (`PropertyFieldsBlock`) κρατά το ακίνητο με id `'__new__'` ώσπου να σωθεί. Τέτοιο ακίνητο δεν έχει
 * έγγραφα, πόρτες υλικού ή αγγελία ⇒ όποια θύρα ρωτά «πού ανεβαίνει;» απαντά `null` και η οθόνη δεν δείχνει κουμπί.
 * ⚠️ Υπάρχουν ακόμη χειρόγραφα `'__new__'` — μεταφέρονται εδώ στο άγγιγμα (`.claude-rules/pending-ratchet-work.md`).
 */

export const UNSAVED_PROPERTY_ID = '__new__';

/** Έχει το ακίνητο πραγματική ταυτότητα στη βάση; (`undefined` / `null` / κενό / δείκτης θέσης ⇒ όχι.) */
export function isPersistedPropertyId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id !== '' && id !== UNSAVED_PROPERTY_ID;
}
