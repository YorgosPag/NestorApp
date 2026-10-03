import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { isBuildingStorey, type FloorKind } from '@/utils/floor-naming';

/**
 * ADR-461 — **kind-aware μοναδικότητα** (Revit «Building Story» OFF για ειδικές στάθμες).
 *
 * Οι μετρούμενοι όροφοι κρατούν **μοναδικούς** αριθμούς μεταξύ τους· μια ειδική στάθμη
 * (θεμελίωση/δώμα/απόληξη) μπορεί νόμιμα να μοιράζεται αριθμό με μετρούμενο όροφο, αλλά υπάρχει
 * **μία** ανά είδος. Ένα ερώτημα (κανένας νέος σύνθετος δείκτης) + απόφαση στη μνήμη —
 * τα κτίρια έχουν λίγους ορόφους. 🔒 Με `companyId` του **κατόχου** (κτίριο/όροφος — όχι του καλούντα:
 * ο υπερδιαχειριστής γράφει σε ξένο κτίριο) ⇒ δείκτης `(buildingId, companyId)` υπάρχει ήδη (CHECK 3.35).
 *
 * 🔴 Ως τις 2026-10-03 ο κανόνας ζούσε **μόνο** στη δημιουργία: η **επεξεργασία** αριθμού δεν τον
 * ρωτούσε ⇒ δύο «1ος όροφος» στο ίδιο κτίριο, και ο cascade αναρίθμησης (ADR-903 §6) θα
 * έγραφε τον ίδιο αριθμό σε στοιχεία δύο διαφορετικών ορόφων. Ένας κανόνας, δύο καλούντες.
 *
 * @throws {ApiError} 409 όταν η θέση είναι πιασμένη
 */
export async function assertFloorSlotFree(
  db: Firestore,
  owner: { readonly buildingId: string; readonly companyId: string },
  slot: { readonly number: number; readonly kind?: FloorKind },
  excludeFloorId?: string,
): Promise<void> {
  const siblingsSnap = await db
    .collection(COLLECTIONS.FLOORS)
    .where(FIELDS.BUILDING_ID, '==', owner.buildingId)
    .where(FIELDS.COMPANY_ID, '==', owner.companyId)
    .select('number', 'kind')
    .get();
  const siblings = siblingsSnap.docs
    .filter((d) => excludeFloorId === undefined || d.id !== excludeFloorId)
    .map((d) => ({ number: d.data().number as number, kind: d.data().kind as FloorKind | undefined }));

  const isSpecial = slot.kind !== undefined && !isBuildingStorey(slot.kind);
  if (isSpecial) {
    if (siblings.some((s) => s.kind === slot.kind)) {
      throw new ApiError(409, `A ${slot.kind} special level already exists in building ${owner.buildingId}`);
    }
    return;
  }
  const clashesCounted = siblings.some(
    (s) => s.number === slot.number && (s.kind === undefined || isBuildingStorey(s.kind)),
  );
  if (clashesCounted) {
    throw new ApiError(409, `Floor number ${slot.number} already exists in building ${owner.buildingId}`);
  }
}
