/**
 * Τα μηνύματα της στοίβας ορόφων — άρνηση του διακομιστή και συγκρούσεις που υπάρχουν ήδη στα δεδομένα.
 *
 * 🔑 Η ανίχνευση είναι ο **ίδιος** κανόνας που εφαρμόζει ο διακομιστής στην εγγραφή
 * (`lib/floor/floor-stack-integrity.ts`)· εδώ μόνο η μετάφρασή του σε κείμενο για τον άνθρωπο.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): (α) ένα κτίριο με δύο «Ισόγειο» έδειχνε δύο πανομοιότυπες γραμμές και **κανένα**
 * μήνυμα — οι προειδοποιήσεις συνέχειας έβλεπαν μόνο κενά στην αρίθμηση· (β) κάθε `409` της επεξεργασίας έβγαινε ως
 * «σύγκρουση εκδόσεων», ακόμη κι όταν ο αριθμός ήταν απλώς πιασμένος.
 *
 * @module components/building-management/tabs/floor-stack-messages
 */

import type { Translate } from '@/i18n/hooks/useTranslation';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import {
  FLOOR_SLOT_ERROR_CODES,
  findFloorStackConflicts,
  findSameElevationGroups,
  isFloorSlotErrorCode,
  type FloorSlotClash,
  type FloorSlotErrorCode,
  type FloorSlotRow,
} from '@/lib/floor/floor-stack-integrity';

/** Το κλειδί i18n κάθε άρνησης μοναδικότητας. */
const REFUSAL_KEYS: Record<FloorSlotErrorCode, string> = {
  [FLOOR_SLOT_ERROR_CODES.number]: 'tabs.floors.duplicateNumber',
  [FLOOR_SLOT_ERROR_CODES.kind]: 'tabs.floors.duplicateKind',
  [FLOOR_SLOT_ERROR_CODES.name]: 'tabs.floors.duplicateName',
};

/** Το κλειδί i18n κάθε σύγκρουσης που υπάρχει ήδη. */
const CONFLICT_KEYS: Record<FloorSlotClash, string> = {
  number: 'tabs.floors.conflictDuplicateNumber',
  kind: 'tabs.floors.conflictDuplicateKind',
  name: 'tabs.floors.conflictDuplicateName',
};

/**
 * Το κλειδί i18n μιας **άρνησης μοναδικότητας** του διακομιστή, ή `null` όταν το σφάλμα είναι κάτι άλλο
 * (π.χ. σύγκρουση εκδόσεων — επίσης `409`, αλλά άλλο `errorCode`).
 */
export function floorSlotRefusalKey(error: unknown): string | null {
  if (!ApiClientError.isApiClientError(error) || error.statusCode !== 409) return null;
  return isFloorSlotErrorCode(error.errorCode) ? REFUSAL_KEYS[error.errorCode] : null;
}

/** «Ισόγειο (0), Ισόγειο (0)» — τα μέλη μιας ομάδας, όπως τα αναγνωρίζει ο άνθρωπος. */
function describeFloors(floors: readonly FloorSlotRow[], ids: readonly string[]): string {
  return ids
    .map((id) => floors.find((floor) => floor.id === id))
    .map((floor) => (floor ? `${floor.name ?? ''} (${floor.number})` : ''))
    .filter((label) => label !== '')
    .join(', ');
}

/** Οι συγκρούσεις της στοίβας ως μηνύματα **σφάλματος** — κενό ⇒ η στοίβα τηρεί τον κανόνα. */
export function describeFloorStackConflicts(floors: readonly FloorSlotRow[], t: Translate): string[] {
  return findFloorStackConflicts(floors).map((conflict) =>
    t(CONFLICT_KEYS[conflict.clash], { floors: describeFloors(floors, conflict.floorIds) }),
  );
}

/** Οι ομάδες ορόφων στο ίδιο υψόμετρο ως **προειδοποιήσεις** (η Revit το επιτρέπει — δεν είναι σφάλμα). */
export function describeSameElevation(floors: readonly FloorSlotRow[], t: Translate): string[] {
  return findSameElevationGroups(floors).map((ids) =>
    t('tabs.floors.sameElevationWarning', { floors: describeFloors(floors, ids) }),
  );
}
