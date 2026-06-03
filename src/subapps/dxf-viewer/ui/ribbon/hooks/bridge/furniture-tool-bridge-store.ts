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

import { useSyncExternalStore } from 'react';
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

type Listener = () => void;

let handle: FurnitureToolBridgeHandle | null = null;
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

function getSnapshot(): FurnitureToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): FurnitureToolBridgeHandle | null {
  return null;
}

export const furnitureToolBridgeStore = {
  set(next: FurnitureToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): FurnitureToolBridgeHandle | null {
    return handle;
  },
  use(): FurnitureToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};

export type { SceneUnits };
