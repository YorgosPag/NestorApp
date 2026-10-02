/**
 * @fileoverview **Ποια πεδία κλειδώνει μια συναλλαγή** (ADR-249 P0-2) — η ΜΙΑ λίστα, για τον server
 * (`lib/firestore/property-field-locking.ts`, 403) **και** τον πελάτη (`services/property/property-mutation-gateway.ts`).
 * @module lib/property/property-locked-fields
 *
 * 🔴 **ΗΤΑΝ ΔΥΟ ΑΝΤΙΓΡΑΦΑ «keep both in sync»** (ADR-898 Φ3β-3, N.0.2): ο server και ο πελάτης κρατούσαν την ίδια
 * λίστα χειρόγραφα. Ένα πεδίο που μπαίνει στη μία και ξεχνιέται στην άλλη = φόρμα που επιτρέπει ό,τι ο server αρνείται
 * (ή το ανάποδο, χειρότερο). Καθαρό αρχείο, χωρίς I/O: το εισάγουν και οι δύο, ο καθένας ρίχνει το δικό του σφάλμα.
 *
 * Νόμιμη απαίτηση: μετά την πώληση/μίσθωση, ό,τι αναφέρεται σε συμβόλαια, κτηματολόγιο ή εφορία μένει αμετάβλητο.
 */

/** Κλειδωμένα σε πουλημένο ή μισθωμένο ακίνητο. */
export const SOLD_LOCKED_FIELDS = [
  'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
  'commercialStatus', 'buildingId', 'linkedSpaces',
  'orientations', 'condition', 'energy', 'systemsOverride',
  'finishes', 'interiorFeatures', 'securityFeatures',
  'levels', 'isMultiLevel', 'levelData',
  // ADR-898 Φ3β-3 — πρόσοψη, ημερομηνία άδειας, κοινόχρηστοι: φυσικά στοιχεία, ίδια μεταχείριση με `orientations`.
  'objectiveValueDeclarations',
] as const;

/** Κλειδωμένα σε κρατημένο ακίνητο — μόνο η ταυτότητα. */
export const RESERVED_LOCKED_FIELDS = ['code', 'type', 'name'] as const;

/** Ό,τι αλλάζει νόμιμα η ακύρωση συναλλαγής (reserved/sold → for-sale). */
export const REVERT_ALLOWED_FIELDS: ReadonlySet<string> = new Set(['commercialStatus', 'commercial']);

/** Οι καταστάσεις που κλειδώνουν όλη τη λίστα πώλησης. */
const SOLD_LOCKING_STATUSES: ReadonlySet<string> = new Set(['sold', 'rented']);

/** Ποια από τα `updateKeys` κλειδώνει η κατάσταση `commercialStatus`. Κενό = κανένα. */
export function lockedFieldsAttempted(
  commercialStatus: string | null | undefined,
  updateKeys: readonly string[],
): readonly string[] {
  if (!commercialStatus) return [];
  if (SOLD_LOCKING_STATUSES.has(commercialStatus)) return SOLD_LOCKED_FIELDS.filter((field) => updateKeys.includes(field));
  if (commercialStatus === 'reserved') return RESERVED_LOCKED_FIELDS.filter((field) => updateKeys.includes(field));
  return [];
}

/** Κλειδώνει η κατάσταση αυτό το ένα πεδίο; (για οθόνες που κρίνουν πριν δείξουν χειριστήριο) */
export function isFieldLocked(commercialStatus: string | null | undefined, field: string): boolean {
  return lockedFieldsAttempted(commercialStatus, [field]).length > 0;
}
