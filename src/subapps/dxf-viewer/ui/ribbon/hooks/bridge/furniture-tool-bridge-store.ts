/**
 * ADR-410 — Furniture tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-fixture-tool-bridge-store.ts`. Module-level mutable cell
 * so the ribbon bridge and the 3D placement hook can read the `useFurnitureTool`
 * state (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Single writer (useFurnitureTool effect) → multi reader (ribbon callbacks +
 * 3D ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  FurnitureParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/furniture-completion';
import type { FurnitureKind } from '../../../../bim/types/furniture-types';

/** Snapshot of the furniture tool's user-editable state. */
export interface FurnitureToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: FurnitureKind;
  readonly assetId: string;
  readonly overrides: FurnitureParamOverrides;
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: FurnitureParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const furnitureToolBridgeStore = createToolBridgeStore<FurnitureToolBridgeHandle>();

export type { SceneUnits };
