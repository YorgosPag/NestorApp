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
import { useUniversalSelection } from '../../../systems/selection/SelectionSystem';

export function use3DSelectionUniversalBridge(): void {
  const universal = useUniversalSelection();

  useEffect(() => {
    const sync = (): void => {
      const ids = useSelection3DStore.getState().selectedBimIds;
      // BIM level-scene entities live in the universal selection as `dxf-entity`.
      const current = universal.getSelectedEntityIds();
      if (ids.join('|') === current.join('|')) return;
      universal.replaceEntitySelection([...ids]);
    };
    return useSelection3DStore.subscribe(sync);
  }, [universal]);
}
