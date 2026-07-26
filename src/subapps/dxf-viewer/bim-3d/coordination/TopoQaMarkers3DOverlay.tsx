'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * TopoQaMarkers3DOverlay (ADR-650 M5α.2) — the **3D** topography-QA «καμπανάκι» markers.
 *
 * The exact 3D twin of {@link TopoQaOverlayMount}: same low-frequency `useTopoQaReport()` store,
 * same shared {@link ClashMarkerLayer} + ⊙ glyph — ONE attention-marker shape across the app, in
 * both views. Only the projection differs, and that is not written here either: it comes from
 * {@link useCameraProjectedMarkers}, shared with the clash overlay.
 *
 * What is left in this file is therefore exactly what is topography-specific: which store it reads
 * and how a survey flag becomes a world point. That is the intended end state — an overlay should
 * be a wiring declaration, not a re-implementation.
 *
 * ### Why it exists
 * M5α shipped 2D markers only and hid itself in 3D (`if (is3D) return null`). But the survey is
 * exactly what an engineer inspects in 3D — an elevation bust IS a spike in the terrain mesh, and
 * it is invisible in plan. A QA report that goes blank the moment you orbit the site answers only
 * half the question it was asked.
 *
 * Mounted by `BimViewport3DProjectedOverlays`, so it exists ONLY while the 3D view is active.
 *
 * @see ../../components/dxf-layout/canvas-layer-stack-topo-qa-overlay.tsx — the 2D twin
 * @see ./topo-qa-flag-world.ts — flag → three-world (shared with the panel's «zoom to»)
 */

import React, { useMemo, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useTopoQaReport, useTopoQaSelectedFlagId } from '../../systems/topography/qa/topo-qa-store';
import { topoQaMarkerGlyphs, topoQaMarkerPositions } from '../../systems/topography/qa/topo-qa-marker-set';
import { resolveTopoQaFlagWorld } from './topo-qa-flag-world';
import { useCameraProjectedMarkers } from './use-camera-projected-markers';
import { ClashMarkerLayer } from '../../components/dxf-layout/clash-markers/ClashMarkerLayer';

export interface TopoQaMarkers3DOverlayProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function TopoQaMarkers3DOverlay({ managerRef }: TopoQaMarkers3DOverlayProps): React.ReactElement | null {
  const report = useTopoQaReport();

  /**
   * World positions, resolved ONCE per report (the store changes on Run / Clear only, never per
   * frame). `null` for a flag whose elevation nothing can answer for — kept in the array so the
   * index stays aligned with `markers`, and hidden by the shared projector.
   *
   * Known limit: changing the vertical datum / geo-reference while a report is open does not
   * re-seat the markers — the report is a snapshot of «what was true when you pressed Run» (the
   * Civil 3D / TBC model), and re-running is the intended way to refresh it.
   */
  const worlds = useMemo(
    () => topoQaMarkerPositions(report, (f) => resolveTopoQaFlagWorld(f, report!.surfaceId)),
    [report],
  );
  // Selection is a SEPARATE subscription from the report on purpose: a row click must repaint the
  // glyphs without invalidating `worlds` above (which would re-run the TIN sampling per flag).
  const selectedFlagId = useTopoQaSelectedFlagId();
  const markers = useMemo(() => topoQaMarkerGlyphs(report, selectedFlagId), [report, selectedFlagId]);

  const { project, subscribe } = useCameraProjectedMarkers(
    managerRef, worlds, 'bim-3d-topo-qa-markers', 'BIM 3D Topo QA Markers',
  );

  if (!report || report.flags.length === 0) return null;
  return <ClashMarkerLayer markers={markers} project={project} subscribe={subscribe} className="z-[60]" />;
}
