/**
 * ClipToPolygonService — clips a DXF scene to a freehand polygon (lasso) region.
 *
 * Thin wrapper over the shared region-strategy crop SSoT: builds a `PolygonClipRegion`
 * and delegates every per-entity clip to `clip-entity.ts`. The per-type clippers are
 * shared with the rectangular crop (`ClipToRegionService`); geometry lives in
 * `clip/clip-geometry.ts`. Per-type algorithm docs: `clip/clip-entity.ts`.
 *
 * NOTE: Sutherland-Hodgman is exact for convex clip polygons. For concave lasso
 * regions closed-shape clipping is an over-inclusive approximation. Acceptable for v1.
 */

import type { Entity } from '../types/entities';
import { PolygonClipRegion } from './clip/clip-region';
import { clipEntity, clipRegionLoop } from './clip/clip-entity';

export class ClipToPolygonService {
  clipByPolygon<T extends { entities: Entity[] }>(scene: T, polygon: Array<[number, number]>): T {
    const region = new PolygonClipRegion(polygon);
    const clipped: Entity[] = [];
    for (const entity of scene.entities) {
      clipped.push(...clipEntity(entity, region));
    }
    return { ...scene, entities: clipped };
  }

  /**
   * Clip an overlay polygon (world-space Array<[x,y]>) to the lasso polygon.
   * Returns null if fully outside, the same array ref if fully inside, else the
   * Sutherland-Hodgman clipped polygon (approximate for concave lasso).
   */
  clipOverlayPolygonByLasso(
    polygon: Array<[number, number]>,
    lasso: Array<[number, number]>,
  ): Array<[number, number]> | null {
    if (lasso.length < 3) return null;
    return clipRegionLoop(polygon, new PolygonClipRegion(lasso));
  }
}
