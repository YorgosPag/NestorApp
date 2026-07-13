/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * TopoQaOverlayMount (ADR-650 M5α) — the **2D** topography-QA «καμπανάκι» markers.
 *
 * The direct sibling of {@link ClashOverlayMount} (ADR-435): driven by the LOW-FREQUENCY
 * `useTopoQaReport()` store (set on «Έλεγχος ποιότητας», cleared on Clear), it renders the
 * SHARED {@link ClashMarkerLayer} + ⊙ glyph — ONE attention-marker shape across the app, no
 * second overlay. Each QA flag already carries its position in WORLD canonical mm (ADR-462),
 * which IS the canvas-unit frame the contour entities render in, so — unlike the clash
 * overlay — no metre→canvas conversion is needed; the point projects straight through the
 * immediate 2D transform for zero-lag pan/zoom tracking.
 *
 * Hidden while the 3D viewport is active (M5α ships 2D markers only; the report panel's
 * zoom-to still works in either view).
 *
 * @see ./clash-markers/ClashMarkerLayer.tsx — shared layer + glyph
 * @see ../../systems/topography/qa/topo-qa-store.ts — low-freq report store
 */

'use client';

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useTopoQaReport } from '../../systems/topography/qa/topo-qa-store';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';
import { useViewMode3DStore, selectIs3D } from '../../bim-3d/stores/ViewMode3DStore';
import { ClashMarkerLayer } from './clash-markers/ClashMarkerLayer';
import type { ClashMarkerGlyphProps } from './clash-markers/ClashMarkerGlyph';

export interface TopoQaOverlayMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const TopoQaOverlayMount = React.memo(function TopoQaOverlayMount(props: TopoQaOverlayMountProps) {
  const { getCanvas, getViewportElement } = props;
  const report = useTopoQaReport();
  const is3D = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => selectIs3D(useViewMode3DStore.getState()),
    () => false,
  );

  // Flag positions are already WORLD canonical mm = canvas units (contour-entity frame).
  const worlds = useMemo(
    () => (report ? report.flags.map((f) => ({ x: f.at.x, y: f.at.y })) : []),
    [report],
  );

  // QA severity IS the clash severity vocabulary ('high'|'medium'|'low') — reuse the glyph
  // verbatim (solid ring; QA has no «clearance» soft variant).
  const markers = useMemo<ClashMarkerGlyphProps[]>(
    () => (report ? report.flags.map((f) => ({ severity: f.severity, soft: false })) : []),
    [report],
  );

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

  // Reproject in the scheduler frame, AFTER the 2D canvases render, reading the immediate
  // transform — frame-synced so the markers track pan/zoom zero-lag (same SSoT the clash /
  // proposal-ghost overlays use).
  const subscribe = useCallback(
    (reproject: () => void) =>
      subscribeImmediateTransformFrame('topo-qa-markers-2d', 'Topo QA Markers 2D', reproject),
    [],
  );

  if (!report || report.flags.length === 0 || is3D) return null;
  return <ClashMarkerLayer markers={markers} project={project} subscribe={subscribe} className="z-[60]" />;
});
