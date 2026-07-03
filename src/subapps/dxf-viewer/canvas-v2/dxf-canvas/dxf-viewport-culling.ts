/**
 * DXF VIEWPORT CULLING — ADR-040 Phase IX (2026-05-11)
 *
 * Skip entity rendering when the entity's world-space bounding box does not
 * intersect the screen-space viewport. Standard CAD optimization: large DXF
 * scenes (3000+ entities) typically have only ~10-30% of entities visible at
 * any zoom level. Culling reduces the cost of the per-frame render loop
 * proportionally.
 *
 * SSoT: the sole authority for per-entity viewport intersection in the
 * DxfRenderer. Do not re-implement bbox/culling logic elsewhere — extend this
 * module instead.
 *
 * Coordinate convention (matches CoordinateTransforms / renderer):
 *   screen.x = world.x * transform.scale + transform.offsetX
 *   screen.y = world.y * transform.scale + transform.offsetY
 * → world bounds for a screen viewport [0..w, 0..h]:
 *   world.x ∈ [(0 - offsetX)/scale, (w - offsetX)/scale]
 *   world.y ∈ [(0 - offsetY)/scale, (h - offsetY)/scale]
 */

import type { DxfEntityUnion } from './dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
// ADR-557 Φ-attachment — attachment-aware text-box SSoT (same box the grips + hover
// frame use), so culling / picking match exactly what the renderer draws.
import { textBoxAABB } from '../../bim/text/text-box';
// ADR-362 / ADR-040 Phase IX — dimension world-space AABB via the hit-geometry SSoT (same
// geometry the picking path uses), so a dim in a geo-referenced DXF is culled by its REAL
// bounds instead of the ±1e6 full-plane fallback (the "dims invisible but glow on hover" bug).
import { getDimensionWorldBounds } from '../../systems/dimensions/dimension-cull-bounds';

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Padding (in screen pixels) added to viewport bounds to avoid edge artefacts
 *  (e.g. line caps, text glyph overflow, arc anti-aliasing). */
const CULL_PADDING_PX = 32;

/** Full-plane conservative bbox — used for entity types with no computable AABB. */
const FULL_PLANE_BBOX: BBox = { minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 };

/**
 * ADR-363 / ADR-040 Phase IX — world-space footprint AABB for BIM direct-entities.
 *
 * Every BIM entity (wall / column / beam / foundation / slab / roof / opening / …) spreads
 * `geometry.bbox` (world-space plan AABB) at the top level of its `DxfEntityUnion` variant
 * (HitTestingService §1B contract). Use it for culling so a member drawn in a **geo-referenced
 * DXF** (coordinates ~1e7, e.g. EGSA87/UTM) is NOT dropped by the conservative `FULL_PLANE_BBOX`
 * fallback — the exact bug that made committed walls invisible in the 2D base render while they
 * stayed visible in 3D and on hover (both bypass viewport culling). Bbox-less types (dimension,
 * ray, xline) fall back to the full-plane box.
 */
function geometryBBoxOrFullPlane(entity: DxfEntityUnion): BBox {
  const bb = (entity as { geometry?: { bbox?: { min: { x: number; y: number }; max: { x: number; y: number } } } }).geometry?.bbox;
  if (bb) return { minX: bb.min.x, minY: bb.min.y, maxX: bb.max.x, maxY: bb.max.y };
  return FULL_PLANE_BBOX;
}

/**
 * Compute axis-aligned world-space bbox for a DXF entity. Cheap O(1) per
 * primitive except polylines, which are O(vertices).
 */
export function getEntityBBox(entity: DxfEntityUnion): BBox {
  switch (entity.type) {
    case 'line': {
      return {
        minX: Math.min(entity.start.x, entity.end.x),
        minY: Math.min(entity.start.y, entity.end.y),
        maxX: Math.max(entity.start.x, entity.end.x),
        maxY: Math.max(entity.start.y, entity.end.y),
      };
    }
    case 'circle': {
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius,
      };
    }
    case 'arc': {
      // Conservative: use the full enclosing circle bbox. A tighter bbox would
      // require trigonometric extrema per quadrant — not worth the CPU for culling.
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius,
      };
    }
    case 'polyline': {
      const vs = entity.vertices;
      if (vs.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let minX = vs[0].x, minY = vs[0].y, maxX = vs[0].x, maxY = vs[0].y;
      for (let i = 1; i < vs.length; i++) {
        const v = vs[i];
        if (v.x < minX) minX = v.x; else if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y; else if (v.y > maxY) maxY = v.y;
      }
      return { minX, minY, maxX, maxY };
    }
    case 'text': {
      // ADR-557 Φ-attachment — AABB of the attachment-aware text box SSoT (honours
      // textStyle align/baseline + rotation + widthFactor), the SAME box the grips,
      // hover frame and 3D mesh use → culling / picking match the drawn glyphs.
      return textBoxAABB(entity);
    }
    case 'angle-measurement': {
      const xs = [entity.vertex.x, entity.point1.x, entity.point2.x];
      const ys = [entity.vertex.y, entity.point1.y, entity.point2.y];
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
    case 'dimension': {
      // ADR-362 / ADR-040 Phase IX — real world-space AABB from the dimension's RENDERED
      // geometry (hit-geometry SSoT: dim line / arc / leader / extension lines / text anchor),
      // so a dim in a geo-referenced DXF (coords ~1.7e7) is culled by its true bounds — NOT the
      // ±1e6 full-plane fallback. Without this EVERY dimension was dropped from the 2D base pass
      // while hover (bypasses culling) still lit it: the "dims invisible but glow on hover" bug
      // (2026-07-03). Direct sibling of the wall/column/foundation geometry.bbox fix above.
      // Degenerate dims (no usable points) keep the conservative full-plane fallback.
      return getDimensionWorldBounds(entity.dimensionEntity) ?? FULL_PLANE_BBOX;
    }
    case 'stair': {
      // ADR-358 Phase 5b — project the StairGeometry 3D bbox to 2D plan bounds.
      const bb = entity.stairEntity.geometry.bbox;
      return {
        minX: bb.min.x,
        minY: bb.min.y,
        maxX: bb.max.x,
        maxY: bb.max.y,
      };
    }
    // ADR-568 / ADR-040 Phase IX — the OPENING variant carries its world-space AABB NESTED under
    // `openingEntity.geometry.bbox` (wrapper variant, like `stair` above), NOT at the top level
    // like the direct entities (wall / beam / column, which spread `geometry` in the converter).
    // Without this case it fell to the ±1e6 `FULL_PLANE_BBOX` fallback → every opening in a
    // geo-referenced DXF (coords ~1.7e7) was culled from the 2D base pass. That produced the
    // "wall cutout (hole) shows — but the BIM door κούφωμα is invisible" bug (2026-07-03): the
    // hole is punched by the per-frame `openingsByWall` map (bypasses culling), while the
    // OpeningRenderer entity goes through `isEntityInViewport` and was dropped. Sibling of the
    // wall/dimension geo-referenced culling fixes. (slab / slab-opening share the same nesting —
    // flagged for a follow-up; a pre-existing test asserts the top-level shape for slab.)
    case 'opening': {
      const bb = entity.openingEntity.geometry?.bbox;
      return bb ? { minX: bb.min.x, minY: bb.min.y, maxX: bb.max.x, maxY: bb.max.y } : FULL_PLANE_BBOX;
    }
    // ADR-363 / ADR-436 / ADR-040 Phase IX — BIM direct-entities (wall/column/beam/foundation/
    // slab/roof/opening/…) all carry a world-space `geometry.bbox`. Route them through ONE SSoT
    // extractor so a member in a geo-referenced DXF (coords ~1e7) is culled by its REAL bounds,
    // not the ±1e6 full-plane fallback (the "committed wall invisible in 2D" bug, 2026-07-03).
    case 'column':
    case 'foundation':
    case 'wall':
      return geometryBBoxOrFullPlane(entity);
    default: {
      // Prefer the entity's own world-space AABB when present (all other BIM direct-entities:
      // beam / slab / roof / opening / floor-finish / mep-* / …); bbox-less types (dimension,
      // ray, xline) keep the conservative full-plane fallback.
      return geometryBBoxOrFullPlane(entity);
    }
  }
}

/**
 * Convert a screen-space viewport to a world-space bbox using the inverse of
 * the current ViewTransform. Padded by CULL_PADDING_PX (screen pixels) so
 * partially-visible entities are kept.
 */
export function viewportToWorldBBox(
  transform: ViewTransform,
  viewport: Viewport,
): BBox {
  const s = transform.scale;
  if (s === 0) {
    // Degenerate transform — disable culling by returning an infinite bbox.
    return { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
  }
  const padScreen = CULL_PADDING_PX;
  const minScreenX = -padScreen;
  const minScreenY = -padScreen;
  const maxScreenX = viewport.width + padScreen;
  const maxScreenY = viewport.height + padScreen;
  // Inverse: world = (screen - offset) / scale. Min/max may flip on negative scale.
  const wxA = (minScreenX - transform.offsetX) / s;
  const wxB = (maxScreenX - transform.offsetX) / s;
  const wyA = (minScreenY - transform.offsetY) / s;
  const wyB = (maxScreenY - transform.offsetY) / s;
  return {
    minX: Math.min(wxA, wxB),
    minY: Math.min(wyA, wyB),
    maxX: Math.max(wxA, wxB),
    maxY: Math.max(wyA, wyB),
  };
}

/** Standard AABB overlap test. */
export function bboxIntersects(a: BBox, b: BBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * High-level cull predicate used by DxfRenderer.render().
 *
 * Returns true when the entity must be rendered. The caller is responsible
 * for computing `worldViewport` once per frame (not per entity).
 */
export function isEntityInViewport(
  entity: DxfEntityUnion,
  worldViewport: BBox,
): boolean {
  const eb = getEntityBBox(entity);
  return bboxIntersects(eb, worldViewport);
}
