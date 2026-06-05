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

import { useSyncExternalStore } from 'react';
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

type Listener = () => void;

let handle: MepBoilerToolBridgeHandle | null = null;
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

function getSnapshot(): MepBoilerToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): MepBoilerToolBridgeHandle | null {
  return null;
}

export const mepBoilerToolBridgeStore = {
  set(next: MepBoilerToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): MepBoilerToolBridgeHandle | null {
    return handle;
  },
  use(): MepBoilerToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};

export type { SceneUnits };
