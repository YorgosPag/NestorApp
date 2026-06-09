/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ClashOverlayMount (ADR-435 Slice 1 / 1b) — the **2D** clash-detection markers.
 *
 * Driven by the LOW-FREQUENCY `useClashReport()` store (set on Detect, cleared on
 * Clear). Renders the SHARED {@link ClashMarkerLayer} (the same ⊙ glyph + layer used
 * by the 3D overlay — one source of truth), projecting each clash point through the
 * **immediate 2D transform** so the markers track pan/zoom **zero-lag** (the canvas
 * bypasses React state for the transform; so do these markers). Hidden while the 3D
 * viewport is active — there the camera-projected overlay takes over.
 *
 * @see ./clash-markers/ClashMarkerLayer.tsx — shared layer
 * @see ../../systems/cursor/ImmediateTransformStore.ts — zero-lag transform SSoT
 * @see ../../rendering/core/CoordinateTransforms.ts — shared world→screen SSoT
 */

'use client';

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useClashReport } from '../../systems/coordination/clash-report-store';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../../rendering/core/UnifiedFrameScheduler';
import { useViewMode3DStore, selectIs3D } from '../../bim-3d/stores/ViewMode3DStore';
import { ClashMarkerLayer } from './clash-markers/ClashMarkerLayer';
import type { ClashMarkerGlyphProps } from './clash-markers/ClashMarkerGlyph';

export interface ClashOverlayMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ClashOverlayMount = React.memo(function ClashOverlayMount(props: ClashOverlayMountProps) {
  const { getCanvas, getViewportElement } = props;
  const review = useClashReport();
  const is3D = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => selectIs3D(useViewMode3DStore.getState()),
    () => false,
  );

  // Clash points in canvas units (stable per report).
  const worlds = useMemo(() => {
    if (!review) return [];
    const toCanvas = 1 / sceneUnitsToMeters(review.sceneUnits);
    return review.report.clashes.map((c) => ({ x: c.point.x * toCanvas, y: c.point.y * toCanvas }));
  }, [review]);

  const markers = useMemo<ClashMarkerGlyphProps[]>(() => {
    if (!review) return [];
    return review.report.clashes.map((c) => ({ severity: c.severity, soft: c.type === 'clearance' }));
  }, [review]);

  // Project via the IMMEDIATE transform (zero-lag, read at call time — not the prop).
  const project = useCallback((i: number): { x: number; y: number } | null => {
    const el = getViewportElement() ?? getCanvas();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const screen = CoordinateTransforms.worldToScreen(
      worlds[i], getImmediateTransform(), { width: rect.width, height: rect.height },
    );
    return { x: rect.left + screen.x, y: rect.top + screen.y };
  }, [worlds, getViewportElement, getCanvas]);

  // Reproject in the scheduler frame, AFTER the 2D canvases render (LOW), reading the
  // immediate transform — frame-synced with the canvas so the markers track pan/zoom
  // zero-lag (same approach as the 3D overlay). Gated on the transform actually changing.
  const subscribe = useCallback((reproject: () => void) => {
    let lastSig = '';
    const unregister = UnifiedFrameScheduler.register(
      'clash-markers-2d',
      'Clash Markers 2D',
      RENDER_PRIORITIES.LOW,
      () => reproject(),
      () => {
        const t = getImmediateTransform();
        const sig = `${t.scale},${t.offsetX},${t.offsetY}`;
        if (sig === lastSig) return false;
        lastSig = sig;
        return true;
      },
    );
    reproject();
    return unregister;
  }, []);

  if (!review || is3D) return null;
  return <ClashMarkerLayer markers={markers} project={project} subscribe={subscribe} className="z-[60]" />;
});
