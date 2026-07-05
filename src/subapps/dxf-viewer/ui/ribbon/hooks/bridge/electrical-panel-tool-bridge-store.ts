/**
 * ADR-408 Φ3 — electrical panel tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-fixture-tool-bridge-store.ts`. Module-level mutable
 * cell so ribbon callbacks and the 3D placement hook can read the
 * `useElectricalPanelTool` state (which lives inside `CanvasSection`) without a
 * cross-sibling lift-up.
 *
 * Single writer (useElectricalPanelTool effect) → multi reader (ribbon callbacks
 * + 3D ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  ElectricalPanelParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/electrical-panel-completion';
import type { ElectricalPanelKind } from '../../../../bim/types/electrical-panel-types';

/** Snapshot of the panel tool's user-editable state. */
export interface ElectricalPanelToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: ElectricalPanelKind;
  readonly overrides: ElectricalPanelParamOverrides;
  setParamOverrides(overrides: ElectricalPanelParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const electricalPanelToolBridgeStore = createToolBridgeStore<ElectricalPanelToolBridgeHandle>();

export type { SceneUnits };
