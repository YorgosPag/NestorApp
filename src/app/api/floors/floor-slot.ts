import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  FLOOR_SLOT_ERROR_CODES,
  judgeFloorSlot,
  type FloorSlotCandidate,
  type FloorSlotChecks,
  type FloorSlotClash,
  type FloorSlotRow,
} from '@/lib/floor/floor-stack-integrity';

/**
 * ADR-461 — **η άρνηση** του κανόνα μοναδικότητας: ετυμηγορία → `409` με `errorCode`.
 *
 * 🔑 Ο κανόνας ζει στο `lib/floor/floor-stack-integrity.ts` (καθαρός, κοινός με τον πελάτη)· εδώ μόνο η μετάφρασή του
 * σε απάντηση HTTP. **Δεν διαβάζει τη βάση**: τα αδέλφια τα δίνει το σύνορο της στοίβας (`floor-stack-authority.ts`),
 * διαβασμένα **μέσα στη συναλλαγή** που θα γράψει.
 *
 * 🔴 Ως τις 2026-10-10 αυτή η συνάρτηση έκανε η ίδια το ερώτημα, **έξω** από συναλλαγή ⇒ δύο ταυτόχρονα αιτήματα
 * περνούσαν και τα δύο. Και ως τις 2026-10-03 ζούσε μόνο στη δημιουργία (η επεξεργασία αριθμού δεν ρωτούσε).
 *
 * @throws {ApiError} 409 όταν η θέση ή το όνομα είναι πιασμένα — `details.conflictingFloorId` = με ποιον
 */
export function assertFloorSlotFree(
  siblings: readonly FloorSlotRow[],
  candidate: FloorSlotCandidate,
  buildingId: string,
  checks?: FloorSlotChecks,
  excludeFloorId?: string,
): void {
  const verdict = judgeFloorSlot(siblings, candidate, checks, excludeFloorId);
  if (verdict === null) return;
  throw new ApiError(409, refusalMessage(verdict.clash, candidate, buildingId), FLOOR_SLOT_ERROR_CODES[verdict.clash], {
    conflictingFloorId: verdict.withFloorId,
  });
}

/** Μήνυμα για τα logs και τους προγραμματιστές — ο άνθρωπος βλέπει τη μετάφραση του `errorCode`. */
function refusalMessage(clash: FloorSlotClash, candidate: FloorSlotCandidate, buildingId: string): string {
  if (clash === 'kind') return `A ${candidate.kind} special level already exists in building ${buildingId}`;
  if (clash === 'name') return `Floor name "${candidate.name}" already exists in building ${buildingId}`;
  return `Floor number ${candidate.number} already exists in building ${buildingId}`;
}
