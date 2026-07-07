/**
 * Selection duplicate patterns utilities
 * Consolidates the most common duplicate patterns in selection system
 */

import type { Entity, LineEntity, CircleEntity, RectangleEntity } from '../../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isLineEntity, isCircleEntity, isRectangleEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { AnySceneEntity } from '../../../types/scene';
import { calculateVerticesBounds } from '../../../utils/geometry/GeometryUtils';
// 🏢 ADR-089: Centralized Point-In-Bounds
import { SpatialUtils } from '../../../core/spatial/SpatialUtils';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
// 🏢 ADR-034: Centralized Empty Spatial Bounds
import { createInfinityBounds, EMPTY_SPATIAL_BOUNDS } from '../../../config/geometry-constants';
// ADR-363 Phase 7A — BIM marquee bounds (SSoT delegation).
import { calculateBimEntity2DBounds } from '../../../bim/utils/bim-bounds';
// ADR-394 — full per-type DXF bounds SSoT (the same calculator the spatial-index
// hit-test uses). Delegated from the `default` branch so Z fit-to-selection and
// window/crossing marquee cover every DXF type that can be click-selected
// (ellipse/spline/point/dimension/xline/ray), not just the enumerated primitives.
import { BoundsCalculator } from '../../../rendering/hitTesting/Bounds';
import type { EntityModel } from '../../../rendering/types/Types';
// ADR-362 / ADR-040 — dimension world-bounds SSoT (same accurate bbox the viewport culling
// uses). The marquee is fed the WRAPPED DxfDimension (fields nested under `dimensionEntity`),
// so it must unwrap before reading defPoints — else window/crossing silently skips dimensions.
import { getDimensionWorldBounds } from '../../dimensions/dimension-cull-bounds';
import type { DimensionEntity } from '../../../types/dimension';
// ADR-557 / ADR-394 — text/mtext bounds via the SAME visual-box SSoT the 2D grips, hover
// and hit-test use (`resolveTextBox`), fed by the shared scene→DxfText projection
// (`projectSceneTextToDxf` — resolves content/height/style from `textNode`, ADR-344). This
// makes Z fit-to-selection + marquee frame EXACTLY the drawn glyphs: in-app text stores its
// content only in `textNode` (raw flat `text` was undefined → null bounds → Z did nothing),
// and a char-count heuristic never matched the real proportional-font box → "fit" undershot.
import { projectSceneTextToDxf, type TextSceneShape } from '../../../bim/text/project-scene-text';
import { resolveTextBox } from '../../../bim/text/text-box';
import { RECT_CORNERS, rectCornerWorld } from '../../../bim/grips/rect-frame';

/**
 * Calculate bounding box for entities
 * ✅ ENTERPRISE FIX: Uses proper Entity type with type narrowing for type safety
 */
export function calculateBoundingBox(entities: Entity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (entities.length === 0) {
    // 🏢 ADR-034: Centralized Empty Spatial Bounds
    return EMPTY_SPATIAL_BOUNDS;
  }

  // 🏢 ADR-158: Centralized Infinity Bounds Initialization
  const bounds = createInfinityBounds();

  entities.forEach(entity => {
    // Extract bounds from different entity types using type narrowing
    // 🏢 ADR-102: Use centralized type guards
    if (isLineEntity(entity)) {
      const lineEntity = entity as LineEntity;
      const { start, end } = lineEntity;
      if (start && end) {
        bounds.minX = Math.min(bounds.minX, start.x, end.x);
        bounds.minY = Math.min(bounds.minY, start.y, end.y);
        bounds.maxX = Math.max(bounds.maxX, start.x, end.x);
        bounds.maxY = Math.max(bounds.maxY, start.y, end.y);
      }
    } else if (isCircleEntity(entity)) {
      const circleEntity = entity as CircleEntity;
      const { center, radius } = circleEntity;
      if (center && radius !== undefined) {
        bounds.minX = Math.min(bounds.minX, center.x - radius);
        bounds.minY = Math.min(bounds.minY, center.y - radius);
        bounds.maxX = Math.max(bounds.maxX, center.x + radius);
        bounds.maxY = Math.max(bounds.maxY, center.y + radius);
      }
    } else if (isRectangleEntity(entity)) {
      const rectEntity = entity as RectangleEntity;
      const { x, y, width, height } = rectEntity;
      if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x + width);
        bounds.maxY = Math.max(bounds.maxY, y + height);
      }
    }
  });

  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY
  };
}

/**
 * Check if point is inside bounding rectangle
 * 🏢 ADR-089: Wrapper για SpatialUtils.pointInBounds() - Single Source of Truth
 * @deprecated Prefer using SpatialUtils.pointInBounds() directly for new code
 */
export function isPointInBounds(
  point: Point2D,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return SpatialUtils.pointInBounds(point, bounds);
}

/**
 * Filter entities by visibility and layer status
 * ✅ ENTERPRISE FIX: Uses proper Entity type for type safety
 */
export function filterVisibleEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => {
    // Check if entity itself is visible
    if (entity.visible === false) return false;

    // Additional layer checks can be added here
    return true;
  });
}

/**
 * Standard entity selection validation pattern
 * ✅ ENTERPRISE FIX: Uses proper Entity type for type safety
 */
export function isEntitySelectable(
  entity: Entity,
  selectionCriteria?: {
    types?: string[];
    excludeIds?: string[];
    visibleOnly?: boolean;
  }
): boolean {
  const criteria = selectionCriteria || {};
  
  // Check type filter
  if (criteria.types && !criteria.types.includes(entity.type)) {
    return false;
  }
  
  // Check exclusion list
  if (criteria.excludeIds && criteria.excludeIds.includes(entity.id)) {
    return false;
  }
  
  // Check visibility
  if (criteria.visibleOnly !== false && entity.visible === false) {
    return false;
  }
  
  return true;
}

// 🗑️ REMOVED: calculateVerticesBounds method - now using centralized version from GeometryUtils
// Import: import { calculateVerticesBounds } from '../../../utils/geometry/GeometryUtils';

/**
 * Create rectangle vertices from corners - eliminates duplicate logic
 */
export function createRectangleVertices(corner1: Point2D, corner2: Point2D): Point2D[] {
  return [
    corner1,
    { x: corner2.x, y: corner1.y },
    corner2,
    { x: corner1.x, y: corner2.y }
  ];
}

/**
 * Unified entity bounds calculation - eliminates duplicate bounds logic
 */
export function calculateEntityBounds(entity: AnySceneEntity): { min: Point2D, max: Point2D } | null {
  switch(entity.type) {
    case 'line':
      return {
        min: { x: Math.min(entity.start.x, entity.end.x), y: Math.min(entity.start.y, entity.end.y) },
        max: { x: Math.max(entity.start.x, entity.end.x), y: Math.max(entity.start.y, entity.end.y) }
      };
    case 'circle':
      return {
        min: { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
        max: { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
      };
    case 'polyline':
      return calculateVerticesBounds(entity.vertices);
    case 'lwpolyline':
      // 🏢 ENTERPRISE (2026-02-13): LWPolyline fallthrough to polyline — same vertex-based bounds
      return calculateVerticesBounds((entity as unknown as { vertices: Point2D[] }).vertices);
    case 'arc': {
      // 🏢 ENTERPRISE (2026-02-13): Arc bounds — use center ± radius (bounding circle)
      const arcCenter = ('center' in entity ? entity.center : undefined) as Point2D | undefined;
      const arcRadius = ('radius' in entity ? entity.radius : undefined) as number | undefined;
      if (!arcCenter || arcRadius === undefined) return null;
      return {
        min: { x: arcCenter.x - arcRadius, y: arcCenter.y - arcRadius },
        max: { x: arcCenter.x + arcRadius, y: arcCenter.y + arcRadius }
      };
    }
    case 'rect':
    case 'rectangle': {
      // Handle both corner-based and vertex-based rectangles
      let vertices: Point2D[] | undefined = ('vertices' in entity ? entity.vertices as Point2D[] : undefined);
      if (!vertices || vertices.length === 0) {
        const corner1 = ('corner1' in entity ? entity.corner1 : 'start' in entity ? entity.start : undefined) as Point2D | undefined;
        const corner2 = ('corner2' in entity ? entity.corner2 : 'end' in entity ? entity.end : undefined) as Point2D | undefined;
        if (corner1 && corner2) {
          vertices = createRectangleVertices(corner1, corner2);
        }
      }
      return vertices ? calculateVerticesBounds(vertices) : null;
    }
    case 'angle-measurement': {
      const vertex = ('vertex' in entity ? entity.vertex : undefined) as Point2D | undefined;
      const point1 = ('point1' in entity ? entity.point1 : undefined) as Point2D | undefined;
      const point2 = ('point2' in entity ? entity.point2 : undefined) as Point2D | undefined;
      
      if (!vertex || !point1 || !point2) return null;
      
      const minX = Math.min(vertex.x, point1.x, point2.x);
      const minY = Math.min(vertex.y, point1.y, point2.y);
      const maxX = Math.max(vertex.x, point1.x, point2.x);
      const maxY = Math.max(vertex.y, point1.y, point2.y);
      
      return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
    }
    // ADR-507 — HATCH geometry = its boundary paths (outer ring + islands). Without this
    // case the switch fell to `default → null`, so the window/crossing marquee SILENTLY
    // excluded every hatch → a hatch could never be added to a selection, and thus never
    // GROUPED together with its boundary lines (Giorgio 2026-07-07: «ΔΕΝ ομαδοποιείται η
    // γραμμοσκίαση με τις γραμμές — αντιλαμβάνεται μόνον τις γραμμές»). Mirror of the AABB
    // in `types/entity-bounds.ts` (case 'hatch') + `Bounds.ts` broad-phase.
    case 'hatch': {
      const paths = ('boundaryPaths' in entity ? entity.boundaryPaths : undefined) as Point2D[][] | undefined;
      const pts = paths?.flat() ?? [];
      return pts.length > 0 ? calculateVerticesBounds(pts) : null;
    }
    // ADR-363 Phase 7A — BIM parametric entities project pre-computed
    // `geometry.bbox` (BoundingBox3D) onto the XY plan view. Without these
    // cases the switch fell through to `default → null` and marquee selection
    // silently excluded every wall/opening/slab/column/beam/stair.
    // ADR-406 / ADR-408 Φ3 — mep-fixture + electrical-panel are point-based BIM
    // entities; `calculateBimEntity2DBounds` already handles them, but they were
    // missing from this switch so window/crossing marquee silently skipped them.
    case 'wall':
    case 'opening':
    case 'slab':
    case 'slab-opening':
    case 'column':
    case 'beam':
    case 'stair':
    case 'mep-fixture':
    case 'electrical-panel':
    case 'mep-segment':
    case 'mep-fitting':  // ADR-408 Φ11 — auto pipe fitting, marquee select
    case 'furniture':   // ADR-410 — point/mesh-based BIM furniture, marquee select
    case 'floorplan-symbol': // ADR-415 — pure-vector 2D floorplan symbol, marquee select
    case 'mep-manifold':   // ADR-408 Φ12 — plumbing manifold point-based BIM, marquee select
    case 'mep-radiator':   // ADR-408 Εύρος Β — heating radiator point-based BIM, marquee select
    case 'mep-boiler':    // ADR-408 Εύρος Β #2 — heating boiler point-based BIM, marquee select
    case 'mep-water-heater': // ADR-408 DHW — domestic hot water heater point-based BIM, marquee select
    case 'mep-underfloor': // ADR-408 Εύρος Β #3 — underfloor heating area-based BIM, marquee select
    case 'floor-finish':  // ADR-419 — floor-finish polygon covering, marquee select
    case 'wall-covering': // ADR-511 — wall-covering face strip (cached bbox), marquee select
    case 'roof':          // ADR-417 — parametric pitched roof, marquee select
    case 'foundation':    // ADR-436 — foundation (pad/strip/tie-beam), marquee select
      return calculateBimEntity2DBounds(entity as unknown as Entity);
    case 'text':
    case 'mtext': {
      // Project the raw scene entity (content/height/style may live only in `textNode`,
      // ADR-344) to a flat DxfText, then take the SAME attachment-aware VISUAL box the 2D
      // grips/hover/hit-test use — so the fit box coincides with the drawn glyphs (metrics-
      // accurate width, cap-height extent, rotation about the insertion point). The rotated
      // RectFrame → AABB via its four world corners.
      const shape = entity as unknown as TextSceneShape;
      if (!shape.position) return null;
      const dxfText = projectSceneTextToDxf(shape, (entity as { id?: string }).id ?? '');
      if (!dxfText.text) return null;
      const frame = resolveTextBox(dxfText);
      const corners = RECT_CORNERS.map(corner => rectCornerWorld(frame, corner));
      return calculateVerticesBounds(corners);
    }
    case 'dimension': {
      // ADR-362 / ADR-040 — the marquee receives the WRAPPED DxfDimension (all fields nested
      // under `dimensionEntity`), but the flat bounds calculators read a top-level `defPoints`
      // → it was `undefined` → null bounds → window/crossing NEVER selected a dimension. Unwrap
      // and reuse the dimension-bounds SSoT (the same accurate bbox the viewport culling uses),
      // so the marquee box matches what is drawn. Handles both wrapped and already-flat forms.
      const dimEntity =
        (entity as { dimensionEntity?: DimensionEntity }).dimensionEntity
        ?? (entity as unknown as DimensionEntity);
      const b = dimEntity?.defPoints ? getDimensionWorldBounds(dimEntity) : null;
      return b ? { min: { x: b.minX, y: b.minY }, max: { x: b.maxX, y: b.maxY } } : null;
    }
    // ADR-394 — DXF types that are click-selectable (hit-test SSoT covers them) but
    // were missing here, so Z fit-to-selection + window/crossing marquee skipped them.
    // Delegate to the full hit-test `BoundsCalculator` (no new bounds math). Listed
    // explicitly (not a catch-all default) so genuinely unsupported types stay silent
    // instead of triggering BoundsCalculator's "Unknown entity type" console warning.
    case 'ellipse':
    case 'spline':
    case 'point':
    case 'xline':
    case 'ray': {
      const bb = BoundsCalculator.calculateEntityBounds(entity as unknown as EntityModel, 0);
      return bb ? { min: { x: bb.minX, y: bb.minY }, max: { x: bb.maxX, y: bb.maxY } } : null;
    }
    default:
      return null;
  }
}

/**
 * ADR-394 — Combined AABB for a list of mixed entities (DXF + BIM).
 *
 * Merges each entity's bounds via `calculateEntityBounds` (the SSoT that already
 * covers wall/column/slab/beam/stair/opening). Entities that yield no bounds are
 * skipped. Returns null when none produce bounds (e.g. empty selection).
 */
export function calculateCombinedEntityBounds(
  entities: AnySceneEntity[],
): { min: Point2D, max: Point2D } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  for (const entity of entities) {
    const b = calculateEntityBounds(entity);
    if (!b) continue;
    found = true;
    if (b.min.x < minX) minX = b.min.x;
    if (b.min.y < minY) minY = b.min.y;
    if (b.max.x > maxX) maxX = b.max.x;
    if (b.max.y > maxY) maxY = b.max.y;
  }
  return found ? { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } : null;
}