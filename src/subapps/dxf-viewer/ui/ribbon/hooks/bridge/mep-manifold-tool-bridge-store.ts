/**
 * ADR-408 Φ12 — plumbing manifold tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `electrical-panel-tool-bridge-store.ts`. Module-level mutable
 * cell so ribbon callbacks and the 3D placement hook can read the
 * `useMepManifoldTool` state (which lives inside `CanvasSection`) without a
 * cross-sibling lift-up.
 *
 * Single writer (useMepManifoldTool effect) → multi reader (ribbon callbacks
 * + 3D ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  MepManifoldParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-manifold-completion';
import type { MepManifoldKind } from '../../../../bim/types/mep-manifold-types';

/** Snapshot of the manifold tool's user-editable state. */
export interface MepManifoldToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: MepManifoldKind;
  readonly overrides: MepManifoldParamOverrides;
  setParamOverrides(overrides: MepManifoldParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const mepManifoldToolBridgeStore = createToolBridgeStore<MepManifoldToolBridgeHandle>();

export type { SceneUnits };
