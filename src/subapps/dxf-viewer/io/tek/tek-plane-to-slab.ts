/**
 * ADR-531 Φ5b.4 (Tekton .TEK IMPORT — BIM slab) — mapper `TekPlaneRecord` → **native BIM** `SlabEntity`.
 *
 * Ο Τέκτων εξάγει τη δομική πλάκα ως `<plane>` (type 10): footprint polygon (`<point3d>`) + `<width>`
 * (πάχος εξώθησης) + `<elev1>` (στάθμη βάσης). Ο mapper το μετατρέπει σε δική μας παραμετρική πλάκα
 * (ΜΙΑ οντότητα, δύο όψεις — 3Δ όγκος + 2Δ κάτοψη· ίδιο pattern με τον τοίχο Φ5b.2).
 *
 * Reuse (μηδέν geometry/builder duplication — μοτίβο `tek-wall-to-bim`):
 *   - Y-flip + units → SSoT `tekMetersToScene`.
 *   - slab build → `completeSlabFromPolygonClicks` (`buildDefaultSlabParams` + `buildSlabEntity`).
 *   - χρώμα → SSoT `tekColorToHex`.
 *
 * @module io/tek/tek-plane-to-slab
 */

import { type SceneUnits } from '../../utils/scene-units';
import { tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { tekColorToHex } from './tek-color';
import {
  completeSlabFromPolygonClicks,
  type SlabParamOverrides,
} from '../../hooks/drawing/slab-completion';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { Point2D } from '../../rendering/types/Types';
import type { TekPlaneRecord } from './tek-import-types';

/** Αποτέλεσμα mapping μιας `<plane>`: η BIM πλάκα (ή `null` αν απορριφθεί) + προειδοποιήσεις. */
export interface TekSlabResult {
  readonly slab: SlabEntity | null;
  readonly warnings: readonly string[];
}

/**
 * Map ενός `TekPlaneRecord` → BIM `SlabEntity`. Footprint → scene (Y-flip)· `width`→πάχος (mm)·
 * `elev1`→`levelElevation` (mm)· χρώμα `tekColorToHex`. Αποτυχία builder → warning + `null`.
 */
export function tekPlaneToSlabEntity(
  rec: TekPlaneRecord,
  levelId: string,
  sceneUnits: SceneUnits = 'mm',
): TekSlabResult {
  const warnings: string[] = [];
  const vertices: Point2D[] = rec.vertices.map((v) => tekMetersToScene(v.x, v.y, sceneUnits));
  // Στάθμη: `elev1` όταν ορίζεται· αλλιώς (stair-generated πλάκες με elev1=0) το πραγματικό Z του
  // polygon — ώστε τα «ψωμιά» μπετού κάθε σκαλοπατιού να κάθονται στο ύψος τους, όχι στο z=0.
  const elevationM = Math.abs(rec.elevationM) > 1e-6 ? rec.elevationM : (rec.baseElevationM ?? 0);
  const overrides: SlabParamOverrides = {
    kind: 'floor',
    ...(rec.widthM > 1e-6 ? { thickness: rec.widthM * 1000 } : {}),
    levelElevation: elevationM * 1000,
  };
  const res = completeSlabFromPolygonClicks(vertices, levelId, overrides, sceneUnits);
  if (!res.ok) {
    warnings.push(`Πλάκα .tek παραλείφθηκε: ${res.hardErrors.join('; ')}`);
    return { slab: null, warnings };
  }
  return { slab: { ...res.entity, color: tekColorToHex(rec.color) }, warnings };
}
