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

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Padding (in screen pixels) added to viewport bounds to avoid edge artefacts
 *  (e.g. line caps, text glyph overflow, arc anti-aliasing). */
const CULL_PADDING_PX = 32;

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
      // Text width is renderer-dependent; use a generous estimate based on
      // height × text length so we never cull a partially-visible glyph.
      const w = entity.height * Math.max(1, entity.text.length) * 0.7;
      return {
        minX: entity.position.x,
        minY: entity.position.y - entity.height,
        maxX: entity.position.x + w,
        maxY: entity.position.y + entity.height,
      };
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
