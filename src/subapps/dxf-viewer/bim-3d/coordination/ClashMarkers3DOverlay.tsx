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
 * the low-frequency {@link useClashReport} store; positions are recomputed
 * **imperatively** on every camera move via a LOW-priority UnifiedFrameScheduler
 * subsystem that runs AFTER `bim-3d-scene` (so the camera is already updated this
 * frame → zero-lag) and ONLY when the camera actually changed (no idle spin).
 *
 * Also owns "zoom to clash": a panel row click (clash-focus bus) frames the camera.
 *
 * @see ../../components/dxf-layout/clash-markers/ClashMarkerLayer.tsx — shared layer
 * @see ./clash-marker-math.ts — plan-metres → world (x, z, −y)
 */

import React, { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { clashPointToWorld } from './clash-marker-math';
import { useClashReport } from '../../systems/coordination/clash-report-store';
import { subscribeClashFocus } from '../../systems/coordination/clash-focus-bus';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../../rendering/core/UnifiedFrameScheduler';
import { ClashMarkerLayer } from '../../components/dxf-layout/clash-markers/ClashMarkerLayer';
import type { ClashMarkerGlyphProps } from '../../components/dxf-layout/clash-markers/ClashMarkerGlyph';

/** Half-size (m) of the box framed around a clash when "zooming to" it. */
const CLASH_FOCUS_HALF_EXTENT_M = 0.6;

const _tmp = new THREE.Vector3();

export interface ClashMarkers3DOverlayProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** Camera zoom factor (perspective + ortho both expose `.zoom`); 1 otherwise. */
function cameraZoom(cam: THREE.Camera): number {
  return cam instanceof THREE.PerspectiveCamera || cam instanceof THREE.OrthographicCamera ? cam.zoom : 1;
}

export function ClashMarkers3DOverlay({ managerRef }: ClashMarkers3DOverlayProps): React.ReactElement | null {
  const review = useClashReport();

  const worlds = useMemo(() => {
    if (!review) return [] as THREE.Vector3[];
    return review.report.clashes.map((c) => {
      const w = clashPointToWorld(c.point);
      return new THREE.Vector3(w.x, w.y, w.z);
    });
  }, [review]);

  const markers = useMemo<ClashMarkerGlyphProps[]>(() => {
    if (!review) return [];
    return review.report.clashes.map((c) => ({ severity: c.severity, soft: c.type === 'clearance' }));
  }, [review]);

  // world → client px via the live camera (null = behind the camera ⇒ hidden).
  const project = useCallback((i: number): { x: number; y: number } | null => {
    const manager = managerRef.current;
    if (!manager) return null;
    const camera = manager.getCamera();
    const canvas = manager.getRendererCanvas();
    const rect = canvas.getBoundingClientRect();
    _tmp.copy(worlds[i]).project(camera);
    if (_tmp.z > 1) return null;
    return {
      x: rect.left + (_tmp.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-_tmp.y * 0.5 + 0.5) * rect.height,
    };
  }, [worlds, managerRef]);

  // Reproject after the scene renders (camera current) — only when the camera moved.
  const subscribe = useCallback((reproject: () => void) => {
    let lastSig = '';
    const unregister = UnifiedFrameScheduler.register(
      'bim-3d-clash-markers',
      'BIM 3D Clash Markers',
      RENDER_PRIORITIES.LOW,
      () => reproject(),
      () => {
        const manager = managerRef.current;
        if (!manager) return false;
        const c = manager.getCamera();
        const sig = `${c.position.x},${c.position.y},${c.position.z},${c.quaternion.x},${c.quaternion.y},${c.quaternion.z},${c.quaternion.w},${cameraZoom(c)}`;
        if (sig === lastSig) return false;
        lastSig = sig;
        return true;
      },
    );
    reproject();
    return unregister;
  }, [managerRef]);

  // "Zoom to clash" — frame a small box around the point (panel row click).
  useEffect(() => {
    return subscribeClashFocus((point) => {
      const manager = managerRef.current;
      if (!manager) return;
      const w = clashPointToWorld(point);
      const h = CLASH_FOCUS_HALF_EXTENT_M;
      manager.viewport.frameBounds(
        new THREE.Vector3(w.x - h, w.y - h, w.z - h),
        new THREE.Vector3(w.x + h, w.y + h, w.z + h),
      );
    });
  }, [managerRef]);

  if (!review) return null;
  return <ClashMarkerLayer markers={markers} project={project} subscribe={subscribe} className="z-[60]" />;
}
