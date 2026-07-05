/**
 * ADR-408 Φ15 — MEP riser (κατακόρυφη στήλη) tool bridge store (drawing ↔ ribbon).
 *
 * Pattern mirror of `mep-fixture-tool-bridge-store.ts`. Module-level mutable cell so
 * the contextual «Κατακόρυφη Στήλη» ribbon tab can drive the `useMepRiserTool` state
 * (height + diameter) without a cross-sibling lift-up. Single writer (the tool
 * effect) → multi reader (ribbon callbacks).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';

/** Snapshot of the riser tool's user-editable placement state. */
export interface MepRiserToolBridgeHandle {
  readonly isActive: boolean;
  /** mm — datum-relative elevation of the stack base («Από όροφο»). */
  readonly baseElevationMm: number;
  /** mm — datum-relative elevation of the stack top («Έως όροφο»). */
  readonly topElevationMm: number;
  /** mm — pipe diameter (DN). */
  readonly diameterMm: number;
  /** Set both ends of the span at once (Revit base/top constraint). */
  setSpanMm(baseMm: number, topMm: number): void;
  setDiameter(diameterMm: number): void;
}

export const mepRiserToolBridgeStore = createToolBridgeStore<MepRiserToolBridgeHandle>();
