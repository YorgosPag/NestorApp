/**
 * ADR-408 Εύρος Β #2 — heating boiler tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-radiator-tool-bridge-store.ts`. Module-level mutable cell
 * so ribbon callbacks and the 3D placement hook can read the `useMepBoilerTool`
 * state (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Single writer (useMepBoilerTool effect) → multi reader (ribbon callbacks + 3D
 * ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  MepBoilerParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-boiler-completion';
import type { MepBoilerKind } from '../../../../bim/types/mep-boiler-types';

/** Snapshot of the boiler tool's user-editable state. */
export interface MepBoilerToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: MepBoilerKind;
  readonly overrides: MepBoilerParamOverrides;
  setParamOverrides(overrides: MepBoilerParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const mepBoilerToolBridgeStore = createToolBridgeStore<MepBoilerToolBridgeHandle>();

export type { SceneUnits };
