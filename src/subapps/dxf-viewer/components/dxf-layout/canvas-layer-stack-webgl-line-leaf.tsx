/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * ADR-639 Στάδιο 5 — WebGL line-layer micro-leaf (STEP 10).
 *
 * The thin React boundary for the GPU line layer — a faithful mirror of
 * `BimViewport3D`'s hybrid pattern: a pure imperative manager
 * (`WebglLineLayerManager`) driven by the ONE `UnifiedFrameScheduler`, wrapped in a
 * leaf that owns only lifecycle + LOW-frequency subscriptions. Per ADR-040:
 *   • Rule 1/4 — this leaf holds ZERO high-frequency `useSyncExternalStore`. The
 *     transform is read imperatively inside the scheduler tick (event-time getter),
 *     never as a React prop, so pan/zoom never re-renders React.
 *   • The only subscriptions here are LOW-freq: the level scene (one ref change per
 *     mutation), device-pixel-ratio, and the content-invalidation SSoT.
 *   • Scheduler discipline — register a NORMAL-priority callback and UNREGISTER it
 *     BEFORE `manager.dispose()` so no in-flight tick races teardown
 *     (mirror `BimViewport3D.tsx:207-213`).
 *
 * Large-scene gate (ADR-639 fallback #1): the layer engages only when the scene has
 * at least `WEBGL_LINE_LAYER_MIN_ENTITIES` entities. Below it, no GPU buffers are
 * built and the store flag stays false → the Canvas2D `DxfRenderer` strokes every
 * line exactly as today (byte-identical, zero WebGL cost).
 *
 * @see canvas-v2/webgl-lines/WebglLineLayerManager.ts — the imperative manager
 * @see components/dxf-layout/canvas-layer-stack-leaves.tsx — DxfCanvasSubscriber (mirrored)
 * @see bim-3d/viewport/BimViewport3D.tsx:207-213 — unregister-before-dispose
 */

'use client';
import React, { useEffect, useRef } from 'react';
import { WebglLineLayerManager } from '../../canvas-v2/webgl-lines/WebglLineLayerManager';
import {
  WEBGL_LINE_CANVAS_SYSTEM_ID,
  setWebglLineLayerActive,
} from '../../canvas-v2/webgl-lines/webgl-line-layer-store';
import { subscribeContentInvalidation } from '../../canvas-v2/webgl-lines/webgl-line-content-invalidation';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering/core/frame-scheduler-api';
import { subscribeDevicePixelRatio } from '../../systems/cursor/device-pixel-ratio';
import { useReactiveLevelScene } from '../../systems/scene/useReactiveLevelScene';
import { DXF_IMPORT_THRESHOLDS } from '../../config/dxf-import-thresholds';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/scene';

interface WebglLineLayerSubscriberProps {
  /** Orchestrator-provided scene (first-paint fallback before the store has the level). */
  scene: DxfScene | null;
  /** Active level id — drives the live scene subscription. */
  sceneLevelId: string | null;
  /** Shared SceneModel → DxfScene converter (WeakMap-cached — same ref as DxfCanvasSubscriber). */
  convertScene: (scene: SceneModel | null, activeGroupId?: string | null) => DxfScene;
  /** Positioning + z-tier for the layer div (between the grid/floorplan z0 and DxfCanvas z10). */
  className?: string;
}

/**
 * Micro-leaf that mounts + drives the WebGL line layer. Renders ONE positioned div;
 * the manager appends its own `<canvas>` into it. Nothing here re-renders on pan/zoom.
 */
export const WebglLineLayerSubscriber = React.memo(function WebglLineLayerSubscriber({
  scene,
  sceneLevelId,
  convertScene,
  className,
}: WebglLineLayerSubscriberProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<WebglLineLayerManager | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);

  // LOW-freq live scene — shared hook (same WeakMap convert cache as DxfCanvasSubscriber),
  // so the same DxfScene ref reaches this leaf and `manager.setScene`'s ref-equality check
  // skips a needless rebuild on this leaf's own re-renders.
  const reactiveScene = useReactiveLevelScene(sceneLevelId, convertScene, scene);

  // ── Mount / unmount: manager + scheduler registration + LOW-freq subscriptions ──
  useEffect(() => {
    const container = divRef.current;
    if (!container) return;

    let manager: WebglLineLayerManager;
    try {
      manager = new WebglLineLayerManager(container);
    } catch {
      // WebGL unavailable at mount (fallback #2) — leave the flag false; Canvas2D
      // strokes every line. No throw, no gap.
      setWebglLineLayerActive(false);
      return;
    }
    managerRef.current = manager;

    // Prime the size before the ResizeObserver's first async callback.
    const rect = container.getBoundingClientRect();
    manager.resize(rect.width, rect.height);

    unregisterRef.current = registerRenderCallback(
      WEBGL_LINE_CANVAS_SYSTEM_ID,
      'WebGL Lines',
      RENDER_PRIORITIES.NORMAL,
      () => managerRef.current?.tick(),
      () => managerRef.current?.isDirty() ?? false,
    );

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !managerRef.current) return;
      const { width, height } = entry.contentRect;
      managerRef.current.resize(width, height);
    });
    observer.observe(container);

    // ADR-549 Phase 7 — DPR change (monitor swap / OS zoom) fires no ResizeObserver.
    const unsubDpr = subscribeDevicePixelRatio(() => managerRef.current?.syncDevicePixelRatio());
    // Content SSoT — layer colour/freeze, isolate, LWDISPLAY, dxfImport projection → rebuild.
    const unsubContent = subscribeContentInvalidation(() => managerRef.current?.invalidate());

    return () => {
      observer.disconnect();
      unsubDpr();
      unsubContent();
      // ADR-040 — UNREGISTER before dispose so no in-flight tick can race a torn-down renderer.
      unregisterRef.current?.();
      unregisterRef.current = null;
      setWebglLineLayerActive(false);
      managerRef.current?.dispose();
      managerRef.current = null;
    };
    // Mount-once: the manager instance is stable for the life of the leaf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scene identity → rebuild buffers + arm/disarm the large-scene gate (LOW-freq) ──
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    // Large-scene gate (fallback #1): below the threshold, build no GPU buffers and
    // leave every line to Canvas2D. The store flag drives the DxfRenderer suppression
    // (STEP 12) — false → Canvas2D strokes all lines (byte-identical current behaviour).
    const eligible =
      reactiveScene !== null &&
      reactiveScene.entities.length >= DXF_IMPORT_THRESHOLDS.WEBGL_LINE_LAYER_MIN_ENTITIES;
    manager.setScene(eligible ? reactiveScene : null);
    setWebglLineLayerActive(eligible);
  }, [reactiveScene]);

  return <div ref={divRef} className={className} aria-hidden="true" />;
});
