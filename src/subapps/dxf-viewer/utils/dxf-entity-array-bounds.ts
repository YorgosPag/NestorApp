/**
 * ADR-635 ΦC.13 / N.18 — pure entity-array bounds accumulator (SSoT).
 *
 * Extracted from `DxfSceneBuilder.calculateBounds` so the scene-builder stays lean and
 * this bounds pass can be unit-tested + reused directly. Feeds the viewport auto-fit
 * extents. ONE point-accumulator (`expand`) widens the box for every geometry type, so a
 * new type is a single `expand()` call — never a copy-pasted 4-line min/max block (the
 * polyline↔hatch twin jscpd once flagged).
 */
import type { AnySceneEntity } from '../types/scene';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization.
import { createInfinityBounds } from '../config/geometry-constants';

/** Axis-aligned {min,max} extents of an entity array (auto-fit input). */
export function computeEntityArrayBounds(
  entities: AnySceneEntity[],
): { min: { x: number; y: number }; max: { x: number; y: number } } {
  const bounds = createInfinityBounds();

  const expand = (x: number, y: number): void => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  entities.forEach(entity => {
    switch (entity.type) {
      case 'line':
        expand(entity.start.x, entity.start.y);
        expand(entity.end.x, entity.end.y);
        break;
      case 'polyline':
        entity.vertices.forEach(v => expand(v.x, v.y));
        break;
      case 'circle':
      case 'arc':
        expand(entity.center.x - entity.radius, entity.center.y - entity.radius);
        expand(entity.center.x + entity.radius, entity.center.y + entity.radius);
        break;
      case 'hatch':
        // ADR-635 Φ C.13 — HATCH geometry lives in `boundaryPaths` (rings of {x,y}), NOT in a
        // primitive field, so the scene-bounds pass must scan the rings explicitly. Without
        // this a HATCH is EXCLUDED from auto-fit extents: a drawing whose ONLY other geometry
        // is a sibling block fits to the block and leaves the hatch off-screen (repro:
        // ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ — «φαίνεται μόνο το μπλοκ»). Mirrors the culling
        // `getEntityBBox` hatch case (dxf-viewport-culling.ts).
        entity.boundaryPaths?.forEach(ring => ring.forEach(v => expand(v.x, v.y)));
        break;
      // ADR-641 — text/point/ellipse/rectangle/spline were SILENTLY EXCLUDED from the bounds box,
      // so a block whose extent is defined by these types produced empty bounds → the Block Editor's
      // recenter centre `C` (computeBlockEditViewTransform) fell back to (0,0) → members were NOT
      // recentred and rendered at their raw WORLD coordinates, off-screen («η οντότητα εξαφανίζεται»,
      // Giorgio 2026-07-13). Each type contributes its geometry so the box covers ALL members.
      case 'ellipse': {
        // Rotation-agnostic circular envelope (major-axis radius) — never under-covers the ellipse.
        const r = Math.max(Math.abs(entity.majorAxis), Math.abs(entity.minorAxis));
        expand(entity.center.x - r, entity.center.y - r);
        expand(entity.center.x + r, entity.center.y + r);
        break;
      }
      case 'rectangle':
      case 'rect':
        expand(entity.x, entity.y);
        expand(entity.x + entity.width, entity.y + entity.height);
        break;
      case 'spline':
        entity.controlPoints.forEach(v => expand(v.x, v.y));
        break;
      case 'text':
      case 'mtext':
      case 'point':
        // Position-anchored: the insertion point locates the member (enough for recenter + fit).
        expand(entity.position.x, entity.position.y);
        break;
    }
  });

  return {
    min: { x: bounds.minX, y: bounds.minY },
    max: { x: bounds.maxX, y: bounds.maxY },
  };
}
