/**
 * ADR-507 — Hatch parametric grip handlers.
 *
 * Pure functions (zero React / DOM / Firestore / canvas deps). Mirror of
 * `bim/floor-finishes/floor-finish-grips.ts`, but the hatch is a FLAT primitive
 * (`boundaryPaths: Point2D[][]`, NO params/geometry):
 *
 *   - `hatch-vertex-${pathIdx}-${vertexIdx}` → translate boundary vertex
 *     (path 0 = outer ring, rest = island rings). XY only.
 *
 * Edge-midpoint insertion = DEFER (separate slice). Rectilinear constraint:
 * when `input.rectilinear` is true the delta is quantized to the dominant world
 * axis (Ortho / Shift-constrained), same as floor-finish.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { HatchGripKind } from '../../hooks/grip-types';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

const VERTEX_PREFIX = 'hatch-vertex-';

/** Grip kind για το gradient origin/seed (ADR-507 Φ5 A3). */
export const HATCH_GRADIENT_ORIGIN_KIND = 'hatch-gradient-origin' as const;

/** Grip kind για τον gradient-angle βραχίονα (ADR-507 Φ5 A4). */
export const HATCH_GRADIENT_ANGLE_KIND = 'hatch-gradient-angle' as const;

export interface HatchGripDragInput {
  readonly originalBoundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

/** True όταν το grip kind είναι το gradient origin (όχι boundary vertex). */
export function isHatchOriginGripKind(gripKind: HatchGripKind): boolean {
  return gripKind === HATCH_GRADIENT_ORIGIN_KIND;
}

/** True όταν το grip kind είναι ο gradient-angle βραχίονας (ADR-507 Φ5 A4). */
export function isHatchAngleGripKind(gripKind: HatchGripKind): boolean {
  return gripKind === HATCH_GRADIENT_ANGLE_KIND;
}

/** Axis-aligned bounding box των boundaryPaths· `null` σε κενό όριο. */
export interface HatchBounds {
  readonly minX: number; readonly minY: number;
  readonly maxX: number; readonly maxY: number;
}

/**
 * SSoT bounding-box των boundaryPaths. Το μοιράζονται η προεπιλεγμένη θέση του
 * gradient origin (`hatchBoundsCenter`) και ο `HatchRenderer.fillGradient`
 * (center + extent) → ΜΙΑ bbox math, μηδέν διπλότυπο.
 */
export function hatchBounds(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): HatchBounds | null {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const path of boundaryPaths) {
    for (const v of path) {
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    }
  }
  if (!Number.isFinite(minX) || maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Κέντρο bbox των boundaryPaths — η **προεπιλεγμένη** θέση του gradient origin
 * (όταν `patternOrigin` απών). Επιστρέφει `null` σε κενό/εκφυλισμένο όριο.
 */
export function hatchBoundsCenter(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): Point2D | null {
  const b = hatchBounds(boundaryPaths);
  return b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : null;
}

/**
 * Pure transform: gradient origin + drag delta → νέο origin (Point2D). Rectilinear
 * (Shift/Ortho) → quantize στον κυρίαρχο άξονα, ίδιο με τη boundary λαβή. Δεν
 * μεταλλάσσει το input.
 */
export function applyHatchOriginGripDrag(
  originalOrigin: Point2D,
  input: Readonly<Pick<HatchGripDragInput, 'delta' | 'rectilinear'>>,
): Point2D {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  return translatePoint(originalOrigin, delta);
}

/**
 * Ακτίνα (world) του gradient-angle βραχίονα = μισή διαγώνιος του bbox. Ανεξάρτητη από
 * τύπο gradient (linear/radial) — ο βραχίονας δηλώνει ΦΟΡΑ, όχι έκταση → ίδιος κανόνας
 * για όλους. Καθαρή ποσότητα (όχι το linear `half` του fillGradient → μηδέν διπλότυπο).
 */
function hatchGradientArmRadius(b: HatchBounds): number {
  return 0.5 * Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
}

/**
 * Θέση (world) της gradient-angle λαβής: `origin + R·(cosθ, sinθ)` όπου θ=`angleDeg`
 * (world convention, ίδιο με `fillGradient`) και R = `hatchGradientArmRadius`. `null` σε
 * εκφυλισμένο bbox. ΜΙΑ SSoT θέση — μοιράζεται DISPLAY (`HatchRenderer.getGrips`) +
 * INTERACTION (`computeDxfEntityGrips`) + drag math (anchor = αυτή η θέση).
 */
export function hatchGradientAngleGripPos(
  origin: Point2D,
  angleDeg: number,
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): Point2D | null {
  const b = hatchBounds(boundaryPaths);
  if (!b) return null;
  const R = hatchGradientArmRadius(b);
  if (!(R > 0)) return null;
  const r = (angleDeg * Math.PI) / 180;
  return { x: origin.x + Math.cos(r) * R, y: origin.y + Math.sin(r) * R };
}

/** Βήμα snap (μοίρες) όταν ο χρήστης κρατά Shift — AutoCAD/Revit «ortho» για τη γωνία. */
export const HATCH_ANGLE_SNAP_DEG = 15;

/**
 * Pure transform: gradient origin + ΖΩΝΤΑΝΗ θέση λαβής (cursor world = anchor + delta) →
 * νέα γωνία σε **μοίρες** [0,360). `atan2` σε WORLD coords (η `angleDeg` είναι world
 * convention όπως ο `fillGradient`) → μηδέν canvas-Y σύγχυση. Όταν `snap` (Shift), η γωνία
 * κουμπώνει σε βήματα `HATCH_ANGLE_SNAP_DEG`. Δεν μεταλλάσσει το input.
 */
export function applyHatchAngleGripDrag(
  origin: Point2D,
  cursorWorld: Point2D,
  snap: boolean = false,
): number {
  const raw = (Math.atan2(cursorWorld.y - origin.y, cursorWorld.x - origin.x) * 180) / Math.PI;
  const deg = ((raw % 360) + 360) % 360;
  if (!snap) return deg;
  return (Math.round(deg / HATCH_ANGLE_SNAP_DEG) * HATCH_ANGLE_SNAP_DEG) % 360;
}

/** Decode `hatch-vertex-${pathIdx}-${vertexIdx}` → `[pathIdx, vertexIdx]` or `null`. */
export function decodeHatchVertexGripKind(gripKind: HatchGripKind): [number, number] | null {
  if (!gripKind.startsWith(VERTEX_PREFIX)) return null;
  const rest = gripKind.slice(VERTEX_PREFIX.length).split('-');
  if (rest.length !== 2) return null;
  const pathIdx = parseInt(rest[0], 10);
  const vertexIdx = parseInt(rest[1], 10);
  if (!Number.isFinite(pathIdx) || !Number.isFinite(vertexIdx) || pathIdx < 0 || vertexIdx < 0) return null;
  return [pathIdx, vertexIdx];
}

/**
 * Pure transform: hatch grip kind + drag input → new `boundaryPaths`. Returns the
 * ORIGINAL array reference unchanged on out-of-range index or zero delta (no-op
 * signal the caller short-circuits on). Never mutates the input.
 */
export function applyHatchGripDrag(
  gripKind: HatchGripKind,
  input: Readonly<HatchGripDragInput>,
): Point2D[][] {
  const original = input.originalBoundaryPaths;
  const decoded = decodeHatchVertexGripKind(gripKind);
  if (!decoded) return original as Point2D[][];
  const [pathIdx, vertexIdx] = decoded;
  if (pathIdx >= original.length) return original as Point2D[][];
  const path = original[pathIdx];
  if (vertexIdx >= path.length) return original as Point2D[][];

  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  if (delta.x === 0 && delta.y === 0) return original as Point2D[][];

  // Clone only the affected ring; share the untouched rings by reference.
  return original.map((ring, p) =>
    p === pathIdx
      ? ring.map((v, i) => (i === vertexIdx ? translatePoint(v, delta) : { x: v.x, y: v.y }))
      : projectVerticesTo2D(ring),
  );
}
