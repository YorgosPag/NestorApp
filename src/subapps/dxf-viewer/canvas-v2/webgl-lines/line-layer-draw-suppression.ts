/**
 * ADR-640 arc-disappearance fix — per-entity "already drawn by the line layer?" predicate (SSoT).
 *
 * The `DxfRenderer` draws straight LINEs (and plain polylines) through a fast layer — either the
 * Canvas2D line-batch (`batchedIds`) or the GPU WebGL line layer (`webglOwnedIds`) — and then makes
 * a SECOND per-entity pass for everything else. That second pass must SKIP the entities the line
 * layer already drew, otherwise they'd be double-stroked.
 *
 * The skip was keyed on `entity.id` alone. But container expansion (ADR-640 block, ADR-575 group,
 * ADR-353 array) re-tags EVERY member with the SAME container id so a click resolves to the whole
 * container. So a container that mixes a LINE and an ARC gives both members the container id — the
 * line enters `batchedIds`, and the id-only check then wrongly suppressed the ARC (and every other
 * non-line member): the furniture block rendered its straight segments but its curves vanished.
 *
 * Fix: the line layer only ever draws LINE / plain-POLYLINE entities, so the suppression must be
 * gated by the entity's own TYPE — never by a shared id alone. An arc/circle/text member is never a
 * line, so it is never suppressed by a batched line sibling.
 *
 * @see canvas-v2/dxf-canvas/DxfRenderer.ts — the two per-entity skip sites that consume these
 * @see systems/block/block-expander.ts · systems/group/group-expander.ts · systems/array/array-expander.ts
 */

import type { DxfEntityUnion } from '../dxf-canvas/dxf-types';

/**
 * TRUE when `entity` was drawn by the Canvas2D LINE batch this frame (so the per-entity pass skips
 * it). Only `line` entities enter the batch, so a non-line member sharing a batched line's container
 * id is never suppressed.
 */
export function isDrawnByBatchedLineLayer(
  entity: DxfEntityUnion,
  batchedIds: ReadonlySet<string>,
): boolean {
  return entity.type === 'line' && batchedIds.has(entity.id);
}

/**
 * TRUE when `entity` was drawn by the GPU WebGL line layer this frame. The GPU layer owns straight
 * lines and plain (bulge-free, width-free) polylines only, so the suppression is gated to those two
 * types — an arc/circle/text member sharing an owned line's container id is never suppressed.
 */
export function isDrawnByWebglLineLayer(
  entity: DxfEntityUnion,
  webglOwnedIds: ReadonlySet<string> | null,
): boolean {
  if (!webglOwnedIds) return false;
  return (entity.type === 'line' || entity.type === 'polyline') && webglOwnedIds.has(entity.id);
}
