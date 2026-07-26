/**
 * ADR-712 — «κοντόστυλο» θεμελίωσης → child BOQ row. Pure factory.
 *
 * Τρίτο flavor children δίπλα στο `boq-multi-layer-builder` (per-DNA-layer) και το
 * `structural-finish-boq` (per-material σοβάς): μία κολώνα που εδράζεται σε πέδιλο κρεμάει
 * **ένα** επιπλέον child στο ίδιο group parent — τον όγκο από την άνω παρειά του πεδίλου ως
 * τη nominal βάση της, με άρθρο **θεμελίων** (`OIK-2.07`) αντί ανωδομής (`OIK-2.03`).
 *
 * Ο parent κρατά τον όγκο **ανωδομής** (net) — αμετάβλητος. `gross = parent + αυτό το
 * child` (IFC GrossVolume). Το πέδιλο δεν αγγίζεται: η κολώνα σταματά ΣΤΗΝ άνω παρειά του,
 * άρα μηδέν επικάλυψη, μηδέν διπλομέτρηση.
 *
 * @see ../geometry/column-foundation-stub.ts — το σχήμα ποσοτήτων
 * @see structural-finish-boq.ts — ο δίδυμος (σοβάς)· ίδιο group-parent, συνυπάρχουν
 */

import { resolveColumnFoundationStubMapping } from '../config/bim-to-atoe-mapping';
import type { ColumnFoundationStubQuantities } from '../geometry/column-foundation-stub';
import { hasFoundationStub } from '../geometry/column-foundation-stub';
import {
  buildGroupChildBoqRow,
  type BoqBaseRowContext,
  type BoqSourceEntityType,
  type BuiltBoqRow,
} from './boq-base-row';

/**
 * Deterministic child id. Σταθερό suffix (όχι materialId-keyed όπως ο σοβάς): υπάρχει
 * **το πολύ ένα** κοντόστυλο ανά κολώνα — η βάση της είναι μία.
 */
export function foundationStubChildBoqId(entityId: string): string {
  return `boq_bim_${entityId}_foundation_stub`;
}

/**
 * Όλα τα υποψήφια child ids (0 ή 1) — mirror του `finishChildBoqIds`, ώστε το bridge να
 * κάνει ΕΝΑ combined fetch των row states (detach guard + createdAt preservation).
 */
export function foundationStubChildBoqIds(
  entityId: string,
  stub: ColumnFoundationStubQuantities | undefined,
): string[] {
  return hasFoundationStub(stub) ? [foundationStubChildBoqId(entityId)] : [];
}

/**
 * Build το child row του κοντόστυλου. `null` όταν δεν υπάρχει έδραση σε πέδιλο (μηδενικός
 * όγκος) → το bridge πέφτει στο single-entry path, byte-for-byte όπως πριν.
 */
export function buildFoundationStubChild(
  entityId: string,
  entityType: BoqSourceEntityType,
  parentId: string,
  stub: ColumnFoundationStubQuantities | undefined,
  context: BoqBaseRowContext,
  existingCreatedAt: string | null,
): BuiltBoqRow | null {
  if (!hasFoundationStub(stub)) return null;
  return buildGroupChildBoqRow(
    foundationStubChildBoqId(entityId),
    context,
    entityId,
    entityType,
    parentId,
    resolveColumnFoundationStubMapping(),
    stub.stubVolumeM3,
    existingCreatedAt,
  );
}
