/**
 * BOUNDS UTILITIES - Bounding box calculations για spatial indexing
 * ✅ ΦΑΣΗ 5: Core utilities για hit-testing και spatial queries
 */

import type { EntityModel } from '../types/Types';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-557 (multi-line) — the attachment/rotation/multi-line-aware text-box AABB SSoT (em box),
// the generous superset the spatial-index broad phase uses so it always encloses every line.
import { textBoxAABB } from '../../bim/text/text-box';
import { calculateXLineBounds, calculateRayBounds } from './bounds-parametric-line';
// ADR-583 — annotative model-size SSoT for the North-arrow annotation symbol.
import { annotationSymbolModelSizeLive } from '../../bim/annotation-symbols/annotation-symbol-model-size';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../types/annotation-symbol';
// ADR-583 Φ2 — graphic scale-bar axis-extent bbox + live annotative half-thickness SSoT.
import { computeScaleBarGeometry } from '../../bim/geometry/scale-bar-geometry';
import { scaleBarModelHalfThicknessLive } from '../../bim/scale-bar/scale-bar-hit';
import type { ScaleBarEntity } from '../../types/scale-bar';
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

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * 🔺 BOUNDING BOX CALCULATOR
 * Υπολογίζει bounding boxes για όλους τους τύπους entities
 */
export class BoundsCalculator {
  /**
   * 🔺 MAIN ENTITY BOUNDS CALCULATION
   * Υπολογίζει το bounding box ενός entity με μικρό tolerance
   */
  static calculateEntityBounds(entity: EntityModel, tolerance = 0): BoundingBox | null {
    switch (entity.type) {
      case 'line':
        return this.calculateLineBounds(entity, tolerance);
      case 'circle':
        return this.calculateCircleBounds(entity, tolerance);
      case 'arc':
        return this.calculateArcBounds(entity, tolerance);
      case 'polyline':
      case 'lwpolyline':
        return this.calculatePolylineBounds(entity, tolerance);
      // ADR-507 S2 — hatch bounds = AABB πάνω σε όλα τα boundaryPaths (spatial index/hit-test).
      case 'hatch':
        return this.calculateHatchBounds(entity, tolerance);
      case 'rectangle':
      case 'rect':
        return this.calculateRectangleBounds(entity, tolerance);
      case 'ellipse':
        return this.calculateEllipseBounds(entity, tolerance);
      case 'text':
      case 'mtext':
        return this.calculateTextBounds(entity, tolerance);
      case 'spline':
        return this.calculateSplineBounds(entity, tolerance);
      case 'point':
        return this.calculatePointBounds(entity, tolerance);
      // ADR-583 — annotation symbol (North arrow): annotative square footprint around
      // the insertion point (no geometry.bbox — lightweight). Without this case it fell
      // to `default` → null → excluded from the spatial index → unselectable on canvas.
      case 'annotation-symbol':
        return this.calculateAnnotationSymbolBounds(entity, tolerance);
      // ADR-583 Φ2 — graphic scale-bar: the scale-invariant axis-extent bbox
      // (computeScaleBarGeometry) padded by the live annotative half-thickness so the
      // broad phase encloses the ±half-thickness pick corridor (else the narrow phase
      // never runs when hovering the drawn band above the axis). Mirror annotation-symbol.
      case 'scale-bar':
        return this.calculateScaleBarBounds(entity, tolerance);
      case 'angle-measurement':
        return this.calculateAngleMeasurementBounds(entity, tolerance);
      case 'stair':
        return this.calculateStairBounds(entity, tolerance);
      // ADR-362 Phase I3 — dimension spatial-index bounds via defPoints + textMidpoint.
      case 'dimension':
        return this.calculateDimensionBounds(entity, tolerance);
      // BIM parametric entities all project their pre-computed `geometry.bbox`
      // to 2D (XY plane) via the shared `calculateBimEntityBounds` SSoT. Added
      // by: ADR-363 (wall/opening/slab/slab-opening/column/beam), ADR-406
      // (mep-fixture), ADR-408 Φ3 (electrical-panel), ADR-407 (railing),
      // ADR-410 (furniture), ADR-408 Φ8 (mep-segment), ADR-408 Φ11 (mep-fitting),
      // ADR-415 (floorplan-symbol), ADR-417 (roof), ADR-408 Φ12 (mep-manifold),
      // ADR-408 Εύρος Β (mep-radiator).
      case 'wall':
      case 'opening':
      case 'slab':
      case 'slab-opening':
      case 'column':
      case 'beam':
      // ADR-436 Slice 1b — foundation pad/strip/tie-beam; geometry.bbox from computeFoundationGeometry().
      case 'foundation':
      case 'mep-fixture':
      case 'electrical-panel':
      case 'railing':
      case 'furniture':
      case 'mep-segment':
      case 'mep-fitting':
      case 'floorplan-symbol':
      case 'roof':
      // ADR-419 — floor-finish polygon covering; geometry.bbox computed by computeFloorFinishGeometry().
      case 'floor-finish':
      case 'mep-manifold':
      case 'mep-radiator':
      // ADR-408 Εύρος Β #2 (mep-boiler).
      case 'mep-boiler':
      // ADR-408 DHW — domestic hot water heater; geometry.bbox from computeMepWaterHeaterGeometry().
      case 'mep-water-heater':
      // ADR-408 Εύρος Β #3 — underfloor heating loop; geometry.bbox from computeMepUnderfloorGeometry().
      case 'mep-underfloor':
      // ADR-422 L0 — thermal space (analytical IfcSpace); geometry.bbox from computeThermalSpaceGeometry().
      case 'thermal-space':
      // ADR-437 — space separator (IfcVirtualElement); geometry.bbox from computeSpaceSeparatorGeometry().
      case 'space-separator':
        return this.calculateBimEntityBounds(entity, tolerance);
      // ADR-359 Phase 11 follow-up — XLINE/RAY bounds extracted to sibling module.
      case 'xline':
        return calculateXLineBounds(entity, tolerance);
      case 'ray':
        return calculateRayBounds(entity, tolerance);
      default:
        console.warn(`BoundsCalculator: Unknown entity type: ${entity.type}`);
        return null;
    }
  }

  /**
   * Κοινό SSoT: pre-computed 2D-projected `bbox {min,max}` → `BoundingBox` με
   * tolerance. Absent/partial bbox (legacy / partially-serialized) → `null` →
   * ο caller πέφτει gracefully εκτός spatial index. Μοιράζεται από stair/BIM.
   */
  private static bboxToBounds(
    bbox: { min?: { x: number; y: number }; max?: { x: number; y: number } } | undefined,
    tolerance: number,
  ): BoundingBox | null {
    if (!bbox || !bbox.min || !bbox.max) return null;
    return this.createBoundingBox(
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
  private static pointsToBounds(
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
    return this.createBoundingBox(minX - tolerance, minY - tolerance, maxX + tolerance, maxY + tolerance);
  }

  /**
   * 🪜 ADR-358 Phase 8 — StairEntity bounds via pre-computed `geometry.bbox`.
   * `computeStairGeometry()` populates an axis-aligned 3D bbox at construction
   * time; we project to 2D (XY plane) for hit testing here. Without this case
   * the stair fell through to the `default:` branch and was excluded from the
   * hit-test pre-filter → unselectable on canvas.
   */
  private static calculateStairBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
    // The stair flows through TWO entity shapes:
    //   - `DxfStair` wrapper (canvas pipeline): `entity.stairEntity.geometry.bbox`
    //   - flat `StairEntity` (hit-test pipeline post-convertToEntityModel):
    //     `entity.geometry.bbox`
    // Resolve from either shape so both code paths populate the spatial index.
    type StairLike = {
      id?: string;
      geometry?: { bbox?: { min?: { x: number; y: number }; max?: { x: number; y: number } } };
      stairEntity?: {
        geometry?: { bbox?: { min?: { x: number; y: number }; max?: { x: number; y: number } } };
      };
    };
    const stair = entity as StairLike;
    return this.bboxToBounds(stair.geometry?.bbox ?? stair.stairEntity?.geometry?.bbox, tolerance);
  }

  /** ADR-507 S2 — Hatch bounds: AABB over all boundary path vertices. */
  private static calculateHatchBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
    const h = entity as { boundaryPaths?: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>> };
    return this.pointsToBounds((h.boundaryPaths ?? []).flat(), tolerance);
  }

  /**
   * 📐 ADR-362 Phase I3 — Dimension entity bounds from defPoints + textMidpoint.
   * defPoints cover extension-line origins + dim-line reference for all 10 variants.
   * The resulting AABB is used for spatial broad-phase (not final hit accept).
   */
  private static calculateDimensionBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
    type DimLike = {
      defPoints?: readonly { x: number; y: number }[];
      textMidpoint?: { x: number; y: number };
    };
    const dim = entity as DimLike;
    const pts: { x: number; y: number }[] = [...(dim.defPoints ?? [])];
    if (dim.textMidpoint) pts.push(dim.textMidpoint);
    return this.pointsToBounds(pts, tolerance);
  }

  /**
   * 🧱 ADR-363 Phase 1B — BIM parametric entity bounds via pre-computed
   * `geometry.bbox` (BoundingBox3D, populated by per-type `compute*Geometry()`).
   * Projects to 2D plan view (XY). Same fallback contract as stair: if `geometry`
   * is missing (legacy / partially-serialized), returns null → caller drops
   * from spatial index gracefully.
   */
  private static calculateBimEntityBounds(entity: EntityModel, tolerance: number): BoundingBox | null {
    type BimLike = {
      geometry?: { bbox?: { min?: { x: number; y: number }; max?: { x: number; y: number } } };
    };
    const bim = entity as BimLike;
    return this.bboxToBounds(bim.geometry?.bbox, tolerance);
  }

  /**
   * 🔺 LINE BOUNDS
   */
  private static calculateLineBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for LineEntity properties
    const lineEntity = entity as EntityWithLine;
    const start = lineEntity.start;
    const end = lineEntity.end;

    const minX = Math.min(start.x, end.x) - tolerance;
    const minY = Math.min(start.y, end.y) - tolerance;
    const maxX = Math.max(start.x, end.x) + tolerance;
    const maxY = Math.max(start.y, end.y) + tolerance;

    return this.createBoundingBox(minX, minY, maxX, maxY);
  }

  /**
   * 🔺 CIRCLE BOUNDS
   */
  private static calculateCircleBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for CircleEntity properties
    const circleEntity = entity as EntityWithCircle;
    const center = circleEntity.center;
    const radius = circleEntity.radius + tolerance;

    return this.createBoundingBox(
      center.x - radius,
      center.y - radius,
      center.x + radius,
      center.y + radius
    );
  }

  /**
   * 🔺 ARC BOUNDS
   * Simplified - θα μπορούσε να βελτιωθεί με ακριβή υπολογισμό των endpoints
   */
  private static calculateArcBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // Για τώρα χρησιμοποιούμε circle bounds (conservative approach)
    return this.calculateCircleBounds(entity, tolerance);
  }

  /**
   * 🔺 POLYLINE BOUNDS
   */
  private static calculatePolylineBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for PolylineEntity properties
    const polylineEntity = entity as EntityWithPolyline;
    const vertices = polylineEntity.vertices;
    if (!vertices || vertices.length === 0) {
      return this.createBoundingBox(0, 0, 0, 0);
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

    return this.createBoundingBox(
      minX - tolerance,
      minY - tolerance,
      maxX + tolerance,
      maxY + tolerance
    );
  }

  /**
   * 🔺 RECTANGLE BOUNDS
   */
  private static calculateRectangleBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // Rectangle είναι polyline με 4 vertices
    return this.calculatePolylineBounds(entity, tolerance);
  }

  /**
   * 🔺 ELLIPSE BOUNDS
   * Simplified - χρησιμοποιεί το bounding rectangle
   */
  private static calculateEllipseBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for EllipseEntity properties
    const ellipseEntity = entity as EntityWithEllipse;
    const center = ellipseEntity.center;
    const radiusX = ellipseEntity.radiusX + tolerance;
    const radiusY = ellipseEntity.radiusY + tolerance;

    return this.createBoundingBox(
      center.x - radiusX,
      center.y - radiusY,
      center.x + radiusX,
      center.y + radiusY
    );
  }

  /**
   * 🔺 TEXT BOUNDS
   * Rotation-aware bounding box for text entities.
   *
   * 🏢 FIX (2026-02-20): Use entity.height (DXF standard) with proper fallback chain.
   * BEFORE: Used entity.fontSize || DEFAULT_FONT_SIZE (12) — but DXF entities have
   * `height` (e.g. 2.5), NOT `fontSize` → bounds were ~5x inflated → spatial index
   * returned text candidates from huge distances.
   *
   * AFTER: height || fontSize || 2.5 (AutoCAD Standard DIMTXT default)
   * Matches TextRenderer.extractTextHeight() priority chain.
   *
   * Also handles rotation: for rotated text (e.g. vertical dimension text at 90°),
   * the AABB is computed from the rotated corners of the text rectangle.
   */
  private static calculateTextBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // ADR-557 (multi-line, Giorgio 2026-07-07) — the spatial-index broad phase now uses the
    // attachment / rotation / MULTI-LINE-aware em-box AABB SSoT (`textBoxAABB`), the generous
    // superset of the VISUAL hover/hit box (`resolveTextBox`). Was: a hardcoded single-line box
    // (`estimatedHeight = textHeight`, monospace width, baseline-top-left) → for multi-line text
    // lines 2..N sat BELOW the bbox, so the entity was never returned as a candidate and the
    // narrow-phase `hitTestText` never ran → πολυγραμμικά κείμενα δεν φωτίζονταν στο hover. The
    // em box is multi-line-aware (Σ γραμμών) + honours attachment / widthFactor / rotation, so it
    // always encloses every drawn line. Height / fontSize / 2.5 fallback preserved.
    const textEntity = entity as EntityWithText;
    const dxfText = {
      ...(textEntity as unknown as DxfText),
      height: textEntity.height || textEntity.fontSize || 2.5,
    };
    const aabb = textBoxAABB(dxfText);
    return this.createBoundingBox(
      aabb.minX - tolerance,
      aabb.minY - tolerance,
      aabb.maxX + tolerance,
      aabb.maxY + tolerance,
    );
  }

  /**
   * 🔺 SPLINE BOUNDS
   * Simplified - χρησιμοποιεί τα control points
   */
  private static calculateSplineBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for SplineEntity properties
    const splineEntity = entity as EntityWithSpline;
    const controlPoints = splineEntity.controlPoints || splineEntity.vertices;
    if (!controlPoints || controlPoints.length === 0) {
      return this.createBoundingBox(0, 0, 0, 0);
    }

    // Use control points bounds (conservative) - create temporary polyline entity
    const polylineEntity: EntityModel & PolylineEntityProperties = {
      ...entity,
      vertices: controlPoints
    };
    return this.calculatePolylineBounds(polylineEntity, tolerance);
  }

  /**
   * 🔺 POINT BOUNDS
   */
  /**
   * ADR-583 — annotation symbol (North arrow) spatial bounds. The paper `sizeMm`
   * is folded to model units at the live drawing scale (same SSoT the renderer +
   * `entity-bounds` use), giving a square footprint around the insertion point that
   * the broad-phase index / hover pre-filter can enclose.
   */
  private static calculateAnnotationSymbolBounds(entity: EntityModel, tolerance: number): BoundingBox {
    const e = entity as EntityModel & { position: { x: number; y: number }; sizeMm?: number };
    const modelSize = annotationSymbolModelSizeLive(e.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM);
    const half = modelSize / 2 + tolerance;
    return this.createBoundingBox(
      e.position.x - half,
      e.position.y - half,
      e.position.x + half,
      e.position.y + half,
    );
  }

  /**
   * ADR-583 Φ2 — graphic scale-bar spatial bounds. The DERIVED axis-extent bbox
   * (scale-invariant canonical-mm from `computeScaleBarGeometry`, hence the `(1,'mm')`
   * placeholders) padded on all sides by the LIVE annotative half-thickness — the same
   * `±halfThickness` corridor `hitTestScaleBarAxis` gates on — so the broad phase always
   * encloses the narrow phase. Without this the axis bbox is a zero-height line and the
   * candidate is dropped whenever the cursor sits on the drawn band (mirror annotation-symbol).
   */
  private static calculateScaleBarBounds(entity: EntityModel, tolerance: number): BoundingBox {
    const e = entity as unknown as ScaleBarEntity;
    const { bbox } = computeScaleBarGeometry(e, 1, 'mm');
    const pad = scaleBarModelHalfThicknessLive(e) + tolerance;
    return this.createBoundingBox(
      bbox.minX - pad,
      bbox.minY - pad,
      bbox.maxX + pad,
      bbox.maxY + pad,
    );
  }

  private static calculatePointBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for PointEntity properties
    const pointEntity = entity as EntityWithPoint;
    const position = pointEntity.position;
    const pointSize = tolerance || 1; // Minimum size for selection

    return this.createBoundingBox(
      position.x - pointSize,
      position.y - pointSize,
      position.x + pointSize,
      position.y + pointSize
    );
  }

  /**
   * 🔺 ANGLE MEASUREMENT BOUNDS
   * Bounding box from vertex + 2 arm endpoints (point1, point2)
   */
  private static calculateAngleMeasurementBounds(entity: EntityModel, tolerance: number): BoundingBox {
    const angleMeasurement = entity as EntityWithAngleMeasurement;
    const { vertex, point1, point2 } = angleMeasurement;

    const minX = Math.min(vertex.x, point1.x, point2.x) - tolerance;
    const minY = Math.min(vertex.y, point1.y, point2.y) - tolerance;
    const maxX = Math.max(vertex.x, point1.x, point2.x) + tolerance;
    const maxY = Math.max(vertex.y, point1.y, point2.y) + tolerance;

    return this.createBoundingBox(minX, minY, maxX, maxY);
  }

  /**
   * 🔺 BOUNDING BOX FACTORY
   * Δημιουργεί BoundingBox object με όλες τις computed properties
   * Delegates to the exported standalone function for use by other modules.
   */
  private static createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
    return createBoundingBox(minX, minY, maxX, maxY);
  }
}

/**
 * 🔺 BOUNDING BOX FACTORY — Standalone exported function
 * Χρησιμοποιείται από BoundsCalculator, BoundsOperations, και ViewportBounds.
 */
export function createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

export { BoundsOperations, ViewportBounds } from './bounds-operations';