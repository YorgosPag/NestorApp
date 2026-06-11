/**
 * Foundation geometry computation (ADR-436, Slice 1).
 *
 * Pure SSoT function — derives `FoundationGeometry` cache από `FoundationParams`.
 * Idempotent + side-effect free. Total over `FoundationKind` (TS-exhaustive):
 *
 *   - `pad`      → ορθογώνιο footprint (width × length), anchor offset + rotation
 *                  γύρω από το `position` (mirror της rectangular κολώνας).
 *   - `strip`    → band rectangle κατά μήκος του άξονα start→end, πλάτος `width`.
 *   - `tie-beam` → ίδιο band rectangle (μικρότερο default πλάτος, διαφορετικό IFC).
 *
 * Footprint = κλειστό CCW polygon σε canvas units (ίδιο space με `position` —
 * πάντα canvas units από το user click). Το `s = mmToSceneUnits(sceneUnits)`
 * μετατρέπει τα mm scalars (width/length) σε canvas units ώστε anchor offset +
 * rotation να μένουν στο ίδιο space (mirror `column-geometry.ts`).
 *
 * Elevation (ADR-369): δεν εμπλέκεται εδώ — το `foundationToMesh` διαβάζει
 * `topElevationMm`/`thicknessMm` και κρεμάει το στερεό ΚΑΤΩ. Το geometry cache
 * κρατά μόνο το οριζόντιο ίχνος + area/volume (BOQ-ready).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4 §5
 */

import type {
  FoundationAnchor,
  FoundationGeometry,
  FoundationParams,
  PadFootingParams,
  StripFootingParams,
  TieBeamParams,
} from '../types/foundation-types';
import { ANCHOR_OFFSETS, JUSTIFICATION_NORMAL_SIGN } from '../types/foundation-types';
import type { Point3D } from '../types/bim-base';
import { polygonArea, polygonBbox } from './shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `FoundationGeometry` από `FoundationParams`. Pure SSoT για
 * foundation-derived γεωμετρία. Caller MUST ensure width/length/thickness > 0
 * (validator guard upstream).
 *
 * Throws nothing — validation σε `validateFoundationParams()`.
 */
export function computeFoundationGeometry(params: FoundationParams): FoundationGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const footprint = params.kind === 'pad'
    ? buildPadFootprint(params, s)
    : buildBandFootprint(params, s);

  const bbox = polygonBbox(footprint);
  // Polygon vertices are in canvas units → convert area to m².
  const areaCanvas2 = polygonArea(footprint);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;
  const thicknessMm = Math.max(0, params.thicknessMm);
  const volumeM3 = areaM2 * thicknessMm * MM_TO_M;

  return {
    footprint: { vertices: footprint },
    bbox,
    area: areaM2,
    volume: volumeM3,
    thickness: thicknessMm,
  };
}

// ─── Pad footprint (point-based rect + anchor + rotation) ────────────────────

/**
 * Build the pad footprint: local-frame width × length rect centred at origin,
 * shifted so the chosen anchor sits on `position`, then rotated around
 * `position` (mirror της rectangular κολώνας — visual stability με Tab cycle).
 */
function buildPadFootprint(params: PadFootingParams, s: number): Point3D[] {
  const local = buildRectLocal(params.width, params.length, s);
  return transformPad(local, params.position, params.anchor, params.width, params.length, params.rotation, s);
}

function buildRectLocal(width: number, length: number, s: number): Point3D[] {
  const hw = (width * s) / 2;  // mm → canvas units
  const hl = (length * s) / 2;
  return [
    { x: -hw, y: -hl, z: 0 },
    { x:  hw, y: -hl, z: 0 },
    { x:  hw, y:  hl, z: 0 },
    { x: -hw, y:  hl, z: 0 },
  ];
}

function transformPad(
  local: readonly Point3D[],
  position: Point3D,
  anchor: FoundationAnchor,
  width: number,
  length: number,
  rotationDeg: number,
  s: number,
): Point3D[] {
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  // dx/dy are unit fractions of width/length. Convert mm → canvas units via s.
  const shiftX = -dx * (width * s);
  const shiftY = -dy * (length * s);
  const cos = Math.cos(rotationDeg * DEG_TO_RAD);
  const sin = Math.sin(rotationDeg * DEG_TO_RAD);
  return local.map((v) => {
    const lx = v.x + shiftX;
    const ly = v.y + shiftY;
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
}

// ─── Band footprint (line-based strip / tie-beam) ────────────────────────────

/**
 * Build a band rectangle of `width` centred on the axis start→end. CCW order
 * (left-of-direction first). Degenerate (zero-length) axis → tiny square so the
 * pipeline never produces < 3 vertices (validator blocks such params upstream).
 *
 * Justification (ADR-441 Slice 5a): πριν χτιστεί το band, ο centerline μετατοπίζεται
 * ΚΑΘΕΤΑ κατά `sign·hw` (SSoT `JUSTIFICATION_NORMAL_SIGN`) ώστε η μία παρειά να
 * πέφτει στον άξονα (έκκεντρη ανάπτυξη). `center` → sign 0 → identical footprint.
 */
function buildBandFootprint(params: StripFootingParams | TieBeamParams, s: number): Point3D[] {
  const { start, end } = params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const hw = (params.width * s) / 2;
  if (len < 1e-6) {
    return [
      { x: start.x - hw, y: start.y - hw, z: 0 },
      { x: start.x + hw, y: start.y - hw, z: 0 },
      { x: start.x + hw, y: start.y + hw, z: 0 },
      { x: start.x - hw, y: start.y + hw, z: 0 },
    ];
  }
  // Canonical tangent (κατακόρυφη → +Y, οριζόντια → +X): το justification ('left'/'right')
  // ορίζεται relative στη φορά start→end, αλλά η φορά είναι ΑΥΘΑΙΡΕΤΗ (ο builder παράγει +Y/+X,
  // όμως το follow-on-move μπορεί να την αντιστρέψει όταν ένας άξονας προσπεράσει άλλον — τότε
  // το CCW normal γυρίζει και η έκκεντρη λωρίδα προεξέχει προς τη ΛΑΘΟΣ πλευρά). Κανονικοποιώντας
  // εδώ, το geometry γίνεται orientation-invariant (Revit Location Line). ADR-441 Slice 5a-grid fix.
  let ux = dx / len, uy = dy / len;
  if (uy < -1e-9 || (Math.abs(uy) <= 1e-9 && ux < 0)) { ux = -ux; uy = -uy; }
  // CCW 90° unit normal (rotate tangent (ux,uy) → (-uy,ux)).
  const nx = -uy;
  const ny = ux;
  // Perpendicular justification shift του centerline (sign·hw κατά τον normal).
  const j = JUSTIFICATION_NORMAL_SIGN[params.justification ?? 'center'] * hw;
  const ax = start.x + nx * j, ay = start.y + ny * j;
  const bx = end.x + nx * j,   by = end.y + ny * j;
  return [
    { x: ax - nx * hw, y: ay - ny * hw, z: 0 },
    { x: bx - nx * hw, y: by - ny * hw, z: 0 },
    { x: bx + nx * hw, y: by + ny * hw, z: 0 },
    { x: ax + nx * hw, y: ay + ny * hw, z: 0 },
  ];
}
