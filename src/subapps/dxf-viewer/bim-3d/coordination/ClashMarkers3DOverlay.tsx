'use client';

/**
 * ADR-435 Slice 1b — ClashMarkers3DOverlay: the **3D** clash markers, rendered with
 * the EXACT same DOM ⊙ glyph + layer as the 2D overlay (one source of truth — no
 * second shape). Instead of Three.js scene objects, each clash point is projected
 * world → screen through the live camera (the CSS2D-renderer pattern used by
 * Navisworks/Forge HTML overlays), so the marker is byte-identical to 2D, always
 * visible (screen-space, never occluded), and screen-constant in size.
 *
 * Mounted by BimViewport3D, so it exists ONLY while the 3D view is active. Driven by
 * the low-frequency {@link useClashReport} store; the projection and the camera-move tick
 * come from the shared {@link useCameraProjectedMarkers} (ADR-650 M5α.2 extracted them when the
 * topography-QA overlay reproduced both verbatim — see N.18).
 *
 * "Zoom to clash" is NOT owned here either: a panel row click goes through the shared view-focus
 * bus to `useViewFocus3D`, for the same reason.
 *
 * @see ../../components/dxf-layout/clash-markers/ClashMarkerLayer.tsx — shared layer
 * @see ./use-camera-projected-markers.ts — shared projection + camera tick
 * @see ./clash-marker-math.ts — plan-metres → world (x, z, −y)
 * @see ../viewport/use-view-focus-3d.ts — the camera framing this component used to own
 */

import React, { useMemo, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { clashPointToWorld } from './clash-marker-math';
import { useClashReport } from '../../systems/coordination/clash-report-store';
import { useCameraProjectedMarkers } from './use-camera-projected-markers';
import { ClashMarkerLayer } from '../../components/dxf-layout/clash-markers/ClashMarkerLayer';
import type { ClashMarkerGlyphProps } from '../../components/dxf-layout/clash-markers/ClashMarkerGlyph';

export interface ClashMarkers3DOverlayProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function ClashMarkers3DOverlay({ managerRef }: ClashMarkers3DOverlayProps): React.ReactElement | null {
  const review = useClashReport();

  const worlds = useMemo(
    () => (review ? review.report.clashes.map((c) => clashPointToWorld(c.point)) : []),
    [review],
  );

  const markers = useMemo<ClashMarkerGlyphProps[]>(() => {
    if (!review) return [];
    return review.report.clashes.map((c) => ({ severity: c.severity, soft: c.type === 'clearance' }));
  }, [review]);

  const { project, subscribe } = useCameraProjectedMarkers(
    managerRef, worlds, 'bim-3d-clash-markers', 'BIM 3D Clash Markers',
  );

  if (!review) return null;
  return <ClashMarkerLayer markers={markers} project={project} subscribe={subscribe} className="z-[60]" />;
}
