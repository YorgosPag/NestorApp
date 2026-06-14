/**
 * ADR-449 — 2D σοβατισμένη όψη (finished outline): shared pure-ctx SSoT helper.
 *
 * Ανά εκτεθειμένη υπο-ακμή του resolver (`StructuralFinishFaces`) ζωγραφίζει λεπτή
 * «λωρίδα» σοβά: η παρειά [a,b] μετατοπισμένη προς τα έξω (CCW outward normal
 * (dy,−dx)) κατά το πάχος σοβά, με end-caps που κλείνουν προς τον πυρήνα → διπλή
 * γραμμή. Καλυμμένες/αποκλεισμένες παρειές δεν έχουν segment → καμία γραμμή. Χρώμα =
 * SSoT plaster flat colour (`getMaterialFlatColorHex`, ίδιο με το 3D).
 *
 * ΕΝΑ σημείο — το καλούν ΚΑΙ ο `ColumnRenderer` ΚΑΙ ο `BeamRenderer` (μηδέν
 * διπλασιασμός). Pure ctx, ZERO subscriptions (ADR-040 compliant — ο orchestrator
 * εγχέει το per-frame finish index, το leaf απλώς ζωγραφίζει).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StructuralFinishFaces } from '../finishes/structural-finish-types';
import { getMaterialFlatColorHex } from '../materials/material-catalog-defs';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
// ADR-449 Slice X2 — γωνιακή γεωμετρία = ΚΟΙΝΟ pure SSoT με το 3Δ skin (μηδέν διπλότυπο).
import { computeMiteredOuter, segOffsetVec } from '../finishes/structural-finish-outline-geometry';

/** Line width (px) της σοβατισμένης όψης (λεπτή, δευτερεύουσα του πυρήνα). */
const FINISH_OUTLINE_LINE_WIDTH_PX = 0.75;

/**
 * Ζωγραφίζει τη σοβατισμένη όψη ενός δομικού στοιχείου (κολόνα/δοκάρι). No-op όταν δεν
 * έχει εγχυθεί index για το στοιχείο ή δεν υπάρχουν εκτεθειμένες παρειές.
 */
export function drawStructuralFinishOutline(
  ctx: CanvasRenderingContext2D,
  faces: StructuralFinishFaces | undefined,
  sceneUnits: SceneUnits,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  if (!faces || faces.segments.length === 0) return;
  const s = mmToSceneUnits(sceneUnits);
  const segs = faces.segments;

  // ADR-449 Slice X2 — γωνιακά endpoints από το ΚΟΙΝΟ SSoT `computeMiteredOuter` (ίδιο
  // math με το 3Δ skin): κοινές κορυφές → miter (σε 90° = ορθή γωνία)· ανοιχτά άκρα →
  // chamfer/extend. Έτσι η λωρίδα κάθε όψης διαβάζει τα (mitered) outer + (extended) core
  // endpoints → οι γωνίες ΚΛΕΙΝΟΥΝ ΠΑΝΟΜΟΙΟΤΥΠΑ με το 3Δ (πρώην: κάθε όψη ανεξάρτητα με
  // raw offset → τα outer δεν συναντιόνταν → ανοιχτές γωνίες).
  const offsets = segs.map((seg) => segOffsetVec(seg, seg.thickness * s));
  const { aOuter, bOuter, aCore, bCore } = computeMiteredOuter(segs, offsets, true);

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = FINISH_OUTLINE_LINE_WIDTH_PX;
  for (let i = 0; i < segs.length; i++) {
    if (!offsets[i]) continue;
    const ca = worldToScreen({ x: aCore[i].x, y: aCore[i].y });
    const oa = worldToScreen({ x: aOuter[i].x, y: aOuter[i].y });
    const ob = worldToScreen({ x: bOuter[i].x, y: bOuter[i].y });
    const cb = worldToScreen({ x: bCore[i].x, y: bCore[i].y });
    ctx.strokeStyle = getMaterialFlatColorHex(segs[i].materialId);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(oa.x, oa.y);
    ctx.lineTo(ob.x, ob.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.stroke();
  }
  ctx.restore();
}
