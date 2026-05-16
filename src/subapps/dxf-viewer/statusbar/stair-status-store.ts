/**
 * ADR-358 Phase 7b1 — Stair tool status text SSoT for CadStatusBar.
 *
 * `useStairTool` (`hooks/drawing/useStairTool.ts`) publishes the current
 * status-text i18n key on every phase transition; `CadStatusBar` reads
 * it via `useStairStatusKey()` to render an inline prompt when the
 * stair tool is active.
 *
 * Why a module-level store instead of context:
 *   - useStairTool lives inside `CanvasSection` (Phase 5a wiring through
 *     `useSpecialTools`). `CadStatusBar` is a sibling of `CanvasSection`
 *     in `NormalView`. A shared React context would require lifting
 *     `useSpecialTools` above `NormalView` (touches Phase 7a frozen
 *     `DxfViewerContent.tsx`).
 *   - useSyncExternalStore against a tiny mutable cell is the Google-
 *     level idiomatic React 18 escape-hatch for cross-sibling state
 *     that originates outside the component tree.
 *   - ADR-040: `CadStatusBar.tsx` is NOT in the protected micro-leaf
 *     list (CHECK 6B/6C) so subscribing here is safe.
 *
 * Single writer, multi reader: `useStairTool` is the unique writer.
 */

import { useSyncExternalStore } from 'react';

type Listener = () => void;

let currentKey: string | null = null;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  return currentKey;
}

function getServerSnapshot(): string | null {
  return null;
}

export const stairStatusStore = {
  /** Writer — called by `useStairTool` on phase change. */
  set(key: string | null): void {
    if (key === currentKey) return;
    currentKey = key;
    for (const l of listeners) l();
  },
  /** Reader (non-React) — escape hatch for tests. */
  get(): string | null {
    return currentKey;
  },
};

/**
 * Subscribe to the current stair-tool status-text i18n key.
 * Returns `null` when the stair tool is idle / deactivated.
 */
export function useStairStatusKey(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
