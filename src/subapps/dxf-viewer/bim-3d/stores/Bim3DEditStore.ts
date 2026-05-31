/**
 * Bim3DEditStore — micro-store for the 3D viewport BIM element edit gizmos.
 *
 * ADR-402 Phase 1, Sub-Phase 2 (Move gizmo). Holds the small amount of UI state
 * that the move/rotate gizmos need: which element is being edited, which level it
 * lives on, the active edit mode, and the current axis lock. Zero high-frequency
 * data — pointer positions stay inside the (non-React) drag controller.
 *
 * ADR-040 micro-leaf: a tiny `subscribeWithSelector` store read by the edit
 * interaction hook + the gizmo renderer; orchestrators never subscribe to it.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/** Floor-plane axis lock. `null` = free move on the floor plane. (No Y — vertical edits use the height grip, Sub-Phase 4.) */
export type Bim3DAxisLock = 'X' | 'Z' | null;

/** Active edit gizmo. `move` ships in Sub-Phase 2; `rotate` reserved for Sub-Phase 3. */
export type Bim3DEditMode = 'move' | 'rotate' | null;

interface Bim3DEditState {
  /** True while a gizmo is mounted on an element (G/R toggled on). */
  editToolActive: boolean;
  editMode: Bim3DEditMode;
  /**
   * bimIds of the elements under edit (the gizmo anchors on their union centroid).
   * ADR-402 Phase C — widened single→multi. [0] = primary.
   */
  editEntityIds: string[];
  /** Derived (compat): primary edited id = editEntityIds[0] ?? null. */
  editEntityId: string | null;
  /** Primary type when a single element is edited; `null` for multi (hides resize handles). */
  editBimType: string | null;
  /** Level the edited element lives on — resolved lazily; null = use currentLevelId. */
  targetLevelId: string | null;
  axisLock: Bim3DAxisLock;
}

interface Bim3DEditActions {
  /**
   * Mount the move gizmo on one or more elements. Resets any axis lock.
   * `bimType` is the primary type for a single element, or `null` for multi.
   */
  activateMove(entityIds: string[], bimType: string | null): void;
  /** Tear the gizmo down (Escape / G-toggle-off / deselection). */
  deactivate(): void;
  /** Record the resolved level for the active edit target (multi-floor edge case). */
  setTargetLevel(levelId: string | null): void;
  /** Toggle an axis lock — clicking the active axis again clears it. */
  toggleAxisLock(axis: 'X' | 'Z'): void;
  setAxisLock(axis: Bim3DAxisLock): void;
}

type Bim3DEditStoreType = Bim3DEditState & Bim3DEditActions;

export const useBim3DEditStore = create<Bim3DEditStoreType>()(
  subscribeWithSelector((set) => ({
    editToolActive: false,
    editMode: null,
    editEntityIds: [],
    editEntityId: null,
    editBimType: null,
    targetLevelId: null,
    axisLock: null,

    activateMove: (entityIds, bimType) =>
      set({
        editToolActive: true,
        editMode: 'move',
        editEntityIds: entityIds,
        editEntityId: entityIds[0] ?? null,
        editBimType: bimType,
        targetLevelId: null,
        axisLock: null,
      }),

    deactivate: () =>
      set({
        editToolActive: false,
        editMode: null,
        editEntityIds: [],
        editEntityId: null,
        editBimType: null,
        targetLevelId: null,
        axisLock: null,
      }),

    setTargetLevel: (levelId) => set({ targetLevelId: levelId }),

    toggleAxisLock: (axis) =>
      set((s) => ({ axisLock: s.axisLock === axis ? null : axis })),

    setAxisLock: (axisLock) => set({ axisLock }),
  })),
);

// Selectors (stable references for subscribeWithSelector consumers).
export const selectEditToolActive = (s: Bim3DEditStoreType): boolean => s.editToolActive;
/**
 * Membership key for the whole edit set — fires when the *set* changes, not just
 * the primary [0]. Needed so adding a 2nd element re-anchors the gizmo on the
 * group centroid (the primary id may stay identical). ADR-402 Phase C.
 */
export const selectEditEntityKey = (s: Bim3DEditStoreType): string => s.editEntityIds.join('|');
