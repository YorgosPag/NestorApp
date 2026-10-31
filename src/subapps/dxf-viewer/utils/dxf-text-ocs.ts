/**
 * dxf-text-ocs — where a TEXT / ATTRIB / ATTDEF / MTEXT really sits in the plan view (ADR-635 Φ C.30).
 *
 * The two families differ, and the difference is the whole point of this module:
 *   - **TEXT / ATTRIB / ATTDEF** are OCS: the anchor (10 or 11) AND the angle 50 are measured in the entity's plane.
 *   - **MTEXT** is NOT OCS: 10 is already WCS, and its direction is the WCS vector 11/21. 50 is only the fallback when
 *     11 is absent (ezdxf: `text_direction` wins), and THAT one is an angle in the plane of the 210.
 *
 * 🔑 BACK-FACING TEXT. Seen from +Z, a text whose extrusion points down reads backwards: its baseline runs along d
 * while its «up» is on the wrong side of d. The scene has no mirrored glyphs (`scaleText` drops the sign of a negative
 * X scale for the same reason, and DXF 71 «backward» is not read either), so it is drawn the way AutoCAD's own
 * MIRRTEXT = 0 redraws such a text: readable, in the SAME box. The baseline turns to −d — same «up» — and the anchor
 * moves to the opposite end of the line (`left` ↔ `right`), which is what keeps every glyph inside that box.
 */

import { dxfOcsAngleToPlanDeg, dxfOcsToWcs, dxfRealOr, isDefaultDxfExtrusion, isDxfBackFacing, readDxfExtrusion } from '@/lib/dxf/dxf-ocs';
import type { DxfVec3 } from '@/lib/dxf/dxf-ocs';
import type { Point2D } from '../rendering/types/Types';

export interface DxfTextPlanFrame {
  readonly x: number;
  readonly y: number;
  /** Degrees, CCW from world +X — the angle the renderer draws the baseline at. */
  readonly rotation: number;
  /** `true` when the anchor sits at the far end of the baseline — swap the alignment column. */
  readonly backFacing: boolean;
}

function readableRotation(planAngle: number, extrusion: DxfVec3): number {
  return isDxfBackFacing(extrusion) ? (planAngle + 180) % 360 : planAngle;
}

/** TEXT / ATTRIB / ATTDEF: anchor and angle are both OCS. */
export function readPlanarTextFrame(
  anchor: Point2D,
  rotation: number,
  data: Readonly<Record<string, string>>,
): DxfTextPlanFrame {
  const extrusion = readDxfExtrusion(data);
  if (isDefaultDxfExtrusion(extrusion)) return { ...anchor, rotation, backFacing: false };
  const world = dxfOcsToWcs({ x: anchor.x, y: anchor.y, z: dxfRealOr(data['30'], 0) }, extrusion);
  return {
    x: world.x,
    y: world.y,
    rotation: readableRotation(dxfOcsAngleToPlanDeg(rotation, extrusion), extrusion),
    backFacing: isDxfBackFacing(extrusion),
  };
}

/** The MTEXT 11/21 direction as a plan angle, or `null` when absent / zero / seen end-on. */
function mtextDirectionDeg(data: Readonly<Record<string, string>>): number | null {
  const dx = dxfRealOr(data['11'], Number.NaN);
  const dy = dxfRealOr(data['21'], Number.NaN);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null;
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
}

/** MTEXT: the point is WCS as written; the direction is the WCS 11/21, else the OCS angle 50. */
export function readMTextFrame(
  position: Point2D,
  rotation: number,
  data: Readonly<Record<string, string>>,
): DxfTextPlanFrame {
  const extrusion = readDxfExtrusion(data);
  const direction = mtextDirectionDeg(data);
  if (isDefaultDxfExtrusion(extrusion)) {
    return { ...position, rotation: direction ?? rotation, backFacing: false };
  }
  const planAngle = direction ?? dxfOcsAngleToPlanDeg(rotation, extrusion);
  return {
    ...position,
    rotation: readableRotation(planAngle, extrusion),
    backFacing: isDxfBackFacing(extrusion),
  };
}
