/**
 * ADR-408 DHW — domestic hot water heater tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `mep-boiler-tool-bridge-store.ts`. Module-level mutable cell
 * so ribbon callbacks and the 3D placement hook can read the `useMepWaterHeaterTool`
 * state (which lives inside `CanvasSection`) without a cross-sibling lift-up.
 *
 * Single writer (useMepWaterHeaterTool effect) → multi reader (ribbon callbacks + 3D
 * ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useSyncExternalStore } from 'react';
import type {
  MepWaterHeaterParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-water-heater-completion';
import type { MepWaterHeaterKind } from '../../../../bim/types/mep-water-heater-types';

/** Snapshot of the water heater tool's user-editable state. */
export interface MepWaterHeaterToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: MepWaterHeaterKind;
  readonly overrides: MepWaterHeaterParamOverrides;
  setParamOverrides(overrides: MepWaterHeaterParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

type Listener = () => void;

let handle: MepWaterHeaterToolBridgeHandle | null = null;
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

function getSnapshot(): MepWaterHeaterToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): MepWaterHeaterToolBridgeHandle | null {
  return null;
}

export const mepWaterHeaterToolBridgeStore = {
  set(next: MepWaterHeaterToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): MepWaterHeaterToolBridgeHandle | null {
    return handle;
  },
  use(): MepWaterHeaterToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};

export type { SceneUnits };
