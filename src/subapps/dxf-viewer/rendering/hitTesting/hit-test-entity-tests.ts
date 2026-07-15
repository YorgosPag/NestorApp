/**
 * Entity-Specific Hit Tests — ADR-065 SRP split
 * Per-entity-type precise hit testing functions.
 * Extracted from HitTester.ts.
 */

import type { Point2D } from '../types/Types';
import type { Entity, DimensionEntity } from '../../types/entities';
import type { EntityType } from '../../types/base-entity';
import { closedRingFromEdges, projectPointTo2D, projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import {
  isOpeningEntity,
  isSlabOpeningEntity,
  isWallEntity,
  isSlabEntity,
  isColumnEntity,
  isBeamEntity,
  isFloorFinishEntity,
  isWallCoveringEntity,
  isFoundationEntity,
  isSpaceSeparatorEntity,
  isHatchEntity,
  isAnnotationSymbolEntity,
  isScaleBarEntity,
  isOpeningInfoTagEntity,
  isTopoSurfaceEntity,
} from '../../types/entities';
// ADR-583 — annotative model-size SSoT for the North-arrow annotation symbol.
import { annotationSymbolModelSizeLive } from '../../bim/annotation-symbols/annotation-symbol-model-size';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../types/annotation-symbol';
// ADR-583 Φ2 — graphic scale-bar precise axis pick SSoT (shared with ScaleBarRenderer.hitTest).
import { hitTestScaleBarAxis } from '../../bim/scale-bar/scale-bar-hit';
// ADR-612 — opening info tag precise rotated point-in-box pick SSoT (sibling of scale-bar).
import { hitTestOpeningInfoTag } from '../../bim/opening-info-tag/opening-info-tag-hit';
import type { HitTestResult, SnapResult } from './hit-tester-types';
import { pointToLineDistance, clamp } from '../entities/shared/geometry-utils';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { imageEntityRectVertices, type ImageRectShape } from '../entities/shared/image-rect-vertices';
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { pointToInfiniteLineDistance } from '../utils/point-to-line-distance';
import { pointToRayDistance } from '../utils/point-to-line-distance';
// ADR-362/measurement — annotation hit-tests extracted to a sibling module (N.7.1).
import { hitTestText, hitTestAngleMeasurement, hitTestDimension } from './hit-test-annotations';
// ADR-362 Phase I3 hotfix (2026-05-19) — SSoT for dim foot points / text anchor.
import { HINGE_ARC_SUBDIVISIONS } from '../../bim/geometry/opening-geometry';

/** Ένας narrow-phase (ακριβής) hit test. Το `null` σημαίνει **αστοχία**, όχι «δεν ξέρω». */
export type NarrowHitTest = (
  entity: Entity, point: Point2D, tolerance: number,
) => Partial<HitTestResult> | null;

/**
 * ADR-583 Φ2 — graphic scale-bar: precise distance-to-axis-segment within the live
 * annotative half-thickness (SSoT shared with ScaleBarRenderer.hitTest). Tighter than
 * the bbox fallback, which would highlight the empty corners of a rotated bar's bbox.
 */
const hitTestScaleBar: NarrowHitTest = (entity, point, tolerance) =>
  isScaleBarEntity(entity) && hitTestScaleBarAxis(entity, point, tolerance)
    ? { hitType: 'entity', hitPoint: point }
    : null;

/**
 * ADR-612 — opening info tag: precise rotated point-in-box pick (SSoT shared with
 * the renderer / inline cell editor). Tighter than the bbox fallback, which would
 * highlight the empty corners of a rotated tag's bbox.
 */
const hitTestOpeningInfoTagEntity: NarrowHitTest = (entity, point, tolerance) =>
  isOpeningInfoTagEntity(entity) && hitTestOpeningInfoTag(entity, point, tolerance)
    ? { hitType: 'entity', hitPoint: point }
    : null;

/**
 * 🎯 NARROW-PHASE REGISTRY (ADR-587 Φ10) — per-type ακριβές hit test.
 *
 * Απόν κλειδί ⇒ ο τύπος πέφτει στο **permissive bbox fallback** του
 * {@link performDetailedHitTest}: το broad phase (spatial index) έχει ήδη επιβεβαιώσει
 * ότι το σημείο είναι μέσα στο AABB, οπότε δεχόμαστε το pick με ακρίβεια-bbox.
 *
 * ⚠️ **Συνειδητή ασυμμετρία** με τα άλλα δύο seams της Φ10 (Bounds / entity-model), όπου
 * το `default` γύριζε `null` (= σιωπηλή εξαφάνιση). Εδώ το fallback είναι **γενναιόδωρο**:
 * ο τύπος παραμένει επιλέξιμος — απλώς λιγότερο ακριβώς (π.χ. σκάλα: bbox αντί για
 * treads/stringers). ΔΕΝ το «διορθώνουμε» σε `null` — αυτό θα έκανε ΜΗ-επιλέξιμους τους
 * τύπους που σήμερα δουλεύουν. Το coverage test καρφώνει ρητά ΠΟΙΟΙ τύποι είναι bbox-only
 * και γιατί, ώστε η επιλογή να μένει συνειδητή αντί για ατύχημα.
 */
export const NARROW_HIT_TEST_HANDLERS: Partial<Record<EntityType, NarrowHitTest>> = {
  // ── CAD primitives ──
  line: hitTestLine,
  circle: hitTestCircle,
  arc: hitTestArc,
  polyline: hitTestPolyline,
  lwpolyline: hitTestPolyline,
  // ADR-635 Φάση B — leader callout: point-to-segment στα path vertices (open path). Το
  // `hitTestPolyline` διαβάζει `'vertices' in entity` + `closed` (undefined → open, n-1 edges),
  // άρα καλύπτει τον leader αυτούσιο — SSoT με `LeaderRenderer.hitTest` (hitTestLineSegments).
  leader: hitTestPolyline,
  rectangle: hitTestRectangle,
  rect: hitTestRectangle,
  text: hitTestText,
  mtext: hitTestText,
  'angle-measurement': hitTestAngleMeasurement,
  dimension: (entity, point, tolerance) => hitTestDimension(entity as DimensionEntity, point, tolerance),
  // ADR-359 Phase 11 — precise hit-test for construction lines.
  xline: hitTestXLine,
  ray: hitTestRay,
  // ADR-507 — hatch even-odd polygon containment (outer ring minus island rings), mirror of
  // HatchRenderer.hitTest. Χωρίς αυτό έπεφτε σε AABB-only → over-select σε μη-κυρτά hatch.
  hatch: hitTestHatch,

  // ── Annotations ──
  // ADR-583 — round annotation symbol (North arrow): distance-to-centre within the annotative
  // glyph radius (tighter than the AABB, which over-selects the corners of a circular mark).
  'annotation-symbol': hitTestAnnotationSymbol,
  'scale-bar': hitTestScaleBar,
  'opening-info-tag': hitTestOpeningInfoTagEntity,
  // ADR-651 Φάση Ε — standalone raster image: rotation-aware point-in-rect (fill hit-test,
  // SSoT shared with ImageRenderer.hitTest — click anywhere inside the picture selects it).
  image: hitTestImage,
  // ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived topo surface: point-in-polygon footprint
  // containment (SSoT shared with TopoSurfaceRenderer.hitTest — click inside selects it).
  'topo-surface': hitTestTopoSurface,

  // ── BIM (ADR-363 Bug 1 — polygon containment) ──
  // Cached outline vertices στο `geometry`/`params` δίνουν τα 4-vertex (opening/slab-opening)
  // ή N-vertex (slab/column/beam) world-coord polygons. Ο τοίχος χρησιμοποιεί outerEdge +
  // innerEdge reversed ένωση για το cross-section footprint.
  opening: hitTestOpening,
  'slab-opening': hitTestSlabOpening,
  slab: hitTestSlab,
  wall: hitTestWall,
  column: hitTestColumn,
  beam: hitTestBeam,
  // ADR-436 Slice 1b — foundation footprint polygon containment (mirror column).
  foundation: hitTestFoundation,
  // ADR-419 — floor-finish polygon containment (same as slab/slab-opening).
  'floor-finish': hitTestFloorFinish,
  // ADR-511 — wall-covering strip containment (cached outline from host wall).
  'wall-covering': hitTestWallCovering,
  // ADR-437 — space separator: point-to-segment distance (a thin line needs a tolerance
  // corridor, NOT bbox-only — else the diagonal-line bbox over-selects).
  'space-separator': hitTestSpaceSeparator,
};

/** Οι τύποι με ΑΚΡΙΒΕΣ narrow-phase test (runtime mirror του registry — ποτέ stale). */
export const NARROW_HIT_TEST_SUPPORTED_TYPES: readonly EntityType[] =
  Object.keys(NARROW_HIT_TEST_HANDLERS) as EntityType[];

/**
 * Dispatch hit test to the correct entity-type handler. Χωρίς handler → permissive
 * bbox-accuracy pick (βλ. {@link NARROW_HIT_TEST_HANDLERS} — τεκμηριωμένο fallback, ΟΧΙ
 * σιωπηλό null).
 */
export function performDetailedHitTest(
  entity: Entity, point: Point2D, tolerance: number
): Partial<HitTestResult> | null {
  const narrow = NARROW_HIT_TEST_HANDLERS[entity.type as EntityType];
  return narrow
    ? narrow(entity, point, tolerance)
    : { hitType: 'entity', hitPoint: point };
}

function hitTestImage(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  const vertices = imageEntityRectVertices(entity as unknown as ImageRectShape);
  if (!vertices) return null;
  return isPointInPolygon(point, vertices) ? { hitType: 'entity', hitPoint: point } : null;
}

// ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived topo surface: point-in-polygon σε ΟΠΟΙΟΔΗΠΟΤΕ
// footprint ring (mirror TopoSurfaceRenderer.hitTest — κλικ μέσα στην επιφάνεια την επιλέγει).
// `.some` (ΟΧΙ even-odd σαν το hatch): τα rings είναι διακριτές συμπαγείς περιοχές (TIN
// perimeter/islands), όχι outer-minus-holes. Το footprint είναι ήδη world-2D (καμία projection).
function hitTestTopoSurface(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isTopoSurfaceEntity(entity)) return null;
  return entity.footprint.some((ring) => ring.length >= 3 && isPointInPolygon(point, ring))
    ? { hitType: 'entity', hitPoint: point }
    : null;
}

function hitTestAnnotationSymbol(
  entity: Entity, point: Point2D, tolerance: number,
): Partial<HitTestResult> | null {
  if (!isAnnotationSymbolEntity(entity)) return null;
  const modelSize = annotationSymbolModelSizeLive(entity.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM);
  const reach = modelSize / 2 + tolerance;
  return calculateDistance(point, entity.position) <= reach
    ? { hitType: 'entity', hitPoint: point }
    : null;
}

function hitTestHatch(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isHatchEntity(entity)) return null;
  const paths = (entity.boundaryPaths ?? []).filter((p) => p.length >= 3);
  if (paths.length === 0) return null;
  let inside = 0;
  for (const path of paths) if (isPointInPolygon(point, projectVerticesTo2D(path))) inside += 1;
  return inside % 2 === 1 ? { hitType: 'entity', hitPoint: point } : null;
}

// ===== BIM ENTITIES (ADR-363 Bug 1 — polygon containment) =====

function hitTestOpening(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!isOpeningEntity(entity)) return null;
  const geom = entity.geometry;
  if (!geom) return null;

  // 1. Outline rectangle (cutout inside wall thickness).
  const verts = geom.outline?.vertices;
  if (verts && verts.length >= 3 && isPointInPolygon(point, projectVerticesTo2D(verts))) {
    return { hitType: 'entity', hitPoint: point };
  }

  const arc = geom.hingeArc;
  const hinge = geom.hingeAnchor;

  // 2. Leaf line(s) — solid door panel at 90°-open position.
  if (hinge && arc && arc.points.length > HINGE_ARC_SUBDIVISIONS) {
    if (pointToLineDistance(point, projectPointTo2D(hinge), projectPointTo2D(arc.points[HINGE_ARC_SUBDIVISIONS])) <= tolerance) {
      return { hitType: 'entity', hitPoint: point };
    }
    const hinge2 = geom.hingeAnchor2;
    if (hinge2 && arc.points.length > HINGE_ARC_SUBDIVISIONS + 1) {
      if (pointToLineDistance(point, projectPointTo2D(hinge2), projectPointTo2D(arc.points[HINGE_ARC_SUBDIVISIONS + 1])) <= tolerance) {
        return { hitType: 'entity', hitPoint: point };
      }
    }
  }

  // 3. Swing arc — test each chord segment.
  if (arc && arc.points.length >= 2) {
    for (let i = 0; i < arc.points.length - 1; i++) {
      if (pointToLineDistance(point, projectPointTo2D(arc.points[i]), projectPointTo2D(arc.points[i + 1])) <= tolerance) {
        return { hitType: 'entity', hitPoint: point };
      }
    }
  }

  return null;
}

/**
 * Κοινό polygon-containment hit-test (SSoT): cached outline/footprint vertices
 * (3D world) → proj(2D) → point-in-polygon. `< 3` σημεία ή absent → null (πέφτει
 * σε broad-phase bbox). Μοιράζεται από ΟΛΑ τα BIM footprint entities.
 */
function hitTestPolygonContainment(
  verts: readonly { readonly x: number; readonly y: number }[] | undefined,
  point: Point2D,
): Partial<HitTestResult> | null {
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts))
    ? { hitType: 'entity', hitPoint: point }
    : null;
}

function hitTestSlabOpening(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isSlabOpeningEntity(entity)) return null;
  return hitTestPolygonContainment(entity.params?.outline?.vertices, point);
}

function hitTestSlab(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isSlabEntity(entity)) return null;
  return hitTestPolygonContainment(entity.params?.outline?.vertices, point);
}

function hitTestFloorFinish(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isFloorFinishEntity(entity)) return null;
  return hitTestPolygonContainment(entity.params?.footprint?.vertices, point);
}

function hitTestWallCovering(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isWallCoveringEntity(entity)) return null;
  // Cached strip outline (4 σημεία) από τον host τοίχο (build/edit time). Absent αν ο host
  // έλειπε στο build → no precise target (πέφτει σε broad-phase bbox μέσω geometry.bbox).
  return hitTestPolygonContainment(entity.geometry?.outline, point);
}

function hitTestSpaceSeparator(
  entity: Entity, point: Point2D, tolerance: number,
): Partial<HitTestResult> | null {
  if (!isSpaceSeparatorEntity(entity)) return null;
  const { start, end } = entity.params;
  if (!start || !end) return null;
  return pointToLineDistance(point, projectPointTo2D(start), projectPointTo2D(end)) <= tolerance
    ? { hitType: 'entity', hitPoint: point }
    : null;
}

function hitTestWall(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isWallEntity(entity)) return null;
  const outer = entity.geometry?.outerEdge?.points;
  const inner = entity.geometry?.innerEdge?.points;
  if (!outer || !inner || outer.length < 2 || inner.length < 2) return null;
  // Build closed footprint: outer forward + inner reversed (matches buildWallShape) — SSoT.
  const ring: Point2D[] = projectVerticesTo2D(closedRingFromEdges(outer, inner));
  if (ring.length < 3) return null;
  return isPointInPolygon(point, ring) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestColumn(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isColumnEntity(entity)) return null;
  return hitTestPolygonContainment(entity.geometry?.footprint?.vertices, point);
}

// ADR-436 Slice 1b — foundation footprint containment (pad/strip/tie-beam all
// expose `geometry.footprint.vertices`; identical to column polygon test).
function hitTestFoundation(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isFoundationEntity(entity)) return null;
  return hitTestPolygonContainment(entity.geometry?.footprint?.vertices, point);
}

function hitTestBeam(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isBeamEntity(entity)) return null;
  return hitTestPolygonContainment(entity.geometry?.outline?.vertices, point);
}

// ===== LINE =====

function hitTestLine(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('start' in entity) || !('end' in entity)) return null;
  const lineEntity = entity as { start: Point2D; end: Point2D };
  const distance = pointToLineDistance(point, lineEntity.start, lineEntity.end);

  if (distance <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, lineEntity.start, lineEntity.end) };
  }
  return null;
}

// ===== CIRCLE =====

function hitTestCircle(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('center' in entity) || !('radius' in entity)) return null;
  const circleEntity = entity as { center: Point2D; radius: number };
  const distanceFromCenter = calculateDistance(point, circleEntity.center);
  const distanceFromCircumference = Math.abs(distanceFromCenter - circleEntity.radius);

  if (distanceFromCircumference <= tolerance) {
    return { hitType: 'entity', hitPoint: point };
  }
  return null;
}

// ===== ARC =====

function hitTestArc(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('center' in entity) || !('radius' in entity) || !('startAngle' in entity) || !('endAngle' in entity)) {
    return null;
  }
  const arcEntity = entity as { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean };
  const distance = pointToArcDistance(point, arcEntity);
  if (distance <= tolerance) {
    return { hitType: 'entity', hitPoint: point };
  }
  return null;
}

// ===== POLYLINE =====

/**
 * Edge-walk hit-test (SSoT polyline/rectangle): για κάθε ακμή `[i,(i+1)%n]` ελέγχει
 * απόσταση σημείου· hit → `{ edgeIndex, hitPoint=closestPointOnLine }`, αλλιώς null.
 */
function hitTestEdges(
  point: Point2D,
  vertices: readonly Point2D[],
  edgeCount: number,
  tolerance: number,
): Partial<HitTestResult> | null {
  for (let i = 0; i < edgeCount; i++) {
    const nextIndex = (i + 1) % vertices.length;
    const distance = pointToLineDistance(point, vertices[i], vertices[nextIndex]);
    if (distance <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: closestPointOnLine(point, vertices[i], vertices[nextIndex]),
        edgeIndex: i,
      };
    }
  }
  return null;
}

function hitTestPolyline(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('vertices' in entity)) return null;
  const polylineEntity = entity as { vertices: Point2D[]; closed?: boolean };
  const vertices = polylineEntity.vertices;
  if (!vertices || vertices.length < 2) return null;

  // STROKE-ONLY (Revit / ArchiCAD / Figma / AutoCAD): ένα wireframe κλειστό polyline επιλέγεται
  // από το ΠΕΡΙΓΡΑΜΜΑ, όχι από το γέμισμα — αλλιώς σε ομόκεντρα σχήματα (π.χ. ισοϋψείς) ο
  // εξωτερικός δακτύλιος «καταπίνει» με το fill του όλους τους εσωτερικούς. Ίδιο συμβόλαιο με
  // rect/circle (ήδη stroke-only). Το «κλικ ΜΕΣΑ» είναι πλέον ρητή δυνατότητα → `enclosure-hit.ts`
  // + `pickTopEntityAt(..., { includeEnclosure })` (μόνο όποιο εργαλείο τη ζητά, π.χ. όριο οικοπέδου).
  const edgeCount = polylineEntity.closed ? vertices.length : vertices.length - 1;
  return hitTestEdges(point, vertices, edgeCount, tolerance);
}

// ===== RECTANGLE =====

function hitTestRectangle(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('x' in entity) || !('y' in entity) || !('width' in entity) || !('height' in entity)) {
    return null;
  }
  const rect = entity as { x: number; y: number; width: number; height: number };
  const vertices: Point2D[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return hitTestEdges(point, vertices, 4, tolerance);
}

// ===== TEXT / ANGLE / DIMENSION =====
// Annotation hit-tests extracted to `hit-test-annotations.ts` (N.7.1); the
// dispatcher above calls the three entry points re-imported at the top.

// ===== SNAP STUBS =====

export function getVertexSnap(_entity: Entity, _point: Point2D, _maxDistance: number): SnapResult | null {
  return null;
}

export function getEdgeSnap(_entity: Entity, _point: Point2D, _maxDistance: number): SnapResult | null {
  return null;
}

export function getCenterSnap(_entity: Entity, _point: Point2D, _maxDistance: number): SnapResult | null {
  return null;
}

export function getGridSnap(_point: Point2D, _tolerance: number): SnapResult | null {
  return null;
}

// ===== GEOMETRY HELPERS =====

export function closestPointOnLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  if (lenSq === 0) return lineStart;

  const param = clamp(dot / lenSq, 0, 1);
  return {
    x: lineStart.x + param * C,
    y: lineStart.y + param * D,
  };
}

// ===== XLINE =====

function hitTestXLine(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  type XLike = { basePoint?: Point2D; direction?: Point2D };
  const { basePoint, direction } = entity as XLike;
  if (!basePoint || !direction) return null;
  const dist = pointToInfiniteLineDistance(point, basePoint, direction);
  return dist <= tolerance ? { hitType: 'entity', hitPoint: point } : null;
}

// ===== RAY =====

function hitTestRay(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  type RLike = { basePoint?: Point2D; direction?: Point2D };
  const { basePoint, direction } = entity as RLike;
  if (!basePoint || !direction) return null;
  const dist = pointToRayDistance(point, basePoint, direction);
  return dist <= tolerance ? { hitType: 'entity', hitPoint: point } : null;
}
