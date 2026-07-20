/**
 * ADR-462 Round 21 — drop far-flung off-drawing junk at import.
 *
 * Some DXFs (classically geo-referenced Greek surveys) carry a handful of decorative /
 * orphan entities parked at the origin (legacy `ASHADE` render blocks, stray ATTRIBs)
 * while the real drawing is geo-referenced far away (~131M mm). AutoCAD itself excludes
 * these from `$EXTMIN/$EXTMAX` and its Zoom-Extents. Left in, they anchor the scene
 * bounding box from 0 to the geo-referenced magnitude, so the viewport frames a
 * ~742-million-unit box and the real 168k-wide drawing collapses to a sub-pixel speck —
 * an "empty canvas" even though the entities imported fine.
 *
 * This removes ONLY entities that lie ENTIRELY outside the drawing's own declared extents
 * (`$EXTMIN/$EXTMAX`) by a full drawing-diagonal of slack, and ONLY when those extents are
 * usable (finite, non-sentinel, positive area). Any overlap with the real drawing → kept;
 * no declared extents → no-op. So a normal drawing (its entities live inside its extents)
 * is never touched — this fires only for the far-flung-junk pathology.
 */

import type { AnySceneEntity } from '../types/scene';
import { computeEntityArrayBounds } from './dxf-entity-array-bounds';
import { isUsableDetectionExtent, type DetectionBounds } from './scene-units';

export interface OutOfExtentsResult {
  kept: AnySceneEntity[];
  dropped: number;
}

export function dropOutOfExtentsEntities(
  entities: AnySceneEntity[],
  extmin: { x: number; y: number } | undefined,
  extmax: { x: number; y: number } | undefined,
): OutOfExtentsResult {
  if (!extmin || !extmax) return { kept: entities, dropped: 0 };
  const extents: DetectionBounds = { min: extmin, max: extmax };
  if (!isUsableDetectionExtent(extents)) return { kept: entities, dropped: 0 };

  const dx = extmax.x - extmin.x;
  const dy = extmax.y - extmin.y;
  // One full drawing-diagonal of slack around the real extents: an entity must sit MORE
  // than a whole drawing-width away to be considered junk. Origin junk in a geo-referenced
  // file is hundreds of diagonals away, so it is dropped with an enormous safety margin,
  // while anything hugging the drawing (even slightly past stale extents) survives.
  const margin = Math.hypot(dx, dy);
  const minX = extmin.x - margin, maxX = extmax.x + margin;
  const minY = extmin.y - margin, maxY = extmax.y + margin;

  const kept: AnySceneEntity[] = [];
  let dropped = 0;
  for (const e of entities) {
    const b = computeEntityArrayBounds([e]);
    const finite =
      Number.isFinite(b.min.x) && Number.isFinite(b.min.y) &&
      Number.isFinite(b.max.x) && Number.isFinite(b.max.y);
    // Drop only when finite AND entirely outside the padded extents. On any uncertainty
    // (degenerate/empty bounds) keep the entity — never delete geometry on a guess.
    const entirelyOutside = b.max.x < minX || b.min.x > maxX || b.max.y < minY || b.min.y > maxY;
    if (finite && entirelyOutside) {
      dropped++;
      continue;
    }
    kept.push(e);
  }
  return { kept, dropped };
}
