/**
 * ADR-406 — MEP fixture tool bridge store (drawing-mode ↔ ribbon ↔ 3D).
 *
 * Pattern mirror of `column-tool-bridge-store.ts`. Module-level mutable cell so
 * `useRibbonMepFixtureBridge` and the 3D placement hook can read the
 * `useMepFixtureTool` state (which lives inside `CanvasSection`) without a
 * cross-sibling lift-up.
 *
 * Single writer (useMepFixtureTool effect) → multi reader (ribbon callbacks +
 * 3D ghost scene-units read at event time).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { useSyncExternalStore } from 'react';
import type {
  MepFixtureParamOverrides,
  SceneUnits,
} from '../../../../hooks/drawing/mep-fixture-completion';
import type { MepFixtureKind, MepFixtureShape } from '../../../../bim/types/mep-fixture-types';

/** Snapshot of the fixture tool's user-editable state. */
export interface MepFixtureToolBridgeHandle {
  readonly isActive: boolean;
  readonly kind: MepFixtureKind;
  readonly shape: MepFixtureShape;
  readonly overrides: MepFixtureParamOverrides;
  setShape(shape: MepFixtureShape): void;
  setParamOverrides(overrides: MepFixtureParamOverrides): void;
  /** Active scene units, so the 3D ghost builds with correct mm→scene conversion. */
  getSceneUnits(): SceneUnits;
}

type Listener = () => void;

let handle: MepFixtureToolBridgeHandle | null = null;
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

function getSnapshot(): MepFixtureToolBridgeHandle | null {
  return handle;
}

function getServerSnapshot(): MepFixtureToolBridgeHandle | null {
  return null;
}

export const mepFixtureToolBridgeStore = {
  set(next: MepFixtureToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): MepFixtureToolBridgeHandle | null {
    return handle;
  },
  use(): MepFixtureToolBridgeHandle | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  },
};

export type { SceneUnits };
