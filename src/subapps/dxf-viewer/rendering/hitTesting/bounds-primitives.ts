/**
 * ADR-587 Φ10 — Per-type spatial-index bounds (pure helpers).
 *
 * Τα per-type μαθηματικά του `BoundsCalculator` (Twin C), εξαγμένα σε standalone
 * exported functions ώστε το `Bounds.ts` να κρατά ΜΟΝΟ το type-keyed registry +
 * τον resolver (N.7.1 — 500-line budget). Μιμείται ΑΚΡΙΒΩΣ το καθιερωμένο μοτίβο
 * των `bounds-annotation.ts` / `bounds-parametric-line.ts`: standalone functions,
 * `BoundingBox` / `createBoundingBox` imported back από το `./Bounds`.
 *
 * Καμία αλλαγή μαθηματικών — byte-identical μεταφορά των private statics.
 *
 * @see ./Bounds — το registry (`HIT_TEST_BOUNDS_HANDLERS`) + `BoundsCalculator`
 */

import type { EntityModel } from '../types/Types';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { createBoundingBox, type BoundingBox } from './Bounds';
// ADR-557 (multi-line) — the attachment/rotation/multi-line-aware text-box AABB SSoT (em box),
// the generous superset the spatial-index broad phase uses so it always encloses every line.
import { textBoxAABB } from '../../bim/text/text-box';
import type {
  EntityWithLine,
  EntityWithCircle,
  EntityWithPolyline,
  EntityWithEllipse,
  EntityWithText,
  EntityWithSpline,
  EntityWithPoint,
  EntityWithAngleMeasurement,
  PolylineEntityProperties,
} from './bounds-entity-types';

/** Η υπογραφή κάθε per-type bounds handler (το registry του `Bounds.ts` είναι keyed σε αυτήν). */
export type EntityBoundsHandler = (entity: EntityModel, tolerance: number) => BoundingBox | null;

type BBoxLike = { min?: { x: number; y: number }; max?: { x: number; y: number } };

/**
 * Κοινό SSoT: pre-computed 2D-projected `bbox {min,max}` → `BoundingBox` με
 * tolerance. Absent/partial bbox (legacy / partially-serialized) → `null` →
 * ο caller πέφτει gracefully εκτός spatial index. Μοιράζεται από stair/BIM.
 */
function bboxToBounds(bbox: BBoxLike | undefined, tolerance: number): BoundingBox | null {
  if (!bbox || !bbox.min || !bbox.max) return null;
  return createBoundingBox(
    bbox.min.x - tolerance,
    bbox.min.y - tolerance,
    bbox.max.x + tolerance,
    bbox.max.y + tolerance,
  );
}

/**
 * Κοινό SSoT: AABB πάνω σε ροή σημείων → `BoundingBox` με tolerance. Άδειο/
 * μη-πεπερασμένο σύνολο → `null`. Μοιράζεται από hatch (boundary paths) και
 * dimension (defPoints + textMidpoint).
 */
function pointsToBounds(
  points: Iterable<{ x: number; y: number }>,
  tolerance: number,
): BoundingBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return null;
  return createBoundingBox(minX - tolerance, minY - tolerance, maxX + tolerance, maxY + tolerance);
}

/**
 * 🪜 ADR-358 Phase 8 — StairEntity bounds via pre-computed `geometry.bbox`.
 * `computeStairGeometry()` populates an axis-aligned 3D bbox at construction
 * time; we project to 2D (XY plane) for hit testing here. Without this handler
 * the stair fell through to the `default:` branch and was excluded from the
 * hit-test pre-filter → unselectable on canvas.
 */
export function calculateStairBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
  // The stair flows through TWO entity shapes:
  //   - `DxfStair` wrapper (canvas pipeline): `entity.stairEntity.geometry.bbox`
  //   - flat `StairEntity` (hit-test pipeline post-convertToEntityModel):
  //     `entity.geometry.bbox`
  // Resolve from either shape so both code paths populate the spatial index.
  type StairLike = {
    id?: string;
    geometry?: { bbox?: BBoxLike };
    stairEntity?: { geometry?: { bbox?: BBoxLike } };
  };
  const stair = entity as StairLike;
  return bboxToBounds(stair.geometry?.bbox ?? stair.stairEntity?.geometry?.bbox, tolerance);
}

/** ADR-507 S2 — Hatch bounds: AABB over all boundary path vertices. */
export function calculateHatchBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
  const h = entity as { boundaryPaths?: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>> };
  return pointsToBounds((h.boundaryPaths ?? []).flat(), tolerance);
}

/**
 * 📐 ADR-362 Phase I3 — Dimension entity bounds from defPoints + textMidpoint.
 * defPoints cover extension-line origins + dim-line reference for all 10 variants.
 * The resulting AABB is used for spatial broad-phase (not final hit accept).
 */
export function calculateDimensionBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
  type DimLike = {
    defPoints?: readonly { x: number; y: number }[];
    textMidpoint?: { x: number; y: number };
  };
  const dim = entity as DimLike;
  const pts: { x: number; y: number }[] = [...(dim.defPoints ?? [])];
  if (dim.textMidpoint) pts.push(dim.textMidpoint);
  return pointsToBounds(pts, tolerance);
}

/**
 * 🧱 ADR-363 Phase 1B — BIM parametric entity bounds via pre-computed
 * `geometry.bbox` (BoundingBox3D, populated by per-type `compute*Geometry()`).
 * Projects to 2D plan view (XY). Same fallback contract as stair: if `geometry`
 * is missing (legacy / partially-serialized), returns null → caller drops
 * from spatial index gracefully.
 */
export function calculateBimEntityBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
  const bim = entity as { geometry?: { bbox?: BBoxLike } };
  return bboxToBounds(bim.geometry?.bbox, tolerance);
}

/** 🔺 LINE BOUNDS */
export function calculateLineBounds(entity: EntityModel, tolerance: number): BoundingBox {
  // 🏢 ENTERPRISE: Type-safe casting for LineEntity properties
  const lineEntity = entity as EntityWithLine;
  const start = lineEntity.start;
  const end = lineEntity.end;

  return createBoundingBox(
    Math.min(start.x, end.x) - tolerance,
    Math.min(start.y, end.y) - tolerance,
    Math.max(start.x, end.x) + tolerance,
    Math.max(start.y, end.y) + tolerance,
  );
}

/** 🔺 CIRCLE BOUNDS */
export function calculateCircleBounds(entity: EntityModel, tolerance: number): BoundingBox {
  // 🏢 ENTERPRISE: Type-safe casting for CircleEntity properties
  const circleEntity = entity as EntityWithCircle;
  const center = circleEntity.center;
  const radius = circleEntity.radius + tolerance;

  return createBoundingBox(
    center.x - radius,
    center.y - radius,
    center.x + radius,
    center.y + radius,
  );
}

/**
 * 🔺 ARC BOUNDS
 * Simplified — conservative circle bounds (θα μπορούσε να βελτιωθεί με ακριβή
 * υπολογισμό των endpoints).
 */
export function calculateArcBounds(entity: EntityModel, tolerance: number): BoundingBox {
  return calculateCircleBounds(entity, tolerance);
}

/** 🔺 POLYLINE BOUNDS */
export function calculatePolylineBounds(entity: EntityModel, tolerance: number): BoundingBox {
  // 🏢 ENTERPRISE: Type-safe casting for PolylineEntity properties
  const polylineEntity = entity as EntityWithPolyline;
  const vertices = polylineEntity.vertices;
  if (!vertices || vertices.length === 0) {
    return createBoundingBox(0, 0, 0, 0);
  }

  let minX = vertices[0].x;
  let minY = vertices[0].y;
  let maxX = vertices[0].x;
  let maxY = vertices[0].y;

  for (const vertex of vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return createBoundingBox(
    minX - tolerance,
    minY - tolerance,
    maxX + tolerance,
    maxY + tolerance,
  );
}

/** 🔺 RECTANGLE BOUNDS — το rectangle είναι polyline με 4 vertices. */
export function calculateRectangleBounds(entity: EntityModel, tolerance: number): BoundingBox {
  return calculatePolylineBounds(entity, tolerance);
}

/** 🔺 ELLIPSE BOUNDS — simplified: το bounding rectangle. */
export function calculateEllipseBounds(entity: EntityModel, tolerance: number): BoundingBox {
  // 🏢 ENTERPRISE: Type-safe casting for EllipseEntity properties
  const ellipseEntity = entity as EntityWithEllipse;
  const center = ellipseEntity.center;
  const radiusX = ellipseEntity.radiusX + tolerance;
  const radiusY = ellipseEntity.radiusY + tolerance;

  return createBoundingBox(
    center.x - radiusX,
    center.y - radiusY,
    center.x + radiusX,
    center.y + radiusY,
  );
}

/**
 * 🔺 TEXT BOUNDS — rotation-aware bounding box for text entities.
 *
 * 🏢 FIX (2026-02-20): Use entity.height (DXF standard) with proper fallback chain.
 * BEFORE: Used entity.fontSize || DEFAULT_FONT_SIZE (12) — but DXF entities have
 * `height` (e.g. 2.5), NOT `fontSize` → bounds were ~5x inflated → spatial index
 * returned text candidates from huge distances.
 *
 * AFTER: height || fontSize || 2.5 (AutoCAD Standard DIMTXT default)
 * Matches TextRenderer.extractTextHeight() priority chain.
 *
 * ADR-557 (multi-line, Giorgio 2026-07-07) — the spatial-index broad phase uses the
 * attachment / rotation / MULTI-LINE-aware em-box AABB SSoT (`textBoxAABB`), the generous
 * superset of the VISUAL hover/hit box (`resolveTextBox`). Was: a hardcoded single-line box
 * (`estimatedHeight = textHeight`, monospace width, baseline-top-left) → for multi-line text
 * lines 2..N sat BELOW the bbox, so the entity was never returned as a candidate and the
 * narrow-phase `hitTestText` never ran → πολυγραμμικά κείμενα δεν φωτίζονταν στο hover. The
 * em box is multi-line-aware (Σ γραμμών) + honours attachment / widthFactor / rotation, so it
 * always encloses every drawn line.
 */
export function calculateTextBounds(entity: EntityModel, tolerance: number): BoundingBox {
  const textEntity = entity as EntityWithText;
  const dxfText = {
    ...(textEntity as unknown as DxfText),
    height: textEntity.height || textEntity.fontSize || 2.5,
  };
  const aabb = textBoxAABB(dxfText);
  return createBoundingBox(
    aabb.minX - tolerance,
    aabb.minY - tolerance,
    aabb.maxX + tolerance,
    aabb.maxY + tolerance,
  );
}

/** 🔺 SPLINE BOUNDS — simplified: conservative bounds πάνω στα control points. */
export function calculateSplineBounds(entity: EntityModel, tolerance: number): BoundingBox {
  // 🏢 ENTERPRISE: Type-safe casting for SplineEntity properties
  const splineEntity = entity as EntityWithSpline;
  const controlPoints = splineEntity.controlPoints || splineEntity.vertices;
  if (!controlPoints || controlPoints.length === 0) {
    return createBoundingBox(0, 0, 0, 0);
  }

  // Use control points bounds (conservative) - create temporary polyline entity
  const polylineEntity: EntityModel & PolylineEntityProperties = {
    ...entity,
    vertices: controlPoints,
  };
  return calculatePolylineBounds(polylineEntity, tolerance);
}

/** 🔺 POINT BOUNDS */
export function calculatePointBounds(entity: EntityModel, tolerance: number): BoundingBox {
  // 🏢 ENTERPRISE: Type-safe casting for PointEntity properties
  const pointEntity = entity as EntityWithPoint;
  const position = pointEntity.position;
  const pointSize = tolerance || 1; // Minimum size for selection

  return createBoundingBox(
    position.x - pointSize,
    position.y - pointSize,
    position.x + pointSize,
    position.y + pointSize,
  );
}

/**
 * 🔺 ANGLE MEASUREMENT BOUNDS
 * Bounding box from vertex + 2 arm endpoints (point1, point2).
 */
export function calculateAngleMeasurementBounds(entity: EntityModel, tolerance: number): BoundingBox {
  const angleMeasurement = entity as EntityWithAngleMeasurement;
  const { vertex, point1, point2 } = angleMeasurement;

  return createBoundingBox(
    Math.min(vertex.x, point1.x, point2.x) - tolerance,
    Math.min(vertex.y, point1.y, point2.y) - tolerance,
    Math.max(vertex.x, point1.x, point2.x) + tolerance,
    Math.max(vertex.y, point1.y, point2.y) + tolerance,
  );
}
