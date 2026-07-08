/**
 * ClipToRegionService — clips a DXF scene to a rectangular window region.
 *
 * Thin wrapper over the shared region-strategy crop SSoT: builds a `RectClipRegion`
 * and delegates every per-entity clip to `clip-entity.ts`. All geometry lives in
 * `clip/clip-geometry.ts`; the per-type clippers are shared with the polygon/lasso
 * crop (`ClipToPolygonService`). Per-type algorithm docs: `clip/clip-entity.ts`.
 */

import type { Entity } from '../types/entities';
import type { ClipRect } from './clip/clip-geometry';
import { RectClipRegion } from './clip/clip-region';
import { clipEntity, clipRegionLoop } from './clip/clip-entity';

export type { ClipRect } from './clip/clip-geometry';

export class ClipToRegionService {
  clip<T extends { entities: Entity[] }>(scene: T, rect: ClipRect): T {
    const region = new RectClipRegion(rect);
    const clipped: Entity[] = [];
    for (const entity of scene.entities) {
      clipped.push(...clipEntity(entity, region));
    }
    return { ...scene, entities: clipped };
  }

  /**
   * Clip a single overlay polygon (world-space Array<[x,y]>) to the rect.
   * Returns null if fully outside (delete), the same array ref if fully inside
   * (skip), else a new Sutherland-Hodgman clipped polygon.
   */
  clipOverlayPolygon(
    polygon: Array<[number, number]>,
    rect: ClipRect,
  ): Array<[number, number]> | null {
    return clipRegionLoop(polygon, new RectClipRegion(rect));
  }
}
