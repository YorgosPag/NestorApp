/**
 * grip-3d-twin-overlay.ts — PURE config builder for the twin (top + bottom) 3D reshape-grip
 * overlay (ADR-535 Φ6).
 *
 * Φ6 draws each footprint grip TWICE — one square on the top face, one on the bottom — so the
 * user can grab whichever surface is convenient (e.g. when looking at the slab from below).
 * The two surfaces share the SAME plan grip and the SAME reshape command; only the elevation
 * (and thus the projector) differs, so the overlay renders TWO passes (top / bottom), each with
 * its own projector but the SAME render configs logic. This module is that ONE logic, extracted
 * pure (no THREE, no React, no store) so the overlay leaf stays thin and the twin rules are
 * jest-testable.
 *
 * Flat index space (mirror {@link Grip3DInteraction}): `0…N-1` = top, `N…2N-1` = bottom; the
 * base plan grip of a flat index is `flat % N`. The DRAGGED vertex moves BOTH of its squares
 * (top + bottom of the same plan vertex follow the live position together), but only the exact
 * dragged square is force-shown — its twin on the far face still obeys occlusion.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import type { GripRenderConfig } from '../../rendering/grips/types';

/** Snapshot of the high-frequency interaction the overlay reads each frame (flat indices). */
export interface TwinOverlayInteraction {
  /** Flat index of the hovered square, or null. */
  readonly hoverIndex: number | null;
  /** Flat index of the dragged square, or null. */
  readonly dragIndex: number | null;
  /** Live (snapped) plan position the dragged vertex renders at, or null when idle. */
  readonly dragLivePlanPos: Point2D | null;
  /** Per-flat-index GPU depth visibility (length `2N`), or null when occlusion is off. */
  readonly visibility: readonly boolean[] | null;
}

/**
 * Build the `UnifiedGripRenderer` configs for ONE surface pass: `surfaceOffset` is `0` for the
 * top pass and `N` (= `grips.length`) for the bottom pass. Each config's `position` is the plan
 * point the pass's projector will lift to that surface's elevation. The dragged vertex (either
 * surface) rides the live snapped position on BOTH faces; occluded squares are dropped unless
 * they are the exact dragged square.
 */
export function buildTwinSurfaceConfigs(
  grips: readonly GripInfo[],
  surfaceOffset: number,
  interaction: TwinOverlayInteraction,
): GripRenderConfig[] {
  const n = grips.length;
  const { hoverIndex, dragIndex, dragLivePlanPos, visibility } = interaction;
  const dragBase = dragIndex === null ? null : dragIndex % n;
  const configs: GripRenderConfig[] = [];
  for (let i = 0; i < n; i++) {
    const flat = i + surfaceOffset;
    const grip = grips[i];
    const isDragVertex = dragBase === i;
    const forceShown = flat === dragIndex; // the exact dragged square always leads the edit.
    if (!forceShown && visibility && visibility[flat] === false) continue;
    const position = isDragVertex && dragLivePlanPos ? dragLivePlanPos : grip.position;
    const temperature = isDragVertex ? 'hot' : hoverIndex === flat ? 'warm' : 'cold';
    configs.push({
      position,
      type: (grip.type ?? 'vertex') as GripRenderConfig['type'],
      temperature,
      // Footprint grips carry no shape hint → the AutoCAD square, like the 2D slab grips.
      shape: 'square',
    });
  }
  return configs;
}
