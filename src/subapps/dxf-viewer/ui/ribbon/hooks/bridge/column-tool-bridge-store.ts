/**
 * ADR-363 Phase 8D — Column tool bridge store (drawing-mode ↔ ribbon).
 *
 * Pattern mirror του `stair-status-store.ts` (ADR-358 Phase 7b1). Module-level
 * mutable cell ώστε `useRibbonColumnBridge` να μπορεί να διαβάσει το state του
 * `useColumnTool` (που ζει μέσα στο `CanvasSection`) χωρίς cross-sibling
 * lift-up στο `DxfViewerContent`.
 *
 * Why module store instead of context:
 *   - `useColumnTool` ζει στο `CanvasSection` (via `useSpecialTools`).
 *   - `useRibbonColumnBridge` ζει στο `DxfViewerContent` (via `useDxfBimBridges`).
 *   - Sibling subtrees — shared context would require lifting `useSpecialTools`
 *     above `DxfViewerContent` (intrusive, ADR-040 micro-leaf risk).
 *
 * Single writer (useColumnTool effect) → multi reader (bridge callbacks +
 * useSyncExternalStore for visibility reactivity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8D
 */

import { useSyncExternalStore } from 'react';
import type {
  ColumnAnchor,
  ColumnKind,
  ColumnIShapeParams,
  ColumnPolygonParams,
} from '../../../../bim/types/column-types';
import type {
  ColumnParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/column-completion';

/**
 * Snapshot of the column tool's user-editable state — what the ribbon needs
 * to read (for combobox state) and write (via setters).
 */
export interface ColumnToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: ColumnKind;
  readonly anchor: ColumnAnchor;
  readonly overrides: ColumnParamOverrides;
  setKind(kind: ColumnKind): void;
  setAnchor(anchor: ColumnAnchor): void;
  setParamOverrides(overrides: ColumnParamOverrides): void;
  /**
   * ADR-398 — active scene units, so the Column Body Corner Projection snap
   * (`mouse-handler-move` / `mouse-handler-up`) can build the would-be column at
   * the cursor with correct mm→scene conversion during placement.
   */
  getSceneUnits(): SceneUnits;
}

type Listener = () => void;

let handle: ColumnToolBridgeHandle | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ColumnToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): ColumnToolBridgeHandle | null {
  return null;
}

export const columnToolBridgeStore = {
  /**
   * Writer — called by `useColumnTool` effect on every render where state or
   * setter identity changes (useEffect with state deps). Replaces the
   * previously published handle.
   */
  set(next: ColumnToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): ColumnToolBridgeHandle | null {
    return handle;
  },
  /** Reactive read for components that need to re-render on state change. */
  use(): ColumnToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};

// Re-export the unused SceneUnits type so importers don't need a second path.
export type { SceneUnits };
