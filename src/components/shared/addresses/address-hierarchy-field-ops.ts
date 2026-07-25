/**
 * =============================================================================
 * ADDRESS HIERARCHY FIELD OPS — pure write/format primitives (ADR-332)
 * =============================================================================
 *
 * Εξήχθη από το `AddressWithHierarchy.tsx` (N.7.1: το component ξεπέρασε τις
 * 500 γραμμές). Εδώ ζει ό,τι είναι **καθαρή συνάρτηση πάνω στην τιμή** —
 * μορφοποίηση Τ.Κ., κανονικοποίηση ονομάτων από geocoding, και τα δύο
 * primitives εγγραφής της ιεραρχίας. Καμία εξάρτηση από React.
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
import { PATH_TO_VALUE, type AddressWithHierarchyValue } from './address-with-hierarchy-config';

// =============================================================================
// POSTAL CODE HELPERS
// =============================================================================

/** Format Greek postal code as "XXX YY" (e.g. "56334" → "563 34"). */
export function formatGreekPostalCode(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 5);
  if (digits.length > 3) return `${digits.substring(0, 3)} ${digits.substring(3)}`;
  return digits;
}

/** Strip space from postal code for numeric comparisons ("563 34" → "56334"). */
export function normalizePostalCode(value: string): string {
  return value.replace(/\s/g, '').trim();
}

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
        target.postalCode = formatGreekPostalCode(entity.postalCode);
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
