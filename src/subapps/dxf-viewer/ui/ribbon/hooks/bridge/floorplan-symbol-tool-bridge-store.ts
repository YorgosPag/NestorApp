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

import { useSyncExternalStore } from 'react';
import type { FloorplanSymbolParamOverrides } from '../../../../hooks/drawing/floorplan-symbol-completion';

/** Snapshot of the floorplan-symbol tool's user-editable state. */
export interface FloorplanSymbolToolBridgeHandle {
  readonly isActive: boolean;
  readonly assetId: string;
  readonly overrides: FloorplanSymbolParamOverrides;
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: FloorplanSymbolParamOverrides): void;
}

type Listener = () => void;

let handle: FloorplanSymbolToolBridgeHandle | null = null;
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

function getSnapshot(): FloorplanSymbolToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): FloorplanSymbolToolBridgeHandle | null {
  return null;
}

export const floorplanSymbolToolBridgeStore = {
  set(next: FloorplanSymbolToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): FloorplanSymbolToolBridgeHandle | null {
    return handle;
  },
  use(): FloorplanSymbolToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};
