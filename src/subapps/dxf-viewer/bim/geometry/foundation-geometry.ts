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
  StripJustification,
} from '../types/foundation-types';
import { ANCHOR_OFFSETS } from '../types/foundation-types';
import type { Point3D } from '../types/bim-base';
import type { Point2D } from '../../rendering/types/Types';
import { polygonArea, polygonBbox } from './shared/polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { canonicalAxisNormal } from '../grid/axis-normal';
import { justifyAxisPoints, unjustifyAxisPoints } from '../grid/axis-justify';

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
 * The JUSTIFIED centerline of a strip / tie-beam band — i.e. the axis the body is
 * actually drawn around (raw axis shifted perpendicular by `sign·hw`). This is the
 * SSoT the grip layer feeds to the axis-box engine so the handles sit on the drawn
 * body, NOT on the raw (location-line) axis. `center` → identical to the raw axis.
 *
 * Pure; canvas units in/out (start/end are canvas units; width is mm → scaled).
 * @see ../foundations/foundation-grips.ts — consumer (grip emission + drag)
 */
export function stripJustifiedAxis(
  params: StripFootingParams | TieBeamParams,
): { start: Point2D; end: Point2D } {
  // SSoT delegate (ADR-441/529) — η canonical-normal × sign × hw μετατόπιση ζει πλέον ΜΟΝΟ
  // στο `axis-justify.ts` (κοινό δοκάρι/τοίχος/πεδιλοδοκός). Forward = location line → body axis.
  return justifyAxisPoints(params.start, params.end, params.width, params.justification, params.sceneUnits);
}

/**
 * Inverse of {@link stripJustifiedAxis}: given a JUSTIFIED centerline (e.g. the
 * post-resize body axis a grip drag produced) + the new width, recover the RAW
 * (location-line) axis so the entity keeps storing `start`/`end` as the location
 * line + `justification` separately. `center` → identity. Pure; canvas units.
 */
export function unjustifyStripAxis(
  effStart: Point2D,
  effEnd: Point2D,
  widthMm: number,
  justification: StripJustification | undefined,
  sceneUnits: SceneUnits | undefined,
): { start: Point2D; end: Point2D } {
  // SSoT delegate (ADR-441/529) — inverse: body axis → location line (κοινό math με το forward).
  return unjustifyAxisPoints(effStart, effEnd, widthMm, justification, sceneUnits);
}

/**
 * Build a band rectangle of `width` centred on the axis start→end. CCW order
 * (left-of-direction first). Degenerate (zero-length) axis → tiny square so the
 * pipeline never produces < 3 vertices (validator blocks such params upstream).
 *
 * Justification (ADR-441 Slice 5a): the centerline is shifted perpendicular via
 * the shared {@link stripJustifiedAxis} SSoT so one face falls on the axis
 * (eccentric growth). `center` → identical footprint.
 */
function buildBandFootprint(params: StripFootingParams | TieBeamParams, s: number): Point3D[] {
  const { start, end } = params;
  const hw = (params.width * s) / 2;
  const n = canonicalAxisNormal(start, end);
  if (!n) {
    return [
      { x: start.x - hw, y: start.y - hw, z: 0 },
      { x: start.x + hw, y: start.y - hw, z: 0 },
      { x: start.x + hw, y: start.y + hw, z: 0 },
      { x: start.x - hw, y: start.y + hw, z: 0 },
    ];
  }
  const { nx, ny } = n;
  // Justified centerline endpoints (shared SSoT — same shift the grips read).
  const axis = stripJustifiedAxis(params);
  const { start: a, end: b } = axis;
  return [
    { x: a.x - nx * hw, y: a.y - ny * hw, z: 0 },
    { x: b.x - nx * hw, y: b.y - ny * hw, z: 0 },
    { x: b.x + nx * hw, y: b.y + ny * hw, z: 0 },
    { x: a.x + nx * hw, y: a.y + ny * hw, z: 0 },
  ];
}
