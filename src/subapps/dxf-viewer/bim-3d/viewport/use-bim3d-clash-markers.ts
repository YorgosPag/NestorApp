'use client';

/**
 * ADR-435 Slice 1b — useBim3DClashMarkers: drives the 3D clash markers + the
 * "zoom to clash" camera focus. Mounted by BimViewport3D alongside the other
 * `use-bim3d-*` hooks.
 *
 * Three responsibilities, all low-frequency (Detect / Clear / a panel click):
 *   1. Own a {@link ClashMarkerOverlay} on the live scene; (re)paint it whenever the
 *      low-freq {@link useClashReport} store changes; empty it on Clear.
 *   2. Keep the markers screen-constant by registering a HIGH-priority subsystem on
 *      the SAME UnifiedFrameScheduler that renders the scene (ADR-040 Phase XXIII).
 *      It runs BEFORE `bim-3d-scene` and ONLY on frames the scene is already dirty
 *      (`isSceneDirty()`), so it adds ZERO extra renders — it just rescales the pins
 *      a hair before they are drawn, exactly like the gizmo overlay.
 *   3. Subscribe the clash-focus bus: a panel row click frames the camera on the
 *      clash point (`viewport.frameBounds`) when the 3D view is active.
 *
 * ADR-040: no high-freq subscription. The only React subscription is the low-freq
 * report store; the per-frame work lives in the scheduler subsystem, not React.
 *
 * @see ../coordination/ClashMarkerOverlay.ts
 * @see ../../systems/coordination/clash-focus-bus.ts
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { ClashMarkerOverlay } from '../coordination/ClashMarkerOverlay';
import { clashPointToWorld } from '../coordination/clash-marker-math';
import { useClashReport, clashReportStore } from '../../systems/coordination/clash-report-store';
import { subscribeClashFocus } from '../../systems/coordination/clash-focus-bus';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../../rendering/core/UnifiedFrameScheduler';

/** Half-size (m) of the box framed around a clash when "zooming to" it. */
const CLASH_FOCUS_HALF_EXTENT_M = 0.6;

export interface UseBim3DClashMarkersParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DClashMarkers({ managerRef, canvasEl }: UseBim3DClashMarkersParams): void {
  const review = useClashReport();
  const overlayRef = useRef<ClashMarkerOverlay | null>(null);

  // ── Lifecycle: overlay + per-frame scaler + focus subscription ──────────────
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const overlay = new ClashMarkerOverlay(manager.scene);
    overlayRef.current = overlay;
    const current = clashReportStore.get();
    if (current) overlay.setClashes(current);
    manager.markSceneDirty();

    // Screen-constant resize — HIGH runs before `bim-3d-scene` (NORMAL), and only on
    // frames the scene already renders, so the pins are rescaled then drawn (no flash,
    // no extra frames).
    const unregisterScaler = UnifiedFrameScheduler.register(
      'bim-3d-clash-markers',
      'BIM 3D Clash Markers',
      RENDER_PRIORITIES.HIGH,
      () => overlay.updateScale(manager.getCamera()),
      () => overlay.hasMarkers() && manager.isSceneDirty(),
    );

    // "Zoom to clash" — frame a small box around the point, only in 3D.
    const unsubFocus = subscribeClashFocus((point) => {
      if (!selectIs3D(useViewMode3DStore.getState())) return;
      const w = clashPointToWorld(point);
      const h = CLASH_FOCUS_HALF_EXTENT_M;
      manager.viewport.frameBounds(
        new THREE.Vector3(w.x - h, w.y - h, w.z - h),
        new THREE.Vector3(w.x + h, w.y + h, w.z + h),
      );
    });

    return () => {
      unsubFocus();
      unregisterScaler();
      overlay.dispose();
      overlayRef.current = null;
      manager.markSceneDirty();
    };
  }, [canvasEl, managerRef]);

  // ── Repaint on report change (Detect → markers, Clear → empty) ──────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (review) overlay.setClashes(review);
    else overlay.clear();
    managerRef.current?.markSceneDirty();
  }, [review, managerRef]);
}
