'use client';

/**
 * ADR-364 §10.13 — 3D Escape Registrations (Φ2 Μηχανισμός 4)
 *
 * The 3D twin of `hooks/canvas/useCanvasEscapeRegistrations.ts`: one SSoT module that wires
 * every 3D-viewport ESC consumer into the centralized EscapeCommandBus with the correct
 * priority. Before this module, all four rungs lived as `event.code === 'Escape'` branches
 * inside `shortcut-dispatcher.ts` (Ζώνη Α), invisible to the bus and to the ADR-364 audit.
 *
 * The ladder (Revit «Modify» parity — Esc backs out ONE context per press):
 *
 *   P420 EDIT_GIZMO_3D      → tear the move/rotate gizmo down, KEEP the selection
 *   P415 STAIR_SUB_EXIT     → step out of a tread/riser back to the whole stair
 *   P410 SELECTION_3D_CLEAR → clear the 3D selection (cascades to universal via the bridge)
 *   P150 FOCUS_CLEAR        → clear the keyboard focus ring (exact twin of `use2DKeyboardFocus`)
 *
 * ⚠️ The three new rungs sit ABOVE the 2D composite deselect at `DRAFT_POLYGON` (400), NOT in
 * the 250-300 band. `BimViewport3D` mounts as a leaf INSIDE `CanvasLayerStack`, so the 2D
 * `canvas/fallback-deselect` is live during 3D as well — and since the gizmo is
 * auto-on-selection, a selection always exists while it is up, making that composite always
 * claim first. A rung below 400 would never execute. See `escape-priority.ts` for the full
 * derivation and ADR-364 §10.13 for the measurement.
 *
 * Every gate reads its store at EVENT time via `getState()` — never a React snapshot — so the
 * ladder reflects live state (ADR-040 invariant, mirroring `use-bim3d-marquee-handlers.ts`).
 *
 * The editable-focus guard is NOT repeated here: the bus already skips handlers without
 * `allowWhenEditable` while an INPUT/TEXTAREA/contenteditable holds focus (ADR-364 §3.4),
 * which is exactly what the dispatcher's `isTypingInFormField()` check did. One owner.
 */

import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useStairSubElementSelectionStore } from '../../bim/stairs/stair-sub-element-selection-store';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

export interface Use3DEscapeRegistrationsConfig {
  /** Live manager getter — null while the 3D viewport is unmounted. */
  readonly getManager: () => ThreeJsSceneManager | null;
  /** Outer mount gate, mirroring `use3DShortcuts` (hook still registers, gates no-op). */
  readonly active: boolean;
}

export function use3DEscapeRegistrations({ getManager, active }: Use3DEscapeRegistrationsConfig): void {
  // Shared gate: every rung below is 3D-only, so in 2D the existing 2D chain is untouched.
  const in3D = (): boolean => active && useViewMode3DStore.getState().mode !== '2d';

  // P420 — tear the gizmo down, leave the selection alone so the NEXT press deselects.
  useEscapeHandler({
    id: 'bim3d/edit-gizmo-teardown',
    priority: ESC_PRIORITY.EDIT_GIZMO_3D,
    canHandle: () => in3D() && useBim3DEditStore.getState().editToolActive,
    handle: () => { useBim3DEditStore.getState().deactivate(); return true; },
  });

  // P415 — step OUT of the drilled-into stair sub-element (ADR-358 Q19).
  // Legacy parity: the dispatcher ran `dispatchEditKeys` BEFORE `dispatchStairSubKeys`,
  // so the gizmo rung must stay above this one (420 > 415).
  useEscapeHandler({
    id: 'bim3d/stair-sub-exit',
    priority: ESC_PRIORITY.STAIR_SUB_EXIT,
    canHandle: () => in3D() && useStairSubElementSelectionStore.getState().selected !== null,
    handle: () => { useStairSubElementSelectionStore.getState().clear(); return true; },
  });

  // P410 — the rung that was MISSING entirely (ADR-364 §10.11.Ε.2): nothing cleared the 3D
  // selection on ESC, so after the gizmo closed the element stayed selected forever.
  //
  // Goes through `manager.selectBimEntity(null)` — the CANONICAL clear — and never through
  // `Selection3DStore.clearSelection()` directly. A 3D selection change is THREE coupled
  // effects, not one store write: (1) the store, (2) `selectionHighlighter.onClear()`, and
  // (3) `markSceneDirty()`. Every other mutator (`applyBimSelection`,
  // `applyBimMarqueeSelection`, the cross-mode hydration) performs all three together.
  //
  // ⚠️ Μετρημένο ζωντανά 2026-07-25: μια πρώτη εκδοχή αυτού του slot καλούσε σκέτο
  // `clearSelection()`. Το store ΚΑΘΑΡΙΖΕ σωστά — ribbon tab και panel έφευγαν — αλλά το
  // πορτοκαλί περίγραμμα ΕΜΕΝΕ στην οθόνη μέχρι το επόμενο τυχαίο render (επιβεβαιώθηκε με
  // τον δείκτη μακριά: δεν ήταν hover· ένα μικρό orbit το έσβηνε). Το ESC οφείλει να δείχνει
  // το αποτέλεσμά του ΑΜΕΣΩΣ.
  //
  // Η universal πλευρά ακολουθεί μόνη της μέσω της υπάρχουσας μονόδρομης γέφυρας
  // (`use-3d-selection-universal-bridge`, 3D → universal). Η αντίστροφη καλωδίωση δεν
  // υπάρχει — γι' αυτό ακριβώς ο 2D σύνθετος αποεπιλογέας στο 400 άφηνε το 3D store μπαγιάτικο
  // (και γι' αυτό το `useSmartDelete` αναγκαζόταν να καθαρίζει και τα δύο με το χέρι).
  useEscapeHandler({
    id: 'bim3d/selection-clear',
    priority: ESC_PRIORITY.SELECTION_3D_CLEAR,
    canHandle: () => in3D() && useSelection3DStore.getState().selectedBimIds.length > 0,
    handle: () => {
      const manager = getManager();
      // Χωρίς manager δεν υπάρχει σκηνή να ξαναζωγραφιστεί· το store πρέπει πάντως να αδειάσει
      // ώστε να μη μείνει φάντασμα επιλογής αν το 3D ξαναμπεί.
      if (manager) manager.selectBimEntity(null);
      else useSelection3DStore.getState().clearSelection();
      return true;
    },
  });

  // P150 — keyboard focus ring. Exact twin of `use2DKeyboardFocus`'s FOCUS_CLEAR rung.
  //
  // Previously the 3D side routed this through the shortcut registry entry
  // `focusClear: { key: 'Escape' }`, whose dispatcher branch returned HANDLED
  // UNCONDITIONALLY — an ungated consumer of every ESC in 3D, structurally the same defect
  // as the COLOR_MENU root cause of ADR-364 §10.12. Gated here on «is there actually a
  // focus ring?», so it claims only when it has work to do.
  useEscapeHandler({
    id: 'bim3d/focus-clear',
    priority: ESC_PRIORITY.FOCUS_CLEAR,
    canHandle: () => in3D() && (getManager()?.getKeyboardFocusManager().getFocused() ?? null) !== null,
    handle: () => { getManager()?.clearKeyboardFocus(); return true; },
  });
}
