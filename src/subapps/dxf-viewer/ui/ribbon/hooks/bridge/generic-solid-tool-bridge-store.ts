/**
 * ADR-684 Φ3 — Generic-solid tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `furniture-tool-bridge-store.ts`. Module-level mutable cell so
 * the ribbon bridge and the 3D placement hook can read the `useGenericSolidTool`
 * state (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Single writer (useGenericSolidTool effect) → multi reader (ribbon shape/param
 * callbacks + 3D ghost scene-units read at event time).
 *
 * Divergence from furniture: the bespoke handle field is the chosen `shape`
 * (GenericSolidShape discriminated union) instead of a catalog `assetId`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  GenericSolidParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/generic-solid-completion';
import type { GenericSolidShape } from '../../../../bim/entities/generic-solid/generic-solid-types';

/** Snapshot of the generic-solid tool's user-editable state. */
export interface GenericSolidToolBridgeHandle {
  readonly isActive: boolean;
  /** The currently selected shape + its dims (ribbon shape selector SSoT). */
  readonly shape: GenericSolidShape;
  readonly overrides: GenericSolidParamOverrides;
  setShape(shape: GenericSolidShape): void;
  setParamOverrides(overrides: GenericSolidParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

export const genericSolidToolBridgeStore =
  createToolBridgeStore<GenericSolidToolBridgeHandle>();

export type { SceneUnits };
