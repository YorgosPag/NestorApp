'use client';

/**
 * usePerformanceModeBridge — ADR-366 §B.5.U (unified 2D + 3D Performance HUD)
 *
 * Bridges ViewMode3DStore.mode → the unified Performance HUD:
 *  - mirrors the active viewport mode into PerformanceHUDStore.renderMode (so the
 *    HUD shows the right label + per-mode metric emphasis), and
 *  - starts/stops the 2D collector so exactly ONE source feeds the shared store
 *    at a time. The 3D collector is owned by ThreeJsSceneManager and is already
 *    gated to 3D by its own lifecycle, so the bridge only drives the 2D one.
 *
 * Single-writer invariant (triple-gated): 3D collector exists only in 3D + the
 * 2D collector's own `mode === '2d'` tick gate + this bridge stops it on 3D entry.
 *
 * Mounted once by UnifiedPerformanceHudLeaf. Subscribes only to the low-freq
 * `mode` selector → ADR-040 safe (mode changes are user-initiated, not per-frame).
 */

import { useEffect, useRef } from 'react';
import { useViewMode3DStore, selectViewMode, type ViewMode3D } from '../stores/ViewMode3DStore';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { Performance2DCollector } from './Performance2DCollector';

/** Subscribes to the active viewport mode, drives the 2D collector, and returns the current mode. */
export function usePerformanceModeBridge(): ViewMode3D {
  const mode = useViewMode3DStore(selectViewMode);
  const collectorRef = useRef<Performance2DCollector | null>(null);

  // Lazy-construct the 2D collector once; dispose on unmount.
  useEffect(() => {
    collectorRef.current = new Performance2DCollector();
    return () => {
      collectorRef.current?.dispose();
      collectorRef.current = null;
    };
  }, []);

  // Mirror mode into the HUD store + drive the 2D collector lifecycle.
  useEffect(() => {
    usePerformanceHUDStore.getState().setRenderMode(mode);
    const collector = collectorRef.current;
    if (!collector) return;
    if (mode === '2d') collector.start();
    else collector.stop();
  }, [mode]);

  return mode;
}
