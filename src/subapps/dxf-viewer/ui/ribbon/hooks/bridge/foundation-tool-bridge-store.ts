/**
 * ADR-436 Slice 1 — Foundation tool bridge store (drawing-mode ↔ ribbon).
 *
 * Pattern mirror του `column-tool-bridge-store.ts`. Module-level mutable cell
 * ώστε `useRibbonFoundationBridge` (ζει στο `DxfViewerContent`) να διαβάζει το
 * state του `useFoundationTool` (ζει στο `CanvasSection`) χωρίς cross-sibling
 * lift-up.
 *
 * Single writer (useFoundationTool effect) → multi reader (bridge callbacks +
 * useSyncExternalStore για visibility reactivity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type {
  FoundationAnchor,
  FoundationKind,
} from '../../../../bim/types/foundation-types';
import type {
  FoundationParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/foundation-completion';

/**
 * Snapshot of the foundation tool's user-editable state — what the ribbon needs
 * to read (combobox/number state) and write (via setters).
 */
export interface FoundationToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: FoundationKind;
  readonly anchor: FoundationAnchor;
  readonly overrides: FoundationParamOverrides;
  setKind(kind: FoundationKind): void;
  setAnchor(anchor: FoundationAnchor): void;
  setParamOverrides(overrides: FoundationParamOverrides): void;
  getSceneUnits(): SceneUnits;
}

export const foundationToolBridgeStore = createToolBridgeStore<FoundationToolBridgeHandle>();

export type { SceneUnits };
