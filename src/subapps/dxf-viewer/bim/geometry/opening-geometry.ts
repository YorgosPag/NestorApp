/**
 * Opening geometry computation (ADR-363 Phase 2).
 *
 * Pure SSoT function: derives `OpeningGeometry` cache από `OpeningParams +
 * hostWall`. Idempotent + side-effect free.
 *
 * Algorithm (host-relative, plan view):
 *   1. host axis unit vector + perpendicular (from wall.start → wall.end)
 *   2. center = wall.start + axisDir × (offsetFromStart + width/2)
 *   3. outline = 4 corner rectangle on wall axis, depth = wall.thickness
 *   4. bbox folds the 4 vertices (z=0 plan view)
 *   5. area (m²) = width × height / 1e6
 *   6. perimeter (m) = 2 × (width + height) / 1000
 *   7. hingeArc (door / french-door) = quarter arc radius = width
 *
 * Phase 2 (resolved): curved + polyline host walls use the actual tessellated
 * axis vertices from `getWallAxisVertices()`. `offsetFromStart` is measured along
 * the arc; `projectPointToWallOffset` projects onto the polyline, not the chord.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 */

import type { Point3D, Polyline3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { OpeningParams, OpeningGeometry, OpeningKind } from '../types/opening-types';
import { isHingedKind } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { getWallAxisVertices } from './wall-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
/**
 * Number of subdivisions per quarter-arc. Exported so consumers (e.g.
 * OpeningRenderer leaf-line drawing) can index into `hingeArc.points`
 * without re-deriving the array layout.
 */
export const HINGE_ARC_SUBDIVISIONS = 12;
const HALF_PI = Math.PI / 2;

/**
 * Compute `OpeningGeometry` from `OpeningParams + hostWall`. SSoT για
 * όλη την opening-derived γεωμετρία. Caller MUST ensure `hostWall.id === params.wallId`.
 *
 * Throws nothing: invalid params (e.g. width = 0, offset out of bounds) still
 * produce a geometry — validation σε `validateOpeningParams()`.
 */
export function computeOpeningGeometry(
  params: OpeningParams,
  hostWall: WallEntity,
  sceneUnits: SceneUnits = 'mm',
): OpeningGeometry {
  // ADR-370 — axisVertices ζουν σε scene-units. `params.offsetFromStart` και
  // `params.width` είναι σε mm (Nestor convention). Με `mmToSceneUnits()`
  // ευθυγραμμίζουμε mm→scene ώστε το walk να διασχίζει τη σωστή απόσταση και
  // το outline να συμπίπτει με το ghost preview στο canvas.
  const mmFactor = mmToSceneUnits(sceneUnits);
  const axisVertices = getWallAxisVertices(hostWall.params, hostWall.kind);
  const centerOffsetMm = Math.max(0, params.offsetFromStart + params.width / 2);
  const centerOffsetScene = centerOffsetMm * mmFactor;
  const widthScene = params.width * mmFactor;
  const thicknessScene = hostWall.params.thickness * mmFactor;
  const { point: center, ux, uy, rotation } = walkPolylineToDistance(axisVertices, centerOffsetScene);
  // Perpendicular (CCW 90°): (-uy, ux).
  const px = -uy;
  const py = ux;

  // ADR-363/396 — οι παρειές πρέπει να φτάνουν τις ΠΡΑΓΜΑΤΙΚΕΣ ακμές του τοίχου
  // (`outerEdge`/`innerEdge`), ΟΧΙ το `άξονας ± πάχος/2`. Σε λοξές γωνίες (miter
  // junctions) οι ακμές είναι λοξές ως προς τον άξονα → αλλιώς το κόψιμο δεν τις
  // φτάνει και μένει τραπεζοειδές υπόλειμμα τοίχου στην παρειά. Fallback σε
  // perpendicular offset όταν λείπει η geometry (π.χ. pre-geometry callers).
  const halfW = widthScene / 2;
  const halfT = thicknessScene / 2;
  const startAxis = { x: center.x - ux * halfW, y: center.y - uy * halfW };
  const endAxis = { x: center.x + ux * halfW, y: center.y + uy * halfW };
  const outline = buildOutline(
    startAxis, endAxis, px, py, halfT,
    hostWall.geometry?.outerEdge?.points,
    hostWall.geometry?.innerEdge?.points,
  );
  // ADR-396 — structural reveal outline: το ΕΛΕΥΘΕΡΟ άνοιγμα διευρυμένο κατά το πάχος
  // της περιμετρικής μόνωσης (Z4) σε κάθε άκρο ΚΑΤΑ ΤΟΝ ΑΞΟΝΑ. Η μόνωση τρώει τον
  // τοίχο (όχι το κούφωμα) → το δομικό κενό = free + 2·t. Reuse `buildOutline` με
  // μετατοπισμένα axis points → κάθετες παρειές στις ΠΡΑΓΜΑΤΙΚΕΣ ακμές. Present μόνο
  // όταν υπάρχει reveal (αλλιώς undefined → οι consumers πέφτουν στο free outline).
  const revealThkScene = (params.revealInsulation?.thickness_m ?? 0) * 1000 * mmFactor;
  let revealOutline: Polygon3D | undefined;
  if (revealThkScene > 0) {
    const sStart = { x: startAxis.x - ux * revealThkScene, y: startAxis.y - uy * revealThkScene };
    const sEnd = { x: endAxis.x + ux * revealThkScene, y: endAxis.y + uy * revealThkScene };
    revealOutline = buildOutline(
      sStart, sEnd, px, py, halfT,
      hostWall.geometry?.outerEdge?.points,
      hostWall.geometry?.innerEdge?.points,
    );
  }
  const hingeResult = isHingedKind(params.kind)
    ? buildHingeArc(params.kind, center, ux, uy, px, py, params, widthScene)
    : undefined;
  // Expand bbox to encompass full visible geometry (outline + arc + leaf line) so
  // the spatial pre-filter (BoundsCalculator.calculateBimEntityBounds) includes the
  // entity when the cursor is over the swing arc or leaf line, not just the cutout.
  const bboxPoints: readonly Point3D[] = hingeResult
    ? ([...outline.vertices, ...hingeResult.arc.points] as Point3D[])
    : outline.vertices;
  const bbox = computeBbox(bboxPoints, params.sillHeight, params.height);

  return {
    position: center,
    rotation,
    outline,
    revealOutline,
    hingeArc: hingeResult?.arc,
    hingeAnchor: hingeResult?.hingeAnchor,
    hingeAnchor2: hingeResult?.hingeAnchor2,
    bbox,
    area: (params.width * params.height) * (MM_TO_M * MM_TO_M),
    perimeter: 2 * (params.width + params.height) * MM_TO_M,
  };
}

/**
 * ADR-396 — Structural κατακόρυφο εύρος του cutout όταν υπάρχει reveal μόνωση (3D).
 * Η μόνωση τρώει το περιβάλλον υλικό: πρέκι `+t` πάνω από το head (πάντα)· ποδιά
 * `−t` κάτω από το sill (μόνο παράθυρα, `sillHeight > 0`· η πόρτα φτάνει στο δάπεδο).
 * Χωρίς reveal → `[0|sill .. head]` αμετάβλητο (backward-compat). Όλα σε mm.
 */
export function structuralRevealHeightRangeMm(
  params: OpeningParams,
): { bottomMm: number; topMm: number } {
  const t = (params.revealInsulation?.thickness_m ?? 0) * 1000;
  const headMm = params.sillHeight + params.height;
  const bottomMm = params.sillHeight > 0 ? Math.max(0, params.sillHeight - t) : 0;
  return { bottomMm, topMm: headMm + t };
}

// ─── Polyline axis helpers ────────────────────────────────────────────────────

/**
 * Walk `vertices` from the start by `distanceMm` mm and return the world
 * position + local tangent direction at that point. Clamps past the end.
 */
function walkPolylineToDistance(
  vertices: readonly Point3D[],
  distanceMm: number,
): { point: Point3D; ux: number; uy: number; rotation: number } {
  let remaining = distanceMm;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return {
        point: { x: a.x + dx * t, y: a.y + dy * t, z: 0 },
        ux,
        uy,
        rotation: Math.atan2(dy, dx),
      };
    }
    remaining -= segLen;
  }
  // Past end — clamp to last vertex, use last segment tangent.
  const n = vertices.length;
  const a = vertices[n - 2];
  const b = vertices[n - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLen = Math.hypot(dx, dy) || 1;
  return {
    point: { x: b.x, y: b.y, z: b.z ?? 0 },
    ux: dx / segLen,
    uy: dy / segLen,
    rotation: Math.atan2(dy, dx),
  };
}

/**
 * Project `point` onto the polyline `vertices`, returning the cumulative arc
 * offset (mm) of the closest foot, clamped to `[0, totalArcLength]`.
 */
function projectPointToPolylineOffset(
  point: { readonly x: number; readonly y: number },
  vertices: readonly Point3D[],
): number {
  let arcOffset = 0;
  let bestOffset = 0;
  let bestDist2 = Infinity;

  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    const vx = point.x - a.x;
    const vy = point.y - a.y;
    const t = Math.max(0, Math.min(vx * ux + vy * uy, segLen));
    const ex = point.x - (a.x + ux * t);
    const ey = point.y - (a.y + uy * t);
    const dist2 = ex * ex + ey * ey;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      bestOffset = arcOffset + t;
    }
    arcOffset += segLen;
  }

  return Math.max(0, Math.min(bestOffset, arcOffset));
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Max παρειάς reach ως πολλαπλάσιο του halfT — sanity guard για degenerate miters. */
const MAX_JAMB_REACH = 16;

/**
 * Build the cutout rectangle (4 vertices, world coords). Vertices are ordered
 * CCW: `[start-(−px), end-(−px), end-(+px), start-(+px)]` (ίδια σειρά με την
 * προηγούμενη perpendicular έκδοση), ώστε όλοι οι consumers (wall punch, reveal
 * jambs, 3D, hit-test) να μένουν αμετάβλητοι.
 *
 * Κάθε γωνία = τομή της κάθετης γραμμής της παρειάς (από το axis point, διεύθυνση
 * `±(px,py)`) με την ΠΡΑΓΜΑΤΙΚΗ ακμή τοίχου (`outerEdge`/`innerEdge`). Έτσι το
 * κόψιμο φτάνει τις λοξές (mitered) ακμές → καθαρή κάθετη παρειά, μηδέν υπόλειμμα.
 * Fallback σε `axisPt ± px·halfT` όταν λείπουν/δεν τέμνονται οι ακμές.
 */
function buildOutline(
  startAxis: { readonly x: number; readonly y: number },
  endAxis: { readonly x: number; readonly y: number },
  px: number,
  py: number,
  halfT: number,
  outerPts: readonly Point3D[] | undefined,
  innerPts: readonly Point3D[] | undefined,
): Polygon3D {
  const start = jambCorners(startAxis, px, py, halfT, outerPts, innerPts);
  const end = jambCorners(endAxis, px, py, halfT, outerPts, innerPts);
  return { vertices: [start.minus, end.minus, end.plus, start.plus] };
}

/**
 * Οι δύο γωνίες (±px πλευρές) μιας παρειάς: τομή της κάθετης γραμμής με τις
 * ακμές του τοίχου, classified κατά πρόσημο προβολής στο `(px,py)`. Fallback σε
 * perpendicular offset `halfT` αν λείπει/απορρίπτεται η τομή.
 */
function jambCorners(
  origin: { readonly x: number; readonly y: number },
  px: number,
  py: number,
  halfT: number,
  outerPts: readonly Point3D[] | undefined,
  innerPts: readonly Point3D[] | undefined,
): { plus: Point3D; minus: Point3D } {
  let plus: Point3D | null = null, plusProj = 0;
  let minus: Point3D | null = null, minusProj = 0;
  const consider = (h: Point3D | null): void => {
    if (!h) return;
    const proj = (h.x - origin.x) * px + (h.y - origin.y) * py;
    if (Math.abs(proj) > halfT * MAX_JAMB_REACH) return;
    if (proj >= 0) { if (!plus || proj > plusProj) { plus = h; plusProj = proj; } }
    else if (!minus || proj < minusProj) { minus = h; minusProj = proj; }
  };
  if (outerPts && outerPts.length >= 2) consider(lineHitPolyline(origin.x, origin.y, px, py, outerPts));
  if (innerPts && innerPts.length >= 2) consider(lineHitPolyline(origin.x, origin.y, px, py, innerPts));
  return {
    plus: plus ?? { x: origin.x + px * halfT, y: origin.y + py * halfT, z: 0 },
    minus: minus ?? { x: origin.x - px * halfT, y: origin.y - py * halfT, z: 0 },
  };
}

/**
 * Τομή της άπειρης γραμμής `(ox,oy) + t·(dx,dy)` με μια polyline. Επιστρέφει το
 * σημείο τομής με το μικρότερο `|t|` (πλησιέστερη παρειά), ή null αν καμία ακμή
 * δεν τέμνεται εντός τμήματος.
 */
function lineHitPolyline(
  ox: number, oy: number, dx: number, dy: number, pts: readonly Point3D[],
): Point3D | null {
  let best: Point3D | null = null;
  let bestAbsT = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, ay = pts[i].y;
    const ex = pts[i + 1].x - ax, ey = pts[i + 1].y - ay;
    const denom = ex * dy - ey * dx; // cross(edge, dir)
    if (Math.abs(denom) < 1e-9) continue; // parallel
    const s = ((ox - ax) * dy - (oy - ay) * dx) / denom; // param κατά μήκος της ακμής
    if (s < -1e-6 || s > 1 + 1e-6) continue;
    const hx = ax + ex * s, hy = ay + ey * s;
    const t = (hx - ox) * dx + (hy - oy) * dy;
    const absT = Math.abs(t);
    if (absT < bestAbsT) { bestAbsT = absT; best = { x: hx, y: hy, z: 0 }; }
  }
  return best;
}

/**
 * Phase B: z in metres (ADR-369 Phase B).
 * sill = sillHeight / 1000 m, head = (sillHeight + height) / 1000 m.
 */
function computeBbox(
  vertices: readonly Point3D[],
  sillHeightMm: number,
  heightMm: number,
): BoundingBox3D {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return {
    min: { x: minX, y: minY, z: sillHeightMm / 1000 },
    max: { x: maxX, y: maxY, z: (sillHeightMm + heightMm) / 1000 },
  };
}

/**
 * Quarter-arc swing indicator για door / french-door. Hinge anchor:
 *   - handing='left' (default) → hinge στο start side του opening
 *   - handing='right' → hinge στο end side
 *
 * Arc radius = opening width. Sweep 0..π/2 σε επίπεδο πλάκας (plan view).
 * `openDirection` ('inward' / 'outward') flips the perpendicular sign so
 * the arc rotates toward the correct face.
 */
interface HingeArcResult {
  readonly arc: Polyline3D;
  readonly hingeAnchor: Point3D;
  readonly hingeAnchor2?: Point3D;
}

function buildHingeArc(
  kind: OpeningKind,
  center: Point3D,
  ux: number,
  uy: number,
  px: number,
  py: number,
  params: OpeningParams,
  widthScene: number,
): HingeArcResult {
  const halfW = widthScene / 2;
  const handingSign = params.handing === 'right' ? 1 : -1;
  const swingSign = params.openDirection === 'outward' ? -1 : 1;

  // Hinge point sits on the wall axis at the start/end of the opening.
  const hinge: Point3D = {
    x: center.x + ux * (handingSign * halfW),
    y: center.y + uy * (handingSign * halfW),
    z: 0,
  };

  // Starting radial vector: along axis toward the other jamb.
  const startVecX = -handingSign * ux;
  const startVecY = -handingSign * uy;
  // Perpendicular component aligned with swing direction.
  const perpX = swingSign * px;
  const perpY = swingSign * py;

  const points: Point3D[] = [];
  for (let i = 0; i <= HINGE_ARC_SUBDIVISIONS; i++) {
    const t = (i / HINGE_ARC_SUBDIVISIONS) * HALF_PI;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    points.push({
      x: hinge.x + widthScene * (cos * startVecX + sin * perpX),
      y: hinge.y + widthScene * (cos * startVecY + sin * perpY),
      z: 0,
    });
  }

  // french-door = mirror arc on the opposite jamb (two leaves).
  let hinge2: Point3D | undefined;
  if (kind === 'french-door') {
    hinge2 = {
      x: center.x + ux * (-handingSign * halfW),
      y: center.y + uy * (-handingSign * halfW),
      z: 0,
    };
    const startVec2X = handingSign * ux;
    const startVec2Y = handingSign * uy;
    for (let i = HINGE_ARC_SUBDIVISIONS; i >= 0; i--) {
      const t = (i / HINGE_ARC_SUBDIVISIONS) * HALF_PI;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      points.push({
        x: hinge2.x + widthScene * (cos * startVec2X + sin * perpX),
        y: hinge2.y + widthScene * (cos * startVec2Y + sin * perpY),
        z: 0,
      });
    }
  }

  return { arc: { points, closed: false }, hingeAnchor: hinge, hingeAnchor2: hinge2 };
}

/**
 * Project an arbitrary point onto the host wall axis, returning the offset
 * clamped to `[0, arcLength]`, **in the scene's world units** (the wall axis
 * vertices come from `params.start/end` which are world coords — m / cm / mm).
 * Supports straight, curved, and polyline walls via the tessellated axis from
 * `getWallAxisVertices`.
 *
 * ⚠️ The result is SCENE-UNITS, NOT mm. `OpeningParams.offsetFromStart` / `width`
 * are always mm — callers that compare against those MUST use
 * {@link projectPointToWallOffsetMm} (the unit-normalised SSoT), never this raw
 * scalar (mixing the two silently breaks every non-mm scene, e.g. metres).
 */
export function projectPointToWallOffset(
  point: { readonly x: number; readonly y: number },
  hostWall: WallEntity,
): number {
  const axisVertices = getWallAxisVertices(hostWall.params, hostWall.kind);
  return projectPointToPolylineOffset(point, axisVertices);
}

/**
 * Project an arbitrary point onto the host wall axis, returning the offset **in
 * mm** (the `OpeningParams.offsetFromStart` contract). SSoT for "world point →
 * host-relative mm offset": divides the scene-unit projection by the wall's
 * mm→scene factor (`mmToSceneUnits(hostWall.params.sceneUnits)`). Consumed by the
 * opening creation tool (`buildDefaultOpeningParams`) AND the opening grip drag
 * (`opening-grips`) so both share one conversion — no duplicated `/ mmFactor`.
 */
export function projectPointToWallOffsetMm(
  point: { readonly x: number; readonly y: number },
  hostWall: WallEntity,
): number {
  const mmFactor = mmToSceneUnits(hostWall.params.sceneUnits ?? 'mm');
  return projectPointToWallOffset(point, hostWall) / (mmFactor || 1);
}
