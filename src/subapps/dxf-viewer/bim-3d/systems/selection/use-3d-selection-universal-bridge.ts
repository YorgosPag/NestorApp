'use client';

/**
 * ADR-402 — Unified selection bridge (3D → universal).
 *
 * Revit / ArchiCAD model: there is ONE selection truth, regardless of which
 * viewport the user clicked in. The 3D viewport owns `Selection3DStore`; the
 * rest of the app (per-type Firestore persistence auto-save, contextual ribbon,
 * property panels) keys off the **universal** selection (`primarySelectedId =
 * universalSelection.getPrimaryId()`).
 *
 * Without this bridge a 3D gizmo move / rotate / resize updates the scene
 * optimistically but never marks its entity `primarySelected`, so the
 * selection-driven persistence auto-save (`useStairPersistence` &
 * `useWallPersistence` & the other BIM hosts) never fires — and the next
 * Firestore snapshot's diff-merge reverts the optimistic edit (the "stair jumps
 * to the new spot then snaps back + deselects" bug). Mirroring the 3D selection
 * into the universal selection lets the EXISTING persistence + UI react to 3D
 * edits with ZERO per-type wiring (full SSoT).
 *
 * One-way (3D → universal): there is no universal → 3D path, and the value
 * diff-guard makes the push idempotent, so there is no feedback loop. The zustand
 * subscription fires only when the 3D selection set actually changes, so a
 * pure-2D session (no 3D selection activity) is never clobbered.
 */

import { useEffect } from 'react';
import { useSelection3DStore } from '../../stores/Selection3DStore';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
// ADR-532 Stage 5 — non-reactive facade. This bridge reacts to the 3D zustand
// store (not to the universal selection), and only ever reads/writes the
// selection via methods INSIDE the effect. Subscribing reactively re-rendered
// the `DxfViewerContent` orchestrator on every 2D click AND re-subscribed the
// zustand listener each time (the `[universal]` dep churned). The stable facade
// keeps the object identity fixed (live store reads) → the effect subscribes
// once, and the orchestrator is severed from the selection set.
import { useUniversalSelectionStable } from '../../../systems/selection/SelectionSystem';

/**
 * Re-entrancy guard for the 3D→universal push. The cross-mode hydration (universal→3D, on 3D
 * entry) writes the 3D store from the universal set; without this guard that write would echo
 * back through the bridge and `replaceEntitySelection([3D-subset])` would DROP the non-3D
 * entities (raw DXF / overlays) from the universal truth. Hydration wraps its store write in
 * {@link withSuppressed3DToUniversalSync} so the load is strictly one-way.
 */
let suppressCount = 0;

/** Run `fn` with the 3D→universal bridge push suppressed (used by cross-mode hydration). */
export function withSuppressed3DToUniversalSync<T>(fn: () => T): T {
  suppressCount++;
  try {
    return fn();
  } finally {
    suppressCount--;
  }
}

export function use3DSelectionUniversalBridge(): void {
  const universal = useUniversalSelectionStable();

  useEffect(() => {
    const sync = (): void => {
      // Only mirror while 3D is the active view. The `BimViewport3D` unmount (returning to 2D)
      // runs `clearSelection()`; by then `toggle2D3D()` has already set mode='2d', so this guard
      // makes that teardown clear a no-op → the universal selection SURVIVES the round-trip (was
      // the ADR-543 «wipe» bug). A genuine in-3D deselect (mode≠'2d') still propagates.
      if (useViewMode3DStore.getState().mode === '2d') return;
      // Suppressed during universal→3D hydration so the load never echoes back (see above).
      if (suppressCount > 0) return;
      const ids = useSelection3DStore.getState().selectedBimIds;
      // BIM level-scene entities live in the universal selection as `dxf-entity`.
      const current = universal.getSelectedEntityIds();
      if (ids.join('|') === current.join('|')) return;
      universal.replaceEntitySelection([...ids]);
    };
    return useSelection3DStore.subscribe(sync);
  }, [universal]);
}
