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
 * Pure — zero React/DOM/Firestore. Reuse `projectPointOnBeamAxisDetailed` (SSoT προβολής
 * δοκαριού, κοινό με `NearestSnapEngine`) + `isPointInPolygon` (SSoT hit-test). Μονάδες:
 * scene units (worldPos + entities ομοιόμορφα).
 *
 * @see ../beams/beam-axis-projection.ts — projectPointOnBeamAxisDetailed (SSoT, reuse)
 * @see ../../systems/cursor/snap-scheduler.ts — move-path consumer (ghost status + snap)
 * @see ../../systems/cursor/mouse-handler-up.ts — commit-path consumer (snap point)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-body-corner-projection-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import type { BeamEntity } from '../types/beam-types';
import { projectPointOnBeamAxisDetailed } from '../beams/beam-axis-projection';
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
 * Πλησιέστερο δοκάρι του οποίου το **σώμα** καλύπτει τον cursor → το σημείο στον άξονά
 * του (μέσω του SSoT `projectPointOnBeamAxisDetailed` — ίδιο με τον `NearestSnapEngine`).
 * Νικά το μικρότερο κάθετο. Απορρίπτεται όταν ο cursor είναι **πέρα** από τα άκρα
 * (`atEndpoint`) ή εκτός width-capture. `null` όταν δεν είναι πάνω σε κανένα δοκάρι.
 */
export function findColumnBeamAxisSnap(
  worldPos: Readonly<Point2D>,
  beams: readonly BeamEntity[],
): ColumnBeamAxisSnap | null {
  let best: ColumnBeamAxisSnap | null = null;
  let bestDistance = Infinity;
  for (const beam of beams) {
    const proj = projectPointOnBeamAxisDetailed(beam, worldPos);
    if (!proj || proj.atEndpoint) continue; // πάνω στο σώμα, όχι πέρα από τα άκρα
    const capture = ((beam.params.width ?? 0) / 2) * BEAM_AXIS_CAPTURE;
    if (proj.distance > capture || proj.distance >= bestDistance) continue;
    bestDistance = proj.distance;
    best = { point: proj.foot, beamId: beam.id };
  }
  return best;
}

/** Σημασιολογικό context τοποθέτησης κολώνας κάτω από τον cursor. */
export type ColumnPlacementContext =
  | { readonly status: 'beam'; readonly point: Point2D; readonly beamId: string }
  | { readonly status: 'overlap'; readonly columnId: string }
  | { readonly status: 'neutral' };

/** Η πρώτη υπάρχουσα κολώνα της οποίας το footprint περιέχει τον cursor (`null` αν καμία). */
function findColumnOverlap(
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
 * Resolve του context. **Overlap νικά**: αν ο cursor είναι μέσα σε footprint υπάρχουσας
 * κολώνας → `overlap` (🔴 — μην βάλεις διπλή στην ίδια θέση· ισχύει ΑΚΟΜΗ κι όταν από κάτω
 * περνά δοκάρι, π.χ. ενδιάμεση κολώνα στη μέση δοκαριού). Αλλιώς, πάνω σε **κενό** σώμα
 * δοκαριού → `beam` (🟢 snap στον άξονα). Αλλιώς `neutral`. Pure.
 */
export function resolveColumnPlacementContext(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
): ColumnPlacementContext {
  const overlapId = findColumnOverlap(worldPos, entities);
  if (overlapId) {
    return { status: 'overlap', columnId: overlapId };
  }
  const beams = entities.filter(isBeamEntity);
  const beamSnap = findColumnBeamAxisSnap(worldPos, beams);
  if (beamSnap) {
    return { status: 'beam', point: beamSnap.point, beamId: beamSnap.beamId };
  }
  return { status: 'neutral' };
}
