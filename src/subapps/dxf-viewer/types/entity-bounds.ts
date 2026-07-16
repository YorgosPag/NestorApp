import type { Entity } from './entities';
import type { EntityType } from './base-entity';
import { EMPTY_SPATIAL_BOUNDS } from '../config/geometry-constants';
// ADR-587 Φ9 Slice 2 — canonical per-type bounds SSoT (the marquee/pick resolver, seeded from
// the hit-test `BoundsCalculator`). Twin A (render/culling bounds) DELEGATES to it for every type
// whose culling box equals the pick box; only the culling-SPECIFIC overrides below stay local.
import { resolveEntityBounds } from '../rendering/hitTesting/entity-bounds-ssot';
// ADR-557 — text CULLING uses the generous NOMINAL em box (`textBoxAABB`), a superset of the tight
// VISUAL box the pick resolver returns (`resolveTextBox`). Delegating would pop text at the viewport
// edge + break the 3-site parity contract (`text-bounds-sites-parity.test.ts`).
import { textBoxAABB } from '../bim/text/text-box';
import { projectSceneEntityText } from '../bim/text/project-scene-text';

export type SpatialBounds = { minX: number; minY: number; maxX: number; maxY: number };

type XY = { x: number; y: number };

// XLINE/RAY render as ±NOMINAL world-units for viewport culling — an infinite construction line
// must appear across the viewport. This value is intentionally large; clip-to-viewport (Phase 4.a)
// limits what actually draws. Extents consumers (zoom) get EMPTY instead — see `forExtents`.
const RENDER_NOMINAL_EXTENT = 10000;

/** AABB over an array of points; empty → EMPTY_SPATIAL_BOUNDS. Generic fallback for the few
 *  non-provider types that still carry top-level `vertices` (e.g. leader). */
function aabbOf(points: ReadonlyArray<XY>): SpatialBounds {
  if (points.length === 0) return EMPTY_SPATIAL_BOUNDS;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** XLINE culling box: ±NOMINAL square around the base point (infinite line spans the viewport). */
function xlineRenderBounds(entity: Entity): SpatialBounds {
  const bp = ('basePoint' in entity ? (entity as { basePoint?: XY }).basePoint : undefined);
  if (!bp) return EMPTY_SPATIAL_BOUNDS;
  return {
    minX: bp.x - RENDER_NOMINAL_EXTENT, minY: bp.y - RENDER_NOMINAL_EXTENT,
    maxX: bp.x + RENDER_NOMINAL_EXTENT, maxY: bp.y + RENDER_NOMINAL_EXTENT,
  };
}

/** RAY culling box: from the base point ±NOMINAL along the ray direction (default +X). */
function rayRenderBounds(entity: Entity): SpatialBounds {
  const e = entity as { basePoint?: XY; direction?: XY };
  if (!e.basePoint) return EMPTY_SPATIAL_BOUNDS;
  const tipX = e.basePoint.x + (e.direction?.x ?? 1) * RENDER_NOMINAL_EXTENT;
  const tipY = e.basePoint.y + (e.direction?.y ?? 0) * RENDER_NOMINAL_EXTENT;
  return {
    minX: Math.min(e.basePoint.x, tipX), minY: Math.min(e.basePoint.y, tipY),
    maxX: Math.max(e.basePoint.x, tipX), maxY: Math.max(e.basePoint.y, tipY),
  };
}

/** ELLIPSE culling box: scene shape carries `majorAxis`/`minorAxis`. The pick resolver routes
 *  ellipse through `BoundsCalculator` which reads `radiusX`/`radiusY` (fields the SCENE entity
 *  lacks → NaN), so this stays local; Slice 3 reconciles the resolver's ellipse provider. */
function ellipseRenderBounds(entity: Entity): SpatialBounds {
  const e = entity as { center: XY; majorAxis: number; minorAxis: number };
  const r = Math.max(e.majorAxis, e.minorAxis);
  return { minX: e.center.x - r, minY: e.center.y - r, maxX: e.center.x + r, maxY: e.center.y + r };
}

/** POINT culling box: degenerate box at the position (pick adds ±1 selection padding; culling
 *  doesn't need it). */
function pointRenderBounds(entity: Entity): SpatialBounds {
  const p = (entity as { position: XY }).position;
  return { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
}

const textRenderBounds = (entity: Entity): SpatialBounds => {
  const dxfText = projectSceneEntityText(entity, (entity as { id: string }).id);
  return dxfText ? textBoxAABB(dxfText) : EMPTY_SPATIAL_BOUNDS;
};

/**
 * Culling-specific overrides — the ONLY types whose render/culling bounds intentionally differ
 * from the pick resolver (`resolveEntityBounds`). Mirror of `ENTITY_BOUNDS_PROVIDERS`; any type
 * NOT listed here delegates to the resolver (byte-identical math, or a genuine gain for the types
 * Twin A previously ignored — arc/dimension/angle-measurement + BIM footprint bbox). `forExtents`
 * (zoom-to-fit) drops infinite construction lines so they never affect zoom-extents.
 */
const CULLING_BOUNDS_OVERRIDES: Partial<Record<EntityType, (entity: Entity, forExtents: boolean) => SpatialBounds>> = {
  xline: (entity, forExtents) => (forExtents ? EMPTY_SPATIAL_BOUNDS : xlineRenderBounds(entity)),
  ray: (entity, forExtents) => (forExtents ? EMPTY_SPATIAL_BOUNDS : rayRenderBounds(entity)),
  text: textRenderBounds,
  mtext: textRenderBounds,
  ellipse: ellipseRenderBounds,
  point: pointRenderBounds,
};

function computeBounds(entity: Entity, forExtents: boolean): SpatialBounds {
  const override = CULLING_BOUNDS_OVERRIDES[entity.type as EntityType];
  if (override) return override(entity, forExtents);

  // Canonical per-type bounds SSoT (ADR-587 Φ9). `null` ⇒ no provider (or missing data) ⇒ fall to
  // the generic top-level-vertices box (leader + atypical shapes), else EMPTY (Twin A default).
  const resolved = resolveEntityBounds(entity);
  if (resolved) return resolved;
  if ('vertices' in entity && Array.isArray((entity as { vertices?: unknown }).vertices)) {
    return aabbOf((entity as { vertices: XY[] }).vertices);
  }
  return EMPTY_SPATIAL_BOUNDS;
}

/** For render culling: XLINE/RAY use NOMINAL_EXTENT so they appear across the viewport. */
export const getEntityRenderBounds = (entity: Entity): SpatialBounds =>
  computeBounds(entity, false);

/** For zoom-to-extents: XLINE/RAY return empty bounds — infinite lines must not affect zoom. */
export const getEntityExtentsBounds = (entity: Entity): SpatialBounds =>
  computeBounds(entity, true);

/** @deprecated Use getEntityRenderBounds (rendering) or getEntityExtentsBounds (zoom). */
export const getEntityBounds = getEntityRenderBounds;

/**
 * Union of BIM entity type strings that use pre-computed `geometry.bbox` for
 * spatial bounds. Used for type-narrowing in downstream consumers.
 * Mirror of the `calculateBimEntity2DBounds` supported set.
 */
export type BimEntityWithBounds =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair'
  // ADR-436 — foundation (pad/strip/tie-beam)
  | 'foundation'
  // ADR-406 — MEP fixture
  | 'mep-fixture'
  // ADR-408 Φ3 — electrical panel
  | 'electrical-panel'
  // ADR-410 — furniture
  | 'furniture'
  // ADR-408 Φ8 — MEP segment
  | 'mep-segment'
  // ADR-408 Φ11 — MEP fitting
  | 'mep-fitting'
  // ADR-415 — floorplan symbol
  | 'floorplan-symbol'
  // ADR-408 Φ12 — plumbing manifold
  | 'mep-manifold'
  // ADR-408 Εύρος Β — heating radiator
  | 'mep-radiator'
  // ADR-417 — parametric pitched roof
  | 'roof'
  // ADR-419 — floor finish covering polygon
  | 'floor-finish';
