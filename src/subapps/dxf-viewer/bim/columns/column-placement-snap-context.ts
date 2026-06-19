/**
 * Column placement snap-context — pure SSoT (ADR-398 §Column→Beam axis snap).
 *
 * Κατά την τοποθέτηση κολώνας (freehand), δίνει **σημασιολογικό context** ανάλογα με
 * το τι βρίσκεται κάτω από το σταυρόνημα, ώστε το ghost να χρωματίζεται (Revit/AutoCAD
 * pattern) και η κολώνα να **κουμπώνει στον άξονα δοκαριού**:
 *   · `beam`    → ο cursor είναι πάνω στο σώμα δοκαριού → snap στον **άξονά** του (κάθετη
 *                 προβολή), η κολώνα τοποθετείται κεντραρισμένη εκεί (κέντρο ≡ άξονας δοκού).
 *                 Ghost = 🟢 πράσινο.
 *   · `overlap` → ο cursor είναι μέσα σε υπάρχουσα κολώνα → σύγκρουση/επικάλυψη.
 *                 Ghost = 🔴 κόκκινο (προειδοποίηση, τοποθετείται ακόμη).
 *   · `neutral` → ελεύθερη τοποθέτηση.
 *
 * Pure — zero React/DOM/Firestore. Reuse `projectPointOnAxis` (SSoT προβολής) +
 * `isPointInPolygon` (SSoT hit-test). Μονάδες: scene units (worldPos + entities ομοιόμορφα).
 *
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPointOnAxis (reuse)
 * @see ../../systems/cursor/snap-scheduler.ts — move-path consumer (ghost status + snap)
 * @see ../../systems/cursor/mouse-handler-up.ts — commit-path consumer (snap point)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-body-corner-projection-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import type { BeamEntity } from '../types/beam-types';
import { projectPointOnAxis } from '../geometry/shared/polygon-axis-projection';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

/**
 * Συντελεστής σύλληψης: ο cursor θεωρείται «πάνω στο δοκάρι» όταν η κάθετη απόστασή του
 * από τον άξονα ≤ `halfWidth · CAPTURE` (1.5 → λίγο πιο γενναιόδωρα από την παρειά, ώστε
 * το hover να μην απαιτεί χιλιοστική ακρίβεια). Unit-agnostic (πολλαπλάσιο του πλάτους).
 */
const BEAM_AXIS_CAPTURE = 1.5;

/** Snap στον άξονα δοκαριού: σημείο (στον centerline) + το beam id. */
export interface ColumnBeamAxisSnap {
  readonly point: Point2D;
  readonly beamId: string;
}

/**
 * Πλησιέστερο δοκάρι του οποίου το **σώμα** καλύπτει τον cursor → κάθετη προβολή στον
 * άξονά του (clamped στο segment — όχι προέκταση). Νικά το μικρότερο κάθετο. `null` όταν
 * ο cursor δεν είναι πάνω σε κανένα δοκάρι.
 */
export function findColumnBeamAxisSnap(
  worldPos: Readonly<Point2D>,
  beams: readonly BeamEntity[],
): ColumnBeamAxisSnap | null {
  let best: ColumnBeamAxisSnap | null = null;
  let bestPerp = Infinity;
  for (const beam of beams) {
    const s = beam.params.startPoint;
    const e = beam.params.endPoint;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const { along, perp } = projectPointOnAxis(worldPos.x, worldPos.y, s.x, s.y, ux, uy);
    if (along < 0 || along > len) continue; // εκτός ανοίγματος (όχι προέκταση)
    const capture = ((beam.params.width ?? 0) / 2) * BEAM_AXIS_CAPTURE;
    if (perp > capture || perp >= bestPerp) continue;
    bestPerp = perp;
    best = { point: { x: s.x + ux * along, y: s.y + uy * along }, beamId: beam.id };
  }
  return best;
}

/** Σημασιολογικό context τοποθέτησης κολώνας κάτω από τον cursor. */
export type ColumnPlacementContext =
  | { readonly status: 'beam'; readonly point: Point2D; readonly beamId: string }
  | { readonly status: 'overlap'; readonly columnId: string }
  | { readonly status: 'neutral' };

/**
 * Resolve του context: **δοκάρι πάντα νικά** (η ρητή «hover→place» πρόθεση)· αλλιώς αν ο
 * cursor είναι μέσα σε footprint υπάρχουσας κολώνας → `overlap`· αλλιώς `neutral`. Pure.
 */
export function resolveColumnPlacementContext(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
): ColumnPlacementContext {
  const beams = entities.filter(isBeamEntity);
  const beamSnap = findColumnBeamAxisSnap(worldPos, beams);
  if (beamSnap) {
    return { status: 'beam', point: beamSnap.point, beamId: beamSnap.beamId };
  }
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const verts = e.geometry?.footprint?.vertices;
    if (verts && verts.length >= 3 && isPointInPolygon(worldPos, verts as Point2D[])) {
      return { status: 'overlap', columnId: e.id };
    }
  }
  return { status: 'neutral' };
}
