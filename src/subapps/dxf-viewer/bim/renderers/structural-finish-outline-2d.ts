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

/** Line width (px) της σοβατισμένης όψης (λεπτή, δευτερεύουσα του πυρήνα). */
const FINISH_OUTLINE_LINE_WIDTH_PX = 0.75;

const EPS = 1e-9;

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

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = FINISH_OUTLINE_LINE_WIDTH_PX;
  for (const seg of faces.segments) {
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    const off = seg.thickness * s;
    const nx = (dy / len) * off;
    const ny = (-dx / len) * off;
    const ca = worldToScreen({ x: seg.a.x, y: seg.a.y });
    const oa = worldToScreen({ x: seg.a.x + nx, y: seg.a.y + ny });
    const ob = worldToScreen({ x: seg.b.x + nx, y: seg.b.y + ny });
    const cb = worldToScreen({ x: seg.b.x, y: seg.b.y });
    ctx.strokeStyle = getMaterialFlatColorHex(seg.materialId);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(oa.x, oa.y);
    ctx.lineTo(ob.x, ob.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.stroke();
  }
  ctx.restore();
}
