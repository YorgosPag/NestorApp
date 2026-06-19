/**
 * Column placement ghost-status — pure SSoT (ADR-398 §Column→Beam axis snap, §ghost coloring).
 *
 * Κατά την τοποθέτηση κολώνας (freehand), δίνει **σημασιολογικό status** ανάλογα με το τι
 * βρίσκεται κάτω από το σταυρόνημα, ώστε το ghost να χρωματίζεται (Revit/AutoCAD pattern):
 *   · `beam`    → ο cursor κουμπώνει στον **άξονα** δοκαριού (το ενιαίο snap pipeline —
 *                 `NearestSnapEngine` `bim-beam` — έχει ήδη snap-άρει εκεί). Ghost = 🟢, η
 *                 κολώνα τοποθετείται κεντραρισμένη στον άξονα (`useColumnTool` center-anchor).
 *   · `overlap` → ο cursor είναι μέσα σε footprint υπάρχουσας κολώνας (ή snap σε κολώνα) →
 *                 σύγκρουση/επικάλυψη. Ghost = 🔴 (προειδοποίηση, τοποθετείται ακόμη).
 *   · `neutral` → ελεύθερη τοποθέτηση.
 *
 * **Thin reader (ADR-398 bugfix 2026-06-19):** το status παράγεται από το ΑΠΟΤΕΛΕΣΜΑ του
 * ενιαίου snap (`snapResult.snapPoint.entityId`) + ένα light footprint-overlap έλεγχο — ΟΧΙ
 * από παράλληλη ανίχνευση δοκαριού. Έτσι το snap pipeline (γλυφές + ετικέτες) δεν καταπνίγεται.
 *
 * Pure — zero React/DOM/Firestore. Reuse `isColumnEntity`/`isBeamEntity` (type SSoT) +
 * `isPointInPolygon` (hit-test SSoT). Μονάδες: scene units (worldPos + entities ομοιόμορφα).
 *
 * @see ../beams/beam-axis-projection.ts — projectPointOnBeamAxis (NearestSnapEngine beam SSoT)
 * @see ../../systems/cursor/snap-scheduler.ts — move-path consumer (ghost status)
 * @see ../../systems/cursor/ColumnPlacementGhostStatusStore.ts — το zero-React store
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { ColumnGhostStatus } from '../../systems/cursor/ColumnPlacementGhostStatusStore';

/** Η πρώτη υπάρχουσα κολώνα της οποίας το footprint περιέχει τον cursor (`null` αν καμία). */
export function findColumnOverlap(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
): string | null {
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const verts = e.geometry?.footprint?.vertices;
    if (verts && verts.length >= 3 && isPointInPolygon(worldPos, verts as Point2D[])) {
      return e.id;
    }
  }
  return null;
}

/**
 * Παράγει το ghost status από το ΑΠΟΤΕΛΕΣΜΑ του ενιαίου snap (thin reader, ΕΝΑ SSoT).
 *
 * Precedence **overlap > beam > neutral**:
 *   · footprint υπάρχουσας κολώνας **ή** snap σε κολώνα → `overlap` (🔴 — μην βάλεις διπλή·
 *     ισχύει ΑΚΟΜΗ κι όταν από κάτω περνά δοκάρι, π.χ. ενδιάμεση κολώνα στη μέση δοκαριού).
 *   · αλλιώς snap σε δοκάρι (`NearestSnapEngine` beam-axis) → `beam` (🟢).
 *   · αλλιώς → `neutral`. Pure.
 *
 * @param snapEntityId το `snapResult.snapPoint?.entityId` του ενιαίου snap (ή null).
 */
export function resolveColumnGhostStatusFromSnap(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
  snapEntityId: string | null | undefined,
): ColumnGhostStatus {
  const snapped = snapEntityId
    ? entities.find((e) => e.id === snapEntityId) ?? null
    : null;
  if (findColumnOverlap(worldPos, entities) || (snapped && isColumnEntity(snapped))) {
    return 'overlap';
  }
  if (snapped && isBeamEntity(snapped)) {
    return 'beam';
  }
  return 'neutral';
}
