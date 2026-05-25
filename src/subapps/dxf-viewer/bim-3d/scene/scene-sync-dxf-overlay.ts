/**
 * ADR-366 §3D — DXF overlay first-frame camera fit + debug telemetry.
 *
 * Extracted from `ThreeJsSceneManager.syncDxfOverlay` to keep the manager
 * file under the 500-line cap (Google SRP, CLAUDE.md N.7.1).
 *
 * The debug logs were added during the 2026-05-25 unit-scale bug investigation
 * (Bug A/B: DXF mm vs Three.js metres, see ADR-366 §Bugfix). They remain in
 * place until the smoke test on a real DXF confirms the fix end-to-end.
 */

import type * as THREE from 'three';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewportCamera } from '../viewport/viewport-types';

export interface DxfOverlayFramingContext {
  readonly viewport: ViewportCamera;
  readonly scene: THREE.Scene;
  readonly bounds: THREE.Box3 | null;
  readonly fitDone: boolean;
  readonly onFitApplied: () => void;
}

export function applyDxfOverlayFraming(
  ctx: DxfOverlayFramingContext,
  dxfScene: DxfScene | null,
): void {
  const { bounds, fitDone, viewport, scene, onFitApplied } = ctx;
  console.log('[3D-DEBUG][syncDxfOverlay]', {
    sceneNull: dxfScene === null,
    fitDone,
    boxNull: bounds === null,
    boxEmpty: bounds?.isEmpty() ?? 'N/A',
    boxMin: bounds?.min.toArray().map(v => +v.toFixed(2)).join(',') ?? null,
    boxMax: bounds?.max.toArray().map(v => +v.toFixed(2)).join(',') ?? null,
    camPos: viewport.camera.position.toArray().map(v => +v.toFixed(2)).join(','),
  });
  if (fitDone) {
    console.log('[3D-DEBUG][syncDxfOverlay] frameBounds SKIPPED — fitDone=true');
    return;
  }
  if (!bounds || bounds.isEmpty()) {
    console.log('[3D-DEBUG][syncDxfOverlay] frameBounds SKIPPED — box null or empty');
    return;
  }
  viewport.frameBounds(bounds.min, bounds.max);
  onFitApplied();
  console.log('[3D-DEBUG][syncDxfOverlay] frameBounds CALLED ✓');
  setTimeout(() => {
    console.log('[3D-DEBUG][1s after frameBounds]', {
      camPos: viewport.camera.position.toArray().map(v => +v.toFixed(2)).join(','),
      dist: +viewport.camera.position.distanceTo(viewport.target).toFixed(2),
      sceneChildren: scene.children.length,
      dxfGroup: scene.children.find((c: { name: string }) => c.name === 'dxf-wireframe') ? '✓' : '✗',
    });
  }, 1000);
  setTimeout(() => {
    console.log('[3D-DEBUG][2s after frameBounds]', {
      camPos: viewport.camera.position.toArray().map(v => +v.toFixed(2)).join(','),
      dist: +viewport.camera.position.distanceTo(viewport.target).toFixed(2),
    });
  }, 2000);
}
