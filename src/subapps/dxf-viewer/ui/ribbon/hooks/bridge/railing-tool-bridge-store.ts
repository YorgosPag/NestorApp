/**
 * ADR-407 — Railing tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-fixture-tool-bridge-store.ts`. Module-level mutable
 * cell so the ribbon callbacks and the 3D placement hook can read the
 * `useRailingTool` state (which lives inside `CanvasSection`) without a
 * cross-sibling lift-up.
 *
 * Single writer (useRailingTool effect) → multi reader (ribbon callbacks + 3D
 * ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  RailingParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/railing-completion';

/** Snapshot of the railing tool's user-editable state. */
export interface RailingToolBridgeHandle {
  readonly isActive: boolean;
  readonly overrides: RailingParamOverrides;
  setParamOverrides(overrides: RailingParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const railingToolBridgeStore = createToolBridgeStore<RailingToolBridgeHandle>();

export type { SceneUnits };
