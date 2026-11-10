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

import { samePropertyFieldValue } from '@/lib/property/property-field-change';

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

/**
 * Πόσα ξέρει ο καλών για την τρέχουσα κατάσταση:
 * - `document` — ολόκληρο το αποθηκευμένο έγγραφο (server): πεδίο που λείπει ΕΙΝΑΙ «δεν δηλώθηκε».
 * - `partial` — μερική εικόνα (πελάτης, π.χ. μόνο `commercialStatus`): πεδίο που λείπει είναι **άγνωστο** ⇒ κρίνεται
 *   ως αλλαγή (fail-closed). Αλλιώς ένα `null` πάνω σε τιμή που απλώς δεν δόθηκε θα έμοιαζε «ίδιο».
 */
export interface LockedFieldCurrentState {
  readonly kind: 'document' | 'partial';
  readonly values: object;
}

/** Το αποτέλεσμα του κριτή: τι **αλλάζει** (⇒ άρνηση) και τι στάλθηκε **αμετάβλητο** (⇒ αγνοείται). */
export interface LockedFieldJudgement {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
}

/**
 * **Κλείδωμα κατά ΑΛΛΑΓΗ ΤΙΜΗΣ, όχι κατά παρουσία κλειδιού** (ADR-249 §7 · Google AIP-203 IMMUTABLE): κλειδωμένο
 * πεδίο που στάλθηκε με την **ίδια** τιμή δεν είναι απόπειρα αλλαγής — αγνοείται· με **άλλη** τιμή ⇒ σαφές σφάλμα.
 * Η σύγκριση είναι του ΕΝΟΣ κριτή `samePropertyFieldValue` — ο ίδιος με τη φόρμα και το ιστορικό.
 */
export function judgeLockedFields(
  commercialStatus: string | null | undefined,
  updates: object,
  current: LockedFieldCurrentState,
): LockedFieldJudgement {
  const attempted = lockedFieldsAttempted(commercialStatus, Object.keys(updates));
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const field of attempted) {
    const known = current.kind === 'document' || Object.prototype.hasOwnProperty.call(current.values, field);
    const before = Object.getOwnPropertyDescriptor(current.values, field)?.value;
    const after = Object.getOwnPropertyDescriptor(updates, field)?.value;
    (known && samePropertyFieldValue(field, after, before) ? unchanged : changed).push(field);
  }
  return { changed, unchanged };
}

/** Κλειδώνει η κατάσταση αυτό το ένα πεδίο; (για οθόνες που κρίνουν πριν δείξουν χειριστήριο) */
export function isFieldLocked(commercialStatus: string | null | undefined, field: string): boolean {
  return lockedFieldsAttempted(commercialStatus, [field]).length > 0;
}
