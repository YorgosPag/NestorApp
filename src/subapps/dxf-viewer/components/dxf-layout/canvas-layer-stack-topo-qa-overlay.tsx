/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * TopoQaOverlayMount (ADR-650 M5α) — the **2D** topography-QA «καμπανάκι» markers.
 *
 * The direct sibling of {@link ClashOverlayMount} (ADR-435): driven by the LOW-FREQUENCY
 * `useTopoQaReport()` store (set on «Έλεγχος ποιότητας», cleared on Clear), it renders the
 * SHARED {@link ClashMarkerLayer} + ⊙ glyph — ONE attention-marker shape across the app, no
 * second overlay. Each QA flag carries its position in WORLD canonical mm (ADR-462) — already mm, so
 * unlike the clash overlay no metre→canvas conversion is needed. ⚠️ ADR-920 Β1: WORLD is ΕΓΣΑ and the
 * canvas is DISPLAY, so the position passes through the WORLD→DISPLAY projector first (ADR-650 §M10f —
 * the contours it marks are drawn projected; before Β1 the ⊙ were not, and missed them in every
 * geo-referenced project), then through the immediate 2D transform for zero-lag pan/zoom tracking.
 *
 * Hidden while the 3D viewport is active — NOT because 3D lacks markers (M5α.2 added them), but
 * because it has its OWN: `TopoQaMarkers3DOverlay` projects the same flags through the camera.
 * Both drawing at once would double every ⊙. The guard is load-bearing, not a leftover.
 *
 * @see ./clash-markers/ClashMarkerLayer.tsx — shared layer + glyph
 * @see ../../bim-3d/coordination/TopoQaMarkers3DOverlay.tsx — the 3D twin
 * @see ../../systems/topography/qa/topo-qa-store.ts — low-freq report store
 */

'use client';

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useTopoQaReport, useTopoQaSelectedFlagId } from '../../systems/topography/qa/topo-qa-store';
import { topoQaMarkerGlyphs, topoQaMarkerPositions } from '../../systems/topography/qa/topo-qa-marker-set';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';
import { useViewMode3DStore, selectIs3D } from '../../bim-3d/stores/ViewMode3DStore';
import { ClashMarkerLayer } from './clash-markers/ClashMarkerLayer';
import { useTopoDisplayProjector } from '../../systems/topography/useTopoDisplayProjector';
import { projectWorldPoint } from '../../systems/topography/topo-display-frame';

export interface TopoQaOverlayMountProps {
  // ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε (βλ. ImmediateTransformStore SSoT).
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

  // Flag positions are WORLD (ΕΓΣΑ) canonical mm → DISPLAY, the frame the contours are drawn in. This
  // one-liner IS the whole difference between this overlay and the 3D twin.
  const projector = useTopoDisplayProjector();
  const worlds = useMemo(
    () => topoQaMarkerPositions(report, (f) => projectWorldPoint({ x: f.at.x, y: f.at.y }, projector)),
    [report, projector],
  );
  // Separate low-frequency subscription (click-driven, like the report itself — ADR-040-safe).
  const selectedFlagId = useTopoQaSelectedFlagId();
  const markers = useMemo(() => topoQaMarkerGlyphs(report, selectedFlagId), [report, selectedFlagId]);

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
