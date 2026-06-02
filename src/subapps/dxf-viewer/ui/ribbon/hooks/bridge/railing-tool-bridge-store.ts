/**
 * ADR-407 — Railing tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-fixture-tool-bridge-store.ts`. Module-level mutable
 * cell so the ribbon callbacks and the 3D placement hook can read the
 * `useRailingTool` state (which lives inside `CanvasSection`) without a
 * cross-sibling lift-up.
 *
 * Single writer (useRailingTool effect) → multi reader (ribbon callbacks + 3D
 * ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { useSyncExternalStore } from 'react';
import type {
  RailingParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/railing-completion';

/** Snapshot of the railing tool's user-editable state. */
export interface RailingToolBridgeHandle {
  readonly isActive: boolean;
  readonly overrides: RailingParamOverrides;
  setParamOverrides(overrides: RailingParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

type Listener = () => void;

let handle: RailingToolBridgeHandle | null = null;
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

function getSnapshot(): RailingToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): RailingToolBridgeHandle | null {
  return null;
}

export const railingToolBridgeStore = {
  set(next: RailingToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): RailingToolBridgeHandle | null {
    return handle;
  },
  use(): RailingToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};

export type { SceneUnits };
