/**
 * =============================================================================
 * ADDRESS HIERARCHY FIELD OPS — pure write/format primitives (ADR-332)
 * =============================================================================
 *
 * Εξήχθη από το `AddressWithHierarchy.tsx` (N.7.1: το component ξεπέρασε τις
 * 500 γραμμές). Εδώ ζει ό,τι είναι **καθαρή συνάρτηση πάνω στην τιμή** —
 * κανονικοποίηση ονομάτων από geocoding και τα δύο primitives εγγραφής της
 * ιεραρχίας. Καμία εξάρτηση από React.
 *
 * ⚠️ Οι συναρτήσεις Τ.Κ. **μετακόμισαν** στο `@/utils/address/postal-code`:
 * τις χρειάζονται πλέον και `types/`, και server-only μετάπτωση, και ένα
 * `types/ → components/` import θα ήταν ανάποδα (ADR-332 D16).
 *
 * ΓΙΑΤΙ ΕΝΑ ΣΗΜΕΙΟ: και οι δύο handlers επιλογής (οικισμός / επίπεδο ιεραρχίας)
 * έγραφαν τον ίδιο βρόχο πάνω στο `PATH_TO_VALUE`. Ο κανόνας «ταυτότητα και
 * όνομα γράφονται/καθαρίζονται ΜΑΖΙ» πρέπει να ζει σε ΕΝΑ σημείο — αν
 * αποκλίνουν, το UI δείχνει όνομα που δεν αντιστοιχεί σε καμία οντότητα.
 *
 * @module components/shared/addresses/address-hierarchy-field-ops
 * @see ADR-332 — Enterprise Address Editor System
 */

import type { AdminLevel, AdminPath } from '@/hooks/useAdministrativeHierarchy';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import { PATH_TO_VALUE, type AddressWithHierarchyValue } from './address-with-hierarchy-config';

// =============================================================================
// GEOCODED NAME NORMALISATION
// =============================================================================

/**
 * Strip Greek administrative prefixes from geocoded city names.
 * Nominatim returns e.g. "Δημοτική Ενότητα Ελευθερίου - Κορδελιού" but the
 * hierarchy DB stores "Ελευθέριο-Κορδελιό". Strip prefix so nameMatches can work.
 * Works on the NFC string — splits by space and drops known prefix words.
 */
const GREEK_ADMIN_PREFIX_WORDS = new Set([
  'δημοτική', 'δημοτικη', 'ενότητα', 'ενοτητα',
  'κοινότητα', 'κοινοτητα', 'δήμος', 'δημος',
]);

export function stripGreekAdminPrefix(name: string): string {
  const words = name.trim().split(/\s+/);
  const normalizeWord = (w: string) =>
    w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^α-ωa-z]/gi, '');
  let start = 0;
  while (start < words.length && GREEK_ADMIN_PREFIX_WORDS.has(normalizeWord(words[start]))) {
    start++;
  }
  return start > 0 && start < words.length ? words.slice(start).join(' ') : name;
}

// =============================================================================
// HIERARCHY WRITE PRIMITIVES
// =============================================================================

/**
 * Γράφει id + όνομα για κάθε κόμβο της αναλυμένης διαδρομής.
 * Ο οικισμός (level 8) δίνει επιπλέον Τ.Κ.
 *
 * @param clearLevelsDeeperThan όταν δοθεί, τα επίπεδα πιο ειδικά από αυτό που
 *   δεν καλύπτονται από τη διαδρομή καθαρίζονται (δεν μένουν ορφανά).
 */
export function applyResolvedPath(
  target: AddressWithHierarchyValue,
  path: AdminPath,
  clearLevelsDeeperThan?: AdminLevel,
): void {
  for (const mapping of PATH_TO_VALUE) {
    const entity = path[mapping.pathKey];
    if (entity) {
      (target[mapping.idField] as string | null) = entity.id;
      (target[mapping.nameField] as string) = entity.name;
      if (mapping.level === 8 && entity.postalCode) {
        // ΚΑΝΟΝΙΚΗ μορφή στο μοντέλο (ADR-332 D16) — η μορφοποίηση «546 24»
        // ανήκει στο render. Γραμμένη εδώ, κατέληγε αυτούσια στο Firestore και
        // έσπαγε κάθε σύγκριση με το dataset ιεραρχίας (0 εγγραφές με κενό).
        target.postalCode = toCanonicalGreekPostalCode(entity.postalCode);
      }
    } else if (clearLevelsDeeperThan !== undefined && mapping.level > clearLevelsDeeperThan) {
      (target[mapping.idField] as string | null) = null;
      (target[mapping.nameField] as string) = '';
    }
  }
}

/** Καθαρίζει id + όνομα για κάθε επίπεδο που ταιριάζει στο κριτήριο. */
export function clearHierarchyLevels(
  target: AddressWithHierarchyValue,
  shouldClear: (level: AdminLevel) => boolean,
): void {
  for (const mapping of PATH_TO_VALUE) {
    if (shouldClear(mapping.level)) {
      (target[mapping.idField] as string | null) = null;
      (target[mapping.nameField] as string) = '';
    }
  }
}
