/**
 * ADR-415 — Floorplan-symbol tool bridge store (drawing-mode ↔ ribbon).
 *
 * Pattern mirror of `furniture-tool-bridge-store.ts`. Module-level mutable cell so
 * the ribbon contextual picker can read/write the `useFloorplanSymbolTool` state
 * (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Single writer (useFloorplanSymbolTool effect) → multi reader (ribbon callbacks).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type { FloorplanSymbolParamOverrides } from '../../../../hooks/drawing/floorplan-symbol-completion';

/** Snapshot of the floorplan-symbol tool's user-editable state. */
export interface FloorplanSymbolToolBridgeHandle {
  readonly isActive: boolean;
  readonly assetId: string;
  readonly overrides: FloorplanSymbolParamOverrides;
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: FloorplanSymbolParamOverrides): void;
}

export const floorplanSymbolToolBridgeStore = createToolBridgeStore<FloorplanSymbolToolBridgeHandle>();
