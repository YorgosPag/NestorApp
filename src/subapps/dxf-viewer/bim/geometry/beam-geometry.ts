/**
 * Beam geometry computation (ADR-363 Phase 5).
 *
 * Pure SSoT function: derives `BeamGeometry` cache από `BeamParams`.
 * Idempotent + side-effect free. Mirror του wall-geometry pattern για το axis
 * + perpendicular offset → outline, αλλά απλοποιημένο γιατί το beam plan view
 * γίνεται render σε ένα single closed rectangle (width × length).
 *
 * Algorithm:
 *   1. axisPolyline vertices:
 *        - straight / cantilever → [startPoint, endPoint]
 *        - curved → 17-vertex quadratic Bezier subdivision
 *   2. perpendicular offset σε ±width/2 → outline (closed CCW polygon)
 *   3. length (m)   = sum-of-edges στο axis (mm → m)
 *   4. area (m²)    = length × (width / 1000)
 *   5. volume (m³)  = length × width × depth / 1e9
 *   6. bbox folds outline + axis + extrudes σε topElevation (z range [0, topElevation])
 *
 * Σύμβαση μονάδων: input/output γεωμετρικά σημεία σε mm.
 * Numeric scalars (length/area/volume) σε m / m² / m³ για άμεση BOQ feed.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { Point3D, Polyline3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { BeamGeometry, BeamParams } from '../types/beam-types';
import { CURVED_BEAM_SUBDIVISIONS } from '../types/beam-types';
import { mmScaleFor } from '../../utils/scene-units';
import { buildAxisStripOutline } from './shared/polygon-offset-utils';
import { subdivideQuadraticBezier } from './shared/curve-tessellation';
import { iShapeCrossSectionAreaMm2 } from './shared/i-shape-profile';
import { justifyAxisPoints } from '../grid/axis-justify';
import { bboxOfAll } from './shared/xy-bounds';
import { polylineLength } from './shared/polyline-frame';

const MM_TO_M = 1 / 1000;
const MM2_TO_M2 = 1e-6;

/**
 * Compute `BeamGeometry` από `BeamParams`. Pure SSoT για beam-derived
 * geometry. Caller MUST ensure width/depth > 0 (validator guard upstream).
 */
export function computeBeamGeometry(params: BeamParams): BeamGeometry {
  // s: canvas units per 1 mm. Used to convert mm scalars → canvas-unit offsets
  // for the 2D plan-view outline. Axis vertices are always in canvas units.
  const s = mmScaleFor(params);
  const axisVertices = pickAxisVertices(params);
  const axisPolyline: Polyline3D = { points: axisVertices, closed: false };

  const outlineVertices = buildAxisStripOutline(axisVertices, params.width, s);
  const outline: Polygon3D = { vertices: outlineVertices };

  // BOQ: axis length is in canvas units → convert to m via (1/s) * MM_TO_M.
  // width/depth are always mm → convert directly with MM_TO_M.
  const lengthCanvas = polylineLength(axisVertices);
  const lengthM = lengthCanvas * (1 / s) * MM_TO_M;
  const widthM = params.width * MM_TO_M;
  const depthM = params.depth * MM_TO_M;
  const area = lengthM * widthM;
  // ADR-363 Φ2 — μεταλλικό δοκάρι Ι/H: ο όγκος = πραγματικό εμβαδόν διατομής Ι
  // (πέλματα+κορμός) × μήκος (ΟΧΙ bounding box width×depth) → σωστό BOQ kg.
  // Ορθογώνιο RC (default/absent) → width×depth×length (byte-for-byte back-compat).
  const volume = params.sectionKind === 'I-shape'
    ? iShapeCrossSectionAreaMm2(
        params.width,
        params.depth,
        params.ishape?.flangeThickness,
        params.ishape?.webThickness,
      ) * MM2_TO_M2 * lengthM
    : area * depthM;

  // ADR-401 Phase E/(β): κεκλιμένη δοκός → η κορυφή κυμαίνεται [topElevation,
  // topElevationEnd]· το bbox κρατά το ακραίο high/low ώστε fit-to-view (ADR-394)
  // + culling να καλύπτουν όλο το prism. Οριζόντια δοκός → end = topElevation.
  const topEndMm = params.topElevationEnd ?? params.topElevation;
  const bbox = computeBbox(
    axisVertices,
    outlineVertices,
    Math.max(params.topElevation, topEndMm),
    Math.min(params.topElevation, topEndMm),
    params.zOffset ?? 0,
    params.depth,
  );

  return {
    axisPolyline,
    outline,
    bbox,
    length: lengthM,
    area,
    volume,
    maxFreeSpanM: lengthM,
  };
}

/**
 * Convenience: span/depth ratio = length_m / (depth_mm / 1000). Used από
 * validator για `MAX_SPAN_DEPTH_RATIO` check. Returns Infinity για
 * degenerate depth.
 */
export function getBeamSpanDepthRatio(params: BeamParams): number {
  if (params.depth <= 0) return Number.POSITIVE_INFINITY;
  const s = mmScaleFor(params);
  const verts = pickAxisVertices(params);
  const lengthM = polylineLength(verts) * (1 / s) * MM_TO_M;
  const depthM = params.depth * MM_TO_M;
  return lengthM / depthM;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Pick the axis vertices based on beam kind:
 *   - `curved` + `curveControl` → 17-vertex quadratic Bezier subdivision
 *   - else (straight / cantilever) → [startPoint, endPoint]
 *
 * ADR-529 — Revit Location Line: `startPoint`/`endPoint` είναι η **location line** (αναφορά)·
 * εδώ μετατοπίζονται κάθετα κατά `justification` ώστε να προκύψει ο **body axis** (justified
 * centerline) γύρω από τον οποίο χτίζεται η διατομή. ΟΛΟ το downstream (outline/length/bbox/3D)
 * διαβάζει αυτόν τον body axis. `center`/absent → identity (μηδέν μετατόπιση → byte-for-byte
 * back-compat με υπάρχοντα beams). Η μετατόπιση είναι ομοιόμορφη παράλληλη → εφαρμόζεται ΚΑΙ στο
 * `curveControl` (ίδιο διάνυσμα) ώστε η καμπύλη να μετακινείται ακέραια.
 */
function pickAxisVertices(params: BeamParams): readonly Point3D[] {
  const { startPoint, endPoint } = params;
  const body = justifyAxisPoints(startPoint, endPoint, params.width, params.justification, params.sceneUnits);
  const offX = body.start.x - startPoint.x; // ομοιόμορφο perpendicular offset (0 αν center/degenerate)
  const offY = body.start.y - startPoint.y;
  const startB: Point3D = { x: body.start.x, y: body.start.y, z: startPoint.z ?? 0 };
  const endB: Point3D = { x: body.end.x, y: body.end.y, z: endPoint.z ?? 0 };
  if (params.kind === 'curved' && params.curveControl) {
    const ctrlB: Point3D = {
      x: params.curveControl.x + offX,
      y: params.curveControl.y + offY,
      z: params.curveControl.z ?? 0,
    };
    return subdivideQuadraticBezier(startB, ctrlB, endB, CURVED_BEAM_SUBDIVISIONS);
  }
  return [startB, endB];
}


/**
 * Axis-aligned 3D bounding box. Phase B: z in metres (ADR-369 §2.2 Phase B).
 * top = (topMaxMm + zOffset) / 1000 m, bottom = (topMinMm + zOffset − depth) / 1000 m.
 * Για οριζόντια δοκό topMaxMm === topMinMm === topElevation (ADR-401 Phase E/(β)).
 */
function computeBbox(
  axis: readonly Point3D[],
  outline: readonly Point3D[],
  topMaxMm: number,
  topMinMm: number,
  zOffsetMm: number,
  depthMm: number,
): BoundingBox3D {
  const { minX, maxX, minY, maxY } = bboxOfAll(axis, outline);
  const topFaceM = (topMaxMm + zOffsetMm) / 1000;
  const botFaceM = (topMinMm + zOffsetMm - depthMm) / 1000;
  return {
    min: { x: minX, y: minY, z: botFaceM },
    max: { x: maxX, y: maxY, z: topFaceM },
  };
}
