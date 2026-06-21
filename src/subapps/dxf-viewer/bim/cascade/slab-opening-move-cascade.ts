/**
 * Slab-Opening MOVE Cascade — the delta wrapper over the transform-agnostic engine
 * (ADR-049, mirror of `wall-opening-coordinator`).
 *
 * Slab-openings store their footprint as an INDEPENDENT world polygon
 * (`SlabOpeningParams.outline`), unlike wall-openings whose world geometry is derived
 * from the host wall. So when a slab moves, its hosted slab-openings must be TRANSLATED
 * by the same delta (not recomputed against the host).
 *
 * Previously this lived as a selection-expansion (`expandSelectionForMove`) wired ONLY
 * into the Move Tool — so a direct drag or keyboard nudge of a slab left its openings
 * behind. The cascade now lives INSIDE the Move commands (mirror of
 * `cascadeHostedOpeningsForWalls` / `reframeBeamsAndEmit`), so EVERY gesture carries the
 * openings for free — the Revit principle that associative reactions live in the
 * transaction, not the UI gesture.
 *
 * This module is the MOVE specialisation of the generic engine in
 * `cascade-transformed-slab-openings.ts`: it derives each opening's patch from the 3D
 * move `delta` (`calculateBimMovedGeometry`) and returns only the moved openings (move
 * undo re-runs with the reverse delta, so it needs no snapshots). Rotate/scale/mirror
 * reuse the SAME engine from the transform spine — zero divergence.
 *
 * Undo/redo symmetry: the translation is delta-invertible, so undo applies the reverse
 * delta — no per-opening snapshot needed.
 *
 * @see bim/cascade/cascade-transformed-slab-openings.ts — the transform-agnostic engine (SSoT)
 * @see bim/walls/wall-opening-coordinator.ts — the wall-opening twin (recompute)
 * @see bim/cascade/bim-cascade-resolver.ts — `findHostedSlabOpenings` (slabId scan)
 * @see docs/centralized-systems/reference/adrs/ADR-049-unified-move-tool-dxf-overlays.md
 */

import type { SceneEntity } from '../../core/commands/interfaces';
// ADR-049 Phase 2 — receives the FULL 3D move delta; slab-openings track the slab
// plane via x/y only (no own vertical field), so `z` is harmlessly ignored here.
import type { Point3D } from '../types/bim-base';
import type { Entity } from '../../types/entities';
import { calculateBimMovedGeometry } from '../utils/bim-move-geometry';
import {
  cascadeTransformedSlabOpenings,
  type SlabOpeningCascadeSceneManager,
} from './cascade-transformed-slab-openings';

/**
 * Translate every slab-opening hosted on a slab in `movedIds` by `delta`. Thin wrapper
 * over {@link cascadeTransformedSlabOpenings}: the move derives each opening's patch from
 * the delta and the moved openings ride the `bim:entities-moved` emit. See the engine for
 * the full contract (move-set exclusion, no-op conditions).
 */
export function cascadeMovedSlabOpenings(
  movedIds: readonly string[],
  delta: Point3D,
  sceneManager: SlabOpeningCascadeSceneManager,
): SceneEntity[] {
  return cascadeTransformedSlabOpenings(
    movedIds,
    sceneManager,
    (opening: Entity) => calculateBimMovedGeometry(opening, delta),
  ).moved;
}
