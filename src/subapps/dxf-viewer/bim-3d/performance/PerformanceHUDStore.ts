/**
 * PerformanceHUDStore — ADR-366 §B.5
 *
 * Zustand store (subscribeWithSelector) for the 3D Performance HUD overlay.
 * - Default: enabled=false, expanded=true (localStorage-persisted)
 * - Updated every 250ms by PerformanceCollector (when enabled)
 * - Consumed by PerformanceHUD (ADR-040 micro-leaf, 1 useSyncExternalStore)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Bim3dRenderMode } from './per-mode-promotion';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PerformanceMetricsSnapshot {
  fps: number;
  frameTimeMs: number;
  triangles: number;
  vertices: number;
  drawCalls: number;
  objectsVisible: number;
  objectsTotal: number;
  gpuMemoryMb: number;
  /** Chrome-only (performance.memory API). null on other browsers. */
  cpuMemoryMb: number | null;
  /** Path-tracer only. null in raster / preview modes. */
  samplesPerSec: number | null;
}

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_ENABLED              = 'bim3d.performanceHud.enabled';
const LS_EXPANDED             = 'bim3d.performanceHud.expanded';
const LS_REGRESSION_ALERTS    = 'bim3d.performanceHud.regressionAlertsEnabled';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  } catch {
    return fallback;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PerformanceHUDState {
  enabled: boolean;
  expanded: boolean;
  regressionAlertsEnabled: boolean;
  metrics: PerformanceMetricsSnapshot | null;
  renderMode: Bim3dRenderMode;
}

interface PerformanceHUDActions {
  setEnabled(v: boolean): void;
  toggleExpanded(): void;
  setRegressionAlertsEnabled(v: boolean): void;
  updateMetrics(snapshot: PerformanceMetricsSnapshot): void;
  setRenderMode(mode: Bim3dRenderMode): void;
}

type PerformanceHUDStoreType = PerformanceHUDState & PerformanceHUDActions;

export const usePerformanceHUDStore = create<PerformanceHUDStoreType>()(
  subscribeWithSelector((set) => ({
    enabled:                  readBool(LS_ENABLED, false),
    expanded:                 readBool(LS_EXPANDED, true),
    regressionAlertsEnabled:  readBool(LS_REGRESSION_ALERTS, true),
    metrics:                  null,
    renderMode:               '3d-raster',

    setEnabled: (v) => {
      try { localStorage.setItem(LS_ENABLED, String(v)); } catch { /* SSR / private browsing */ }
      set({ enabled: v });
    },

    toggleExpanded: () =>
      set((state) => {
        const next = !state.expanded;
        try { localStorage.setItem(LS_EXPANDED, String(next)); } catch { /* ignore */ }
        return { expanded: next };
      }),

    setRegressionAlertsEnabled: (v) => {
      try { localStorage.setItem(LS_REGRESSION_ALERTS, String(v)); } catch { /* ignore */ }
      set({ regressionAlertsEnabled: v });
    },

    updateMetrics: (snapshot) => set({ metrics: snapshot }),

    setRenderMode: (mode) => set({ renderMode: mode }),
  })),
);
