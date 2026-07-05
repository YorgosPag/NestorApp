/**
 * ADR-406 — MEP fixture tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `column-tool-bridge-store.ts`. Module-level mutable cell so
 * `useRibbonMepFixtureBridge` and the 3D placement hook can read the
 * `useMepFixtureTool` state (which lives inside `CanvasSection`) without a
 * cross-sibling lift-up.
 *
 * Single writer (useMepFixtureTool effect) → multi reader (ribbon callbacks +
 * 3D ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  MepFixtureParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-fixture-completion';
import type { MepFixtureKind, MepFixtureShape } from '../../../../bim/types/mep-fixture-types';

/** Snapshot of the fixture tool's user-editable state. */
export interface MepFixtureToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: MepFixtureKind;
  readonly shape: MepFixtureShape;
  /**
   * ADR-411 — selected CC0 mesh asset id, or `''` for the parametric fixture
   * (no mesh). Drives the drawing-tool library picker.
   */
  readonly assetId: string;
  readonly overrides: MepFixtureParamOverrides;
  setShape(shape: MepFixtureShape): void;
  /** ADR-411 — pick a library model (`''` ⇒ parametric, no mesh). */
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: MepFixtureParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const mepFixtureToolBridgeStore = createToolBridgeStore<MepFixtureToolBridgeHandle>();

export type { SceneUnits };
