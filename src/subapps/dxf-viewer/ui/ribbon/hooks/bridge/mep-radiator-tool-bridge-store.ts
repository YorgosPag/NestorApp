/**
 * ADR-408 Εύρος Β #1 — heating radiator tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-manifold-tool-bridge-store.ts`. Module-level mutable cell
 * so ribbon callbacks and the 3D placement hook can read the `useMepRadiatorTool`
 * state (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Single writer (useMepRadiatorTool effect) → multi reader (ribbon callbacks + 3D
 * ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  MepRadiatorParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-radiator-completion';
import type { MepRadiatorKind } from '../../../../bim/types/mep-radiator-types';

/** Snapshot of the radiator tool's user-editable state. */
export interface MepRadiatorToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: MepRadiatorKind;
  readonly overrides: MepRadiatorParamOverrides;
  setParamOverrides(overrides: MepRadiatorParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const mepRadiatorToolBridgeStore = createToolBridgeStore<MepRadiatorToolBridgeHandle>();

export type { SceneUnits };
