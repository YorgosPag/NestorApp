/**
 * ADR-404 Phase 5b — Wall tool bridge store (drawing-mode ↔ ribbon).
 *
 * Pattern mirror του `column-tool-bridge-store.ts` (ADR-363 Phase 8D), αλλά
 * **minimal**: ο τοίχος είναι 1-DOF και δεν χρειάζεται 2-κλικ slant placement
 * (όπως η κολώνα). Το μόνο που εκθέτει ο τοίχος στο drawing-mode ribbon είναι τα
 * `overrides` (για να διαβαστεί/γραφτεί το `tilt`) ώστε ο επόμενος τοίχος να
 * **γεννιέται ήδη κεκλιμένος** (`buildDefaultWallParams` εφαρμόζει `overrides.tilt`).
 *
 * Why module store instead of context (ίδιο σκεπτικό με την κολώνα):
 *   - `useWallTool` ζει στο `CanvasSection` (via `useSpecialTools`).
 *   - `useRibbonWallBridge` ζει στο `DxfViewerContent` (via `useDxfBimBridges`).
 *   - Sibling subtrees — shared context θα απαιτούσε intrusive lift-up (ADR-040).
 *
 * Single writer (useWallTool effect) → multi reader (bridge callbacks).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 5b
 */

import type { WallParamOverrides } from '../../../../hooks/drawing/wall-completion';

/**
 * Snapshot του user-editable state του wall tool που χρειάζεται το ribbon για να
 * διαβάσει (combobox state) και να γράψει (setter) την κλίση στο drawing mode.
 */
export interface WallToolBridgeHandle {
  readonly isActive: boolean;
  readonly overrides: WallParamOverrides;
  setParamOverrides(overrides: WallParamOverrides): void;
}

type Listener = () => void;

let handle: WallToolBridgeHandle | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

export const wallToolBridgeStore = {
  /**
   * Writer — καλείται από το `useWallTool` effect σε κάθε render όπου το state ή
   * ο setter αλλάζει identity. Αντικαθιστά το προηγούμενο published handle.
   */
  set(next: WallToolBridgeHandle | null): void {
    if (next === handle) return;
    handle = next;
    emit();
  },
  get(): WallToolBridgeHandle | null {
    return handle;
  },
  /** Low-level subscribe (για όποιον reader χρειαστεί reactivity· ο bridge διαβάζει με get). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
