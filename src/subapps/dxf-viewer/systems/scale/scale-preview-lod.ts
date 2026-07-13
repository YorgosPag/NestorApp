/**
 * scale-preview-lod.ts — drag-preview LOD for the Scale tool (ADR-646 Φάση 5, perf).
 *
 * PROBLEM: the live scale ghost (`useScalePreview`) re-runs a FULL per-entity geometry transform
 * + a REAL entity render (`drawRealEntityPreview`: model build + style resolve + composite) for
 * EVERY selected entity on EVERY drag frame. At thousands of selected entities that is O(N) heavy
 * renders per frame → the main thread freezes (the same O(N)-per-frame trap ADR-040 forbids on the
 * main canvas).
 *
 * BIG-PLAYER PRACTICE (AutoCAD/BricsCAD «simplified drag preview» for huge selections): above a
 * cap, don't draw every object at full fidelity while dragging — draw a REPRESENTATIVE SAMPLE at
 * full fidelity plus the overall transformed EXTENT box, and bake the real per-entity result only
 * on commit (unchanged). This module is the pure math for that decision — sampling, the selection's
 * union bbox, and scaling a bbox about the base point. Rendering stays in `useScalePreview`.
 *
 * NOTE (100% honesty): this is the interim, low-risk relief. The definitive big-player fix is a
 * single affine matrix over a cached ghost (O(1)/frame, Figma/AutoCAD-grade) in the shared
 * transform-ghost skeleton — tracked as ADR-646 Φάση 6.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { getEntityBBox } from '../../canvas-v2/dxf-canvas/dxf-viewport-culling';

/**
 * At or below this many selected entities the drag preview stays FULL WYSIWYG (every entity real-
 * rendered per frame — cheap enough). Above it, the preview switches to the sampled LOD path so the
 * per-frame cost is bounded. 400 full-fidelity ghosts per frame is comfortably interactive; the
 * freeze only appears in the thousands.
 */
export const SCALE_PREVIEW_FULL_FIDELITY_MAX = 400;

/** How many representative entities to still draw at full fidelity in LOD mode (stride-sampled). */
export const SCALE_PREVIEW_SAMPLE_COUNT = 400;

/** Gold extent-box colour (matches the rubber-band chrome of the transform ghost skeleton). */
export const SCALE_PREVIEW_EXTENT_COLOR = '#FFD700';

/** Axis-aligned world bounds (mirror of `getEntityBBox`'s shape — structural, no import coupling). */
export interface PreviewBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ScalePreviewLod = 'full' | 'lod';

/** Full WYSIWYG at/below the cap; sampled LOD above it. */
export function resolveScalePreviewLod(selectedCount: number): ScalePreviewLod {
  return selectedCount > SCALE_PREVIEW_FULL_FIDELITY_MAX ? 'lod' : 'full';
}

/**
 * Stride-sample up to `maxCount` ids, evenly spread across the selection (not the first N — those
 * cluster spatially). Returns the whole list unchanged when it already fits.
 */
export function sampleIds(ids: readonly string[], maxCount: number): string[] {
  if (maxCount <= 0) return [];
  if (ids.length <= maxCount) return [...ids];
  const stride = Math.ceil(ids.length / maxCount);
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += stride) out.push(ids[i]);
  return out;
}

/**
 * Union of every resolvable entity's world bbox (non-finite / missing entities skipped). Returns
 * null when nothing contributes. Computed on the UNSCALED selection — stable for the whole drag, so
 * the caller caches it once and only `scaleBBoxAboutBase` runs per frame (O(1)).
 */
export function computeUnionBBox(
  ids: readonly string[],
  getEntity: (id: string) => DxfEntityUnion | null,
): PreviewBBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (const id of ids) {
    const entity = getEntity(id);
    if (!entity) continue;
    const b = getEntityBBox(entity);
    if (!Number.isFinite(b.minX) || !Number.isFinite(b.minY)
      || !Number.isFinite(b.maxX) || !Number.isFinite(b.maxY)) continue;
    any = true;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return any ? { minX, minY, maxX, maxY } : null;
}

/** Scale a bbox about `base` by (sx, sy); re-min/maxed so a negative factor (mirror) stays valid. */
export function scaleBBoxAboutBase(b: PreviewBBox, base: Point2D, sx: number, sy: number): PreviewBBox {
  const x0 = base.x + (b.minX - base.x) * sx;
  const x1 = base.x + (b.maxX - base.x) * sx;
  const y0 = base.y + (b.minY - base.y) * sy;
  const y1 = base.y + (b.maxY - base.y) * sy;
  return {
    minX: Math.min(x0, x1), minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1), maxY: Math.max(y0, y1),
  };
}

/**
 * A minimal closed-polyline entity tracing `b` — rendered through the SAME real-entity preview path
 * as one extra object, so the LOD extent box needs no separate world→screen math. Gold, so it reads
 * as the selection's transformed footprint.
 */
export function buildExtentBoxEntity(b: PreviewBBox): DxfEntityUnion {
  return {
    id: 'scale-preview-extent',
    type: 'polyline',
    visible: true,
    color: SCALE_PREVIEW_EXTENT_COLOR,
    closed: true,
    vertices: [
      { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY },
    ],
  } as unknown as DxfEntityUnion;
}
