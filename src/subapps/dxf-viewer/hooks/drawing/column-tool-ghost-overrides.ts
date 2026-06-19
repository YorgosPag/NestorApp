/**
 * ADR-363 Phase 4.5c.1 — Column anchor-ghost overrides projection (pure).
 *
 * Extracted from `useColumnTool` (N.7.1 file-size split). Maps the broad
 * `ColumnParamOverrides` (kind+anchor flattened to args) down to the
 * `ColumnGhostOverrides` subset consumed by `computeAnchorGhostFootprints` —
 * width/depth/height/rotation/material/lshape/tshape + polygon/ishape variants
 * (Phase 8D). kind/anchor are passed explicitly by the caller, never spread.
 *
 * @see ./useColumnTool — getGhostFootprints()
 */

import type { ColumnGhostOverrides } from '../../bim/columns/column-anchor-ghosts';
import type { ColumnParamOverrides, SceneUnits } from './column-completion';

/**
 * Build the `ColumnGhostOverrides` for the anchor-ghost preview from the active
 * tool overrides. Only defined keys are forwarded (omit-if-undefined keeps the
 * ghost defaults intact). Pure: no state mutation, no store subscription.
 */
export function buildColumnGhostOverrides(
  overrides: ColumnParamOverrides,
  sceneUnits: SceneUnits,
): ColumnGhostOverrides {
  return {
    ...(overrides.width !== undefined ? { width: overrides.width } : {}),
    ...(overrides.depth !== undefined ? { depth: overrides.depth } : {}),
    ...(overrides.height !== undefined ? { height: overrides.height } : {}),
    ...(overrides.rotation !== undefined ? { rotation: overrides.rotation } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.lshape !== undefined ? { lshape: overrides.lshape } : {}),
    ...(overrides.tshape !== undefined ? { tshape: overrides.tshape } : {}),
    // ADR-363 Phase 8D — polygon/ishape variant overrides drive ghost preview
    // geometry for the 3 new kinds (polygon sides, I-shape flange/web thickness).
    ...(overrides.polygon !== undefined ? { polygon: overrides.polygon } : {}),
    ...(overrides.ishape !== undefined ? { ishape: overrides.ishape } : {}),
    sceneUnits,
  };
}
