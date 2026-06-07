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

import { useSyncExternalStore } from 'react';

/** Snapshot of the riser tool's user-editable placement state. */
export interface MepRiserToolBridgeHandle {
  readonly isActive: boolean;
  /** mm — total vertical span of the stack (base = building datum). */
  readonly heightMm: number;
  /** mm — pipe diameter (DN). */
  readonly diameterMm: number;
  setHeight(heightMm: number): void;
  setDiameter(diameterMm: number): void;
}

type Listener = () => void;

let handle: MepRiserToolBridgeHandle | null = null;
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

function getSnapshot(): MepRiserToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): MepRiserToolBridgeHandle | null {
  return null;
}

export const mepRiserToolBridgeStore = {
  set(next: MepRiserToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): MepRiserToolBridgeHandle | null {
    return handle;
  },
  use(): MepRiserToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};
