/**
 * Canonical per-type 2D bounds SSoT (ADR-587 Φ9 Slice 1).
 *
 * ONE polymorphic bounds resolver for every renderable entity — the big-player
 * idiom (Revit `get_BoundingBox` / AutoCAD `getGeomExtents` / C4D `GetRad` /
 * Figma node bbox): a single definition/type, dispatched per-type. Backs the
 * marquee's bounds twin (Twin B `calculateEntityBounds`, `selection-duplicate-
 * utils.ts`), which is now a thin `{min,max}` shape-adapter over `resolveEntityBounds`.
 *
 * Shape = `BoundingBox2D {minX,minY,maxX,maxY}` (donor = the fuller hit-test
 * `BoundsCalculator`, C). Lives in the bounds/hit-test layer (NOT a field on the
 * `EntityTypeDescriptor` — §5.4 layering: the per-type math drags BoundsCalculator/
 * text-box/BIM projections, so a descriptor field would invert dependencies +
 * create cycles). Completeness bound to `RENDERABLE_ENTITY_TYPES` via coverage.
 *
 * The per-type math is BYTE-IDENTICAL to what Twin B used before this slice — the
 * SAME helper calls (`calculateVerticesBounds`, `calculateBimEntity2DBounds`,
 * `projectSceneTextToDxf`+`resolveTextBox`+corners, `getDimensionWorldBounds`,
 * `BoundsCalculator` for ellipse/spline/point/xline/ray), reshaped from `{min,max}`
 * to `{minX,minY,maxX,maxY}`. It ADDS providers for the 6 types Twin B returned
 * `null` for (silently NOT marquee-selectable though rendered + click-selectable):
 * `annotation-symbol` (→ C), `railing`/`thermal-space`/`space-separator`/
 * `wall-covering` (→ `calculateBimEntity2DBounds`, its gaps fixed in `bim-bounds.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md §5.4
 */

import type { Entity } from '../../types/entities';
import type { EntityType } from '../../types/base-entity';
import type { EntityModel, Point2D } from '../types/Types';
import type { DimensionEntity } from '../../types/dimension';
// SAME helpers Twin B used — reuse, never re-implement (SSoT / N.18).
import { calculateVerticesBounds } from '../../utils/geometry/GeometryUtils';
import { createRectangleVertices } from '../entities/shared/geometry-utils';
import { calculateBimEntity2DBounds } from '../../bim/utils/bim-bounds';
import { BoundsCalculator } from './Bounds';
import { getDimensionWorldBounds } from '../../systems/dimensions/dimension-cull-bounds';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
import { resolveTextBox } from '../../bim/text/text-box';
import { computeScaleBarGeometry } from '../../bim/geometry/scale-bar-geometry';
import type { ScaleBarEntity } from '../../types/scale-bar';
// ADR-612 — opening info tag broad-phase bbox SSoT (sibling of scale-bar).
import { calculateOpeningInfoTagBounds } from '../../bim/opening-info-tag/opening-info-tag-hit';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
import { RECT_CORNERS, rectCornerWorld } from '../../bim/grips/rect-frame';

/** Axis-aligned 2D bounding box (the canonical hit-test/bounds shape). */
export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type MinMax = { min: Point2D; max: Point2D };

/** `{min,max}` (GeometryUtils / BIM) → `BoundingBox2D`, null-preserving. */
function box2D(b: MinMax | null): BoundingBox2D | null {
  return b ? { minX: b.min.x, minY: b.min.y, maxX: b.max.x, maxY: b.max.y } : null;
}

function lineBounds(entity: Entity): BoundingBox2D | null {
  const e = entity as unknown as { start: Point2D; end: Point2D };
  return {
    minX: Math.min(e.start.x, e.end.x),
    minY: Math.min(e.start.y, e.end.y),
    maxX: Math.max(e.start.x, e.end.x),
    maxY: Math.max(e.start.y, e.end.y),
  };
}

function circleBounds(entity: Entity): BoundingBox2D | null {
  const e = entity as unknown as { center: Point2D; radius: number };
  return {
    minX: e.center.x - e.radius,
    minY: e.center.y - e.radius,
    maxX: e.center.x + e.radius,
    maxY: e.center.y + e.radius,
  };
}

function verticesBounds(entity: Entity): BoundingBox2D | null {
  const e = entity as unknown as { vertices: Point2D[] };
  return box2D(calculateVerticesBounds(e.vertices));
}

function arcBounds(entity: Entity): BoundingBox2D | null {
  const center = ('center' in entity ? (entity as { center?: Point2D }).center : undefined);
  const radius = ('radius' in entity ? (entity as { radius?: number }).radius : undefined);
  if (!center || radius === undefined) return null;
  return {
    minX: center.x - radius,
    minY: center.y - radius,
    maxX: center.x + radius,
    maxY: center.y + radius,
  };
}

function rectBounds(entity: Entity): BoundingBox2D | null {
  let vertices: Point2D[] | undefined = ('vertices' in entity ? (entity as { vertices?: Point2D[] }).vertices : undefined);
  if (!vertices || vertices.length === 0) {
    const corner1 = ('corner1' in entity ? (entity as { corner1?: Point2D }).corner1 : 'start' in entity ? (entity as { start?: Point2D }).start : undefined);
    const corner2 = ('corner2' in entity ? (entity as { corner2?: Point2D }).corner2 : 'end' in entity ? (entity as { end?: Point2D }).end : undefined);
    // rotated-rectangle: τα bounds πρέπει να καλύπτουν τις ΠΕΡΙΣΤΡΑΜΜΕΝΕΣ κορυφές (viewport cull + marquee).
    const rotation = ('rotation' in entity ? (entity as { rotation?: number }).rotation : undefined);
    if (corner1 && corner2) vertices = createRectangleVertices(corner1, corner2, rotation);
  }
  return vertices ? box2D(calculateVerticesBounds(vertices)) : null;
}

function angleMeasurementBounds(entity: Entity): BoundingBox2D | null {
  const vertex = ('vertex' in entity ? (entity as { vertex?: Point2D }).vertex : undefined);
  const point1 = ('point1' in entity ? (entity as { point1?: Point2D }).point1 : undefined);
  const point2 = ('point2' in entity ? (entity as { point2?: Point2D }).point2 : undefined);
  if (!vertex || !point1 || !point2) return null;
  return {
    minX: Math.min(vertex.x, point1.x, point2.x),
    minY: Math.min(vertex.y, point1.y, point2.y),
    maxX: Math.max(vertex.x, point1.x, point2.x),
    maxY: Math.max(vertex.y, point1.y, point2.y),
  };
}

function hatchBounds(entity: Entity): BoundingBox2D | null {
  const paths = ('boundaryPaths' in entity ? (entity as { boundaryPaths?: Point2D[][] }).boundaryPaths : undefined);
  const pts = paths?.flat() ?? [];
  return pts.length > 0 ? box2D(calculateVerticesBounds(pts)) : null;
}

/**
 * text/mtext — project the raw scene entity (content/height/style may live only
 * in `textNode`, ADR-344) to a flat DxfText, then take the SAME attachment-aware
 * VISUAL box the 2D grips/hover/hit-test use (`resolveTextBox`). The rotated
 * RectFrame → AABB via its four world corners.
 */
function textBounds(entity: Entity): BoundingBox2D | null {
  const shape = entity as unknown as TextSceneShape;
  if (!shape.position) return null;
  const dxfText = projectSceneTextToDxf(shape, (entity as { id?: string }).id ?? '');
  if (!dxfText.text) return null;
  const frame = resolveTextBox(dxfText);
  const corners = RECT_CORNERS.map(corner => rectCornerWorld(frame, corner));
  return box2D(calculateVerticesBounds(corners));
}

/**
 * dimension — the marquee receives the WRAPPED DxfDimension (fields nested under
 * `dimensionEntity`); unwrap, then reuse the dimension-bounds SSoT (the same
 * accurate bbox viewport culling uses). Handles wrapped and already-flat forms.
 */
function dimensionBounds(entity: Entity): BoundingBox2D | null {
  const dimEntity =
    (entity as { dimensionEntity?: DimensionEntity }).dimensionEntity
    ?? (entity as unknown as DimensionEntity);
  const b = dimEntity?.defPoints ? getDimensionWorldBounds(dimEntity) : null;
  return b ? { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY } : null;
}

/**
 * ellipse/spline/point/xline/ray + annotation-symbol — delegate to the full
 * hit-test `BoundsCalculator` (C), the same SSoT the click hit-test uses. No new
 * bounds math (ADR-394 for the DXF five; ADR-583 for annotation-symbol).
 */
function viaBoundsCalculator(entity: Entity): BoundingBox2D | null {
  const bb = BoundsCalculator.calculateEntityBounds(entity as unknown as EntityModel, 0);
  return bb ? { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY } : null;
}

/** BIM parametric entities — project pre-computed `geometry.bbox` to XY plan view. */
function bimBounds(entity: Entity): BoundingBox2D | null {
  return box2D(calculateBimEntity2DBounds(entity));
}

/**
 * ADR-583 Φ2.4 — graphic scale-bar: the DERIVED length-extent bbox from
 * `computeScaleBarGeometry` (canonical-mm; span is scale-invariant, hence `(1,'mm')`).
 * Makes the bar window/crossing-marquee selectable (mirror `annotation-symbol`).
 */
function scaleBarBounds(entity: Entity): BoundingBox2D | null {
  const { bbox } = computeScaleBarGeometry(entity as unknown as ScaleBarEntity, 1, 'mm');
  return { minX: bbox.minX, minY: bbox.minY, maxX: bbox.maxX, maxY: bbox.maxY };
}

/**
 * ADR-612 — opening info tag: the rotation-aware world-mm box AABB
 * (`computeOpeningInfoTagGeometry`, sibling of `scaleBarBounds`). Makes the
 * tag window/crossing-marquee selectable.
 */
function openingInfoTagBounds(entity: Entity): BoundingBox2D | null {
  const bbox = calculateOpeningInfoTagBounds(entity as unknown as OpeningInfoTagEntity);
  return { minX: bbox.minX, minY: bbox.minY, maxX: bbox.maxX, maxY: bbox.maxY };
}

/**
 * Per-type bounds provider registry — ONE canonical dispatch table for the whole
 * bounds/hit-test layer. Keyed by `EntityType`; a missing key ⇒ genuinely
 * unbounded (resolver returns `null`, no console noise).
 */
export const ENTITY_BOUNDS_PROVIDERS: Partial<Record<EntityType, (entity: Entity) => BoundingBox2D | null>> = {
  // ── DXF primitives (byte-identical to Twin B) ──
  line: lineBounds,
  circle: circleBounds,
  polyline: verticesBounds,
  lwpolyline: verticesBounds,
  arc: arcBounds,
  rect: rectBounds,
  rectangle: rectBounds,
  'angle-measurement': angleMeasurementBounds,
  hatch: hatchBounds,
  text: textBounds,
  mtext: textBounds,
  dimension: dimensionBounds,
  ellipse: viaBoundsCalculator,
  spline: viaBoundsCalculator,
  point: viaBoundsCalculator,
  xline: viaBoundsCalculator,
  ray: viaBoundsCalculator,
  // ── Φ9 Slice 1 gap fix: annotation-symbol was null in Twin B (C handles it) ──
  'annotation-symbol': viaBoundsCalculator,
  // ── ADR-583 Φ2.4 — graphic scale-bar: derived length-extent bbox (marquee-selectable) ──
  'scale-bar': scaleBarBounds,
  // ── ADR-612 — opening info tag: rotation-aware world-mm box AABB (marquee-selectable) ──
  'opening-info-tag': openingInfoTagBounds,
  // ── ADR-651 Φάση Ε / ADR-654 — standalone raster image: rotation-aware rectangle bbox.
  // Delegates to `BoundsCalculator` (C, `case 'image'` → `calculateImageBounds`) ώστε
  // marquee ΚΑΙ hover/click να διαβάζουν ΤΗΝ ΙΔΙΑ συνάρτηση — ήταν δύο ξεχωριστές
  // υλοποιήσεις και η μία (C) απλά έλειπε, γι' αυτό το marquee δούλευε και το hover όχι.
  image: viaBoundsCalculator,
  // ── BIM parametric (via calculateBimEntity2DBounds) ──
  wall: bimBounds,
  opening: bimBounds,
  slab: bimBounds,
  'slab-opening': bimBounds,
  column: bimBounds,
  beam: bimBounds,
  foundation: bimBounds,
  stair: bimBounds,
  roof: bimBounds,
  'floor-finish': bimBounds,
  furniture: bimBounds,
  'mep-fixture': bimBounds,
  'electrical-panel': bimBounds,
  'mep-manifold': bimBounds,
  'mep-radiator': bimBounds,
  'mep-boiler': bimBounds,
  'mep-water-heater': bimBounds,
  'mep-segment': bimBounds,
  'mep-fitting': bimBounds,
  'mep-underfloor': bimBounds,
  // `wall-covering` was ROUTED in Twin B but the delegate lacked a case → null;
  // the `bim-bounds.ts` gap is fixed this slice, so it now yields real bounds.
  'wall-covering': bimBounds,
  // floorplan-symbol: routed by Twin B (delegate supports it); not in
  // RENDERABLE_ENTITY_TYPES (rendered via entity-model path — ADR-583/Φ2b
  // surfaced asymmetry). Kept for byte-identical parity with Twin B.
  'floorplan-symbol': bimBounds,
  // ── Φ9 Slice 1 gap fix: railing/thermal-space/space-separator now routed ──
  railing: bimBounds,
  'thermal-space': bimBounds,
  'space-separator': bimBounds,
};

/** Every entity type with a bounds provider (mirror of the registry keys). */
export const ENTITY_BOUNDS_SUPPORTED_TYPES: readonly EntityType[] =
  Object.keys(ENTITY_BOUNDS_PROVIDERS) as EntityType[];

/**
 * Canonical per-type 2D bounds resolver — `BoundingBox2D | null`. `null` ⇒ no
 * provider for this type (genuinely unbounded), matching Twin B's old `default`.
 */
export function resolveEntityBounds(entity: Entity): BoundingBox2D | null {
  const provider = ENTITY_BOUNDS_PROVIDERS[entity.type as EntityType];
  return provider ? provider(entity) : null;
}
