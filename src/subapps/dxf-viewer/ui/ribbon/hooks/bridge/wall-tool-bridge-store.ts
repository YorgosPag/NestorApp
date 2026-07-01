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

import type { WallParamOverrides, SceneUnits } from '../../../../hooks/drawing/wall-completion';
import type { Entity } from '../../../../types/entities';

/**
 * Snapshot του user-editable state του wall tool που χρειάζεται το ribbon για να
 * διαβάσει (combobox state) και να γράψει (setter) την κλίση στο drawing mode.
 */
export interface WallToolBridgeHandle {
  readonly isActive: boolean;
  /**
   * Β (Giorgio 2026-07-01) — `true` όταν ο σκέτος «Τοίχος» (ευθύς/ορθογώνιος,
   * freehand) περιμένει το 1ο κλικ, οπότε ένα κλικ μέσα σε εντοπισμένο DXF
   * παραλληλόγραμμο θα γεμίσει τοίχο. Το `useRegionPerimeterMouseMove` το διαβάζει
   * imperative ώστε η διακεκομμένη hover preview να εμφανίζεται μόνο όταν όντως θα
   * γεμίσει (preview ≡ commit). `false` σε idle / awaitingEnd / curved / polyline.
   */
  readonly isRegionFillEligible: boolean;
  readonly overrides: WallParamOverrides;
  setParamOverrides(overrides: WallParamOverrides): void;
  /**
   * ADR-543 — active scene units, so the 3D wall placement bridge
   * (`use-bim3d-wall-placement`) can convert the raycast floor point (DXF plan mm)
   * to the SAME scene units the 2D `onCanvasClick` expects (mirror of
   * `columnToolBridgeStore.getSceneUnits`). The round-trip cannot disagree on units.
   */
  getSceneUnits(): SceneUnits;
  /**
   * ADR-543 (COL traces 3D) — active-floor scene entities, so the 3D wall placement
   * hook (`use-bim3d-wall-placement`) can feed the SAME `collectAmbientAlignmentAnchors`
   * the 2D `drawing-hover-handler` uses for ambient (Revit-style) alignment traces. The
   * SSoT source: the `useWallTool` `getSceneEntities` prop (current-level scene), so 2D
   * and 3D align to the identical member set.
   */
  getSceneEntities(): readonly Entity[];
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
