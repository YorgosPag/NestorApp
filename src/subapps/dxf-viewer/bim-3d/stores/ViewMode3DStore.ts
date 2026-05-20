"use client";

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { FloorVisMode, FloorPreset } from '../utils/floor-visibility-state';
import { applyPreset, sortLevelsTopDown } from '../utils/floor-visibility-state';
import type { Level } from '../../systems/levels/config';

export type { FloorVisMode };

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Render mode FSM (ADR-366 §9 Q3):
 * - '2d'         → standard 2D DXF canvas (default)
 * - '3d-raster'  → Three.js WebGL real-time (user-toggled)
 * - '3d-preview' → path-trace preview, auto-on-idle ≥800ms (Phase 5)
 * - '3d-final'   → explicit render dialog (Phase 6)
 */
export type ViewMode3D = '2d' | '3d-raster' | '3d-preview' | '3d-final';

interface ViewMode3DState {
  /** Current render mode (FSM) */
  mode: ViewMode3D;
  /** True during mode transitions (for loading states) */
  isTransitioning: boolean;
  /**
   * Floor IDs to render (ADR-366 §9 Q2):
   * Default = {activeFloorId}. "Show All" sets this to all floor IDs.
   */
  visibleFloors: ReadonlySet<string>;
  /** Whether "Show All Floors" is active */
  showAllFloors: boolean;
  /** Per-level visibility mode (B.3): 'show' | 'ghost' | 'hide'. */
  floorVisibilityModes: ReadonlyMap<string, FloorVisMode>;
}

interface ViewMode3DActions {
  /** Toggle between '2d' ↔ '3d-raster' */
  toggle2D3D(): void;
  /** Transition to '3d-raster' mode */
  enterRasterMode(): void;
  /** Transition to '3d-preview' mode (IdleDetector trigger — Phase 5) */
  enterPreviewMode(): void;
  /** Transition to '3d-final' mode (explicit Render dialog — Phase 6) */
  enterFinalMode(): void;
  /** Set visible floors (Q2). Replaces current set. */
  setVisibleFloors(floorIds: ReadonlySet<string>): void;
  /** Toggle "Show All Floors" (Q2) */
  toggleShowAllFloors(): void;
  /** Seed initial floor when project loads */
  setActiveFloor(floorId: string | null): void;
  /** Set show/ghost/hide for a single level (B.3). */
  setFloorMode(levelId: string, mode: FloorVisMode): void;
  /** Apply a preset to all levels (B.3). */
  applyFloorsPreset(levels: Level[], preset: FloorPreset, activeLevelId: string | null): void;
}

type ViewMode3DStoreType = ViewMode3DState & ViewMode3DActions;

// ── Store ─────────────────────────────────────────────────────────────────────

export const useViewMode3DStore = create<ViewMode3DStoreType>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // ── Initial state ─────────────────────────────────────────────────────
        mode: '2d',
        isTransitioning: false,
        visibleFloors: new Set<string>(),
        showAllFloors: false,
        floorVisibilityModes: new Map<string, FloorVisMode>(),

        // ── Actions ───────────────────────────────────────────────────────────

        toggle2D3D() {
          set((draft) => {
            draft.mode = draft.mode === '2d' ? '3d-raster' : '2d';
            draft.isTransitioning = false;
          });
        },

        enterRasterMode() {
          set((draft) => {
            draft.mode = '3d-raster';
            draft.isTransitioning = false;
          });
        },

        enterPreviewMode() {
          set((draft) => {
            if (draft.mode === '3d-raster') {
              draft.mode = '3d-preview';
              draft.isTransitioning = false;
            }
          });
        },

        enterFinalMode() {
          set((draft) => {
            if (draft.mode === '3d-preview' || draft.mode === '3d-raster') {
              draft.mode = '3d-final';
              draft.isTransitioning = false;
            }
          });
        },

        setVisibleFloors(floorIds) {
          set((draft) => {
            draft.visibleFloors = floorIds;
          });
        },

        toggleShowAllFloors() {
          set((draft) => {
            draft.showAllFloors = !draft.showAllFloors;
          });
        },

        setActiveFloor(floorId) {
          set((draft) => {
            if (!get().showAllFloors && floorId) {
              draft.visibleFloors = new Set([floorId]);
            }
          });
        },

        setFloorMode(levelId, mode) {
          set((draft) => {
            const next = new Map(draft.floorVisibilityModes);
            next.set(levelId, mode);
            draft.floorVisibilityModes = next;
          });
        },

        applyFloorsPreset(levels, preset, activeLevelId) {
          set((draft) => {
            const sorted = sortLevelsTopDown(levels);
            draft.floorVisibilityModes = applyPreset(sorted, preset, activeLevelId, draft.floorVisibilityModes);
          });
        },
      }))
    ),
    { name: 'ViewMode3DStore' }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectIs3D = (s: ViewMode3DState) => s.mode !== '2d';
export const selectViewMode = (s: ViewMode3DState) => s.mode;
export const selectVisibleFloors = (s: ViewMode3DState) => s.visibleFloors;
