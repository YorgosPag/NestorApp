"use client";

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { FloorVisMode, FloorPreset } from '../utils/floor-visibility-state';
import { applyPreset, sortLevelsTopDown } from '../utils/floor-visibility-state';
import type { Level } from '../../systems/levels/config';
import { LIGHT_PRESETS, DEFAULT_PRESET, type LightPresetId } from '../lighting/lighting-presets';
import type { ReducedMotionOverride } from '../accessibility/use-reduced-motion';

enableMapSet();

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

/**
 * 3D floor source scope (ADR-399 Phase B):
 * - 'single' → render only the active level (default, legacy behaviour).
 * - 'all'    → render every floor of the building stacked by elevation
 *              (the "Όλοι οι όροφοι" tab). Drives `BimSceneLayer.syncMultiFloor`.
 */
export type Floor3DScope = 'single' | 'all';

export type RenderPreset = 'draft' | 'standard' | 'high' | 'production';
export type RenderFormat = 'png' | 'jpg' | 'exr';
export type RenderResolutionPreset = 'hd' | '4k' | '8k' | 'custom';

export interface CropRegionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FinalRenderConfig {
  preset: RenderPreset;
  presetSPP: 64 | 256 | 1024 | 4096;
  resolutionPreset: RenderResolutionPreset;
  resolutionW: number;
  resolutionH: number;
  format: RenderFormat;
  destDisk: boolean;
  destProject: boolean;
  denoiseEnabled: boolean;
  /** Optional crop region (ADR-366 §C.6.Q5). Coordinates normalized 0-1. */
  cropRegion?: {
    enabled: boolean;
    rectangle: CropRegionRect;
    depthRange?: { near: number; far: number };
  };
}

export const PRESET_SPP: Record<RenderPreset, 64 | 256 | 1024 | 4096> = {
  draft: 64,
  standard: 256,
  high: 1024,
  production: 4096,
};

export const RESOLUTION_PRESETS: Record<Exclude<RenderResolutionPreset, 'custom'>, { w: number; h: number }> = {
  hd: { w: 1920, h: 1080 },
  '4k': { w: 3840, h: 2160 },
  '8k': { w: 7680, h: 4320 },
};

interface ViewMode3DState {
  /** Current render mode (FSM) */
  mode: ViewMode3D;
  /** True during mode transitions (for loading states) */
  isTransitioning: boolean;
  /** Whether ARIA live-region announcements are active (ADR-366 Phase 9 / C.5.Q1). */
  announcementsEnabled: boolean;
  /** Reduced-motion override (ADR-366 Phase 9 / C.5.Q5). Default: 'auto' (follow OS). */
  accessibilityReducedMotion: ReducedMotionOverride;
  /** Entity keyboard navigation order (ADR-366 Phase 9 / C.5.Q3). */
  accessibilityEntityNavOrder: 'spatial' | 'semantic';
  /** Active final render config (null = no render in progress / dialog closed) */
  finalRenderConfig: FinalRenderConfig | null;
  /** Render progress 0-100; -1 = idle */
  finalRenderProgress: number;
  /**
   * Floor IDs to render (ADR-366 §9 Q2):
   * Default = {activeFloorId}. "Show All" sets this to all floor IDs.
   */
  visibleFloors: ReadonlySet<string>;
  /** Whether "Show All Floors" is active */
  showAllFloors: boolean;
  /** ADR-399 Phase B — 3D floor source scope ('single' active level | 'all' stacked). */
  floor3DScope: Floor3DScope;
  /** Per-level visibility mode (B.3): 'show' | 'ghost' | 'hide'. */
  floorVisibilityModes: ReadonlyMap<string, FloorVisMode>;
  /** Active lighting preset (B.1 Phase 5A) */
  sunPreset: LightPresetId;
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  sunAnimating: boolean;
  solarDate: Date;
  solarLatDeg: number;
  solarLngDeg: number;
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
  /** Start a final render with the given config */
  startFinalRender(config: FinalRenderConfig): void;
  /** Called by PathTracerRenderer when render completes */
  completeFinalRender(): void;
  /** Update progress 0-100 during final render */
  updateFinalRenderProgress(pct: number): void;
  /** Set visible floors (Q2). Replaces current set. */
  setVisibleFloors(floorIds: ReadonlySet<string>): void;
  /** Toggle "Show All Floors" (Q2) */
  toggleShowAllFloors(): void;
  /** ADR-399 Phase B — set the 3D floor source scope ('single' | 'all'). */
  setFloor3DScope(scope: Floor3DScope): void;
  /** Seed initial floor when project loads */
  setActiveFloor(floorId: string | null): void;
  /** Set show/ghost/hide for a single level (B.3). */
  setFloorMode(levelId: string, mode: FloorVisMode): void;
  /** Apply a preset to all levels (B.3). */
  applyFloorsPreset(levels: Level[], preset: FloorPreset, activeLevelId: string | null): void;
  /** Set lighting preset + update sun angles (B.1 Phase 5A) */
  setLightPreset(preset: LightPresetId): void;
  /** Set custom sun position (clears preset highlight) */
  setSunPosition(azDeg: number, elDeg: number): void;
  /** Update solar calculator config */
  setSolarConfig(date: Date, latDeg: number, lngDeg: number): void;
  toggleSunAnimating(): void;
  setAnnouncementsEnabled(enabled: boolean): void;
  setAccessibilityReducedMotion(v: ReducedMotionOverride): void;
  setAccessibilityEntityNavOrder(v: 'spatial' | 'semantic'): void;
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
        announcementsEnabled: true,
        accessibilityReducedMotion: 'auto' as ReducedMotionOverride,
        accessibilityEntityNavOrder: 'spatial' as const,
        finalRenderConfig: null,
        finalRenderProgress: -1,
        visibleFloors: new Set<string>(),
        showAllFloors: false,
        floor3DScope: 'single' as Floor3DScope,
        floorVisibilityModes: new Map<string, FloorVisMode>(),
        sunPreset: DEFAULT_PRESET,
        sunAzimuthDeg: LIGHT_PRESETS[DEFAULT_PRESET].azimuthDeg,
        sunElevationDeg: LIGHT_PRESETS[DEFAULT_PRESET].elevationDeg,
        sunAnimating: false,
        solarDate: new Date(),
        solarLatDeg: 37.97,
        solarLngDeg: 23.73,

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

        startFinalRender(config) {
          set((draft) => {
            if (draft.mode === '3d-final') return;
            draft.finalRenderConfig = config;
            draft.finalRenderProgress = 0;
            draft.mode = '3d-final';
            draft.isTransitioning = false;
          });
        },

        completeFinalRender() {
          set((draft) => {
            draft.finalRenderConfig = null;
            draft.finalRenderProgress = -1;
            draft.mode = '3d-raster';
            draft.isTransitioning = false;
          });
        },

        updateFinalRenderProgress(pct) {
          set((draft) => {
            draft.finalRenderProgress = pct;
          });
        },

        setVisibleFloors(floorIds) {
          set((draft) => {
            draft.visibleFloors = new Set(floorIds);
          });
        },

        toggleShowAllFloors() {
          set((draft) => {
            draft.showAllFloors = !draft.showAllFloors;
          });
        },

        setFloor3DScope(scope) {
          set((draft) => {
            draft.floor3DScope = scope;
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
            draft.floorVisibilityModes.set(levelId, mode);
          });
        },

        applyFloorsPreset(levels, preset, activeLevelId) {
          set((draft) => {
            const sorted = sortLevelsTopDown(levels);
            draft.floorVisibilityModes = applyPreset(sorted, preset, activeLevelId, draft.floorVisibilityModes);
          });
        },

        setLightPreset(preset) {
          set((draft) => {
            draft.sunPreset = preset;
            draft.sunAzimuthDeg = LIGHT_PRESETS[preset].azimuthDeg;
            draft.sunElevationDeg = LIGHT_PRESETS[preset].elevationDeg;
            draft.sunAnimating = false;
          });
        },

        setSunPosition(azDeg, elDeg) {
          set((draft) => {
            draft.sunAzimuthDeg = azDeg;
            draft.sunElevationDeg = elDeg;
          });
        },

        setSolarConfig(date, latDeg, lngDeg) {
          set((draft) => {
            draft.solarDate = date;
            draft.solarLatDeg = latDeg;
            draft.solarLngDeg = lngDeg;
          });
        },

        toggleSunAnimating() {
          set((draft) => {
            draft.sunAnimating = !draft.sunAnimating;
          });
        },

        setAnnouncementsEnabled(enabled) {
          set((draft) => {
            draft.announcementsEnabled = enabled;
          });
        },

        setAccessibilityReducedMotion(v) {
          set((draft) => {
            draft.accessibilityReducedMotion = v;
          });
        },

        setAccessibilityEntityNavOrder(v) {
          set((draft) => {
            draft.accessibilityEntityNavOrder = v;
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
export const selectFloor3DScope = (s: ViewMode3DState) => s.floor3DScope;
