/**
 * ADR-453 — Print/Export engine · 3D capture adapter.
 *
 * Snapshots the live 3D view to a paper-resolution PNG via a SEPARATE offscreen
 * `WebGLRenderer` with `preserveDrawingBuffer:true` (the live renderer has it
 * off, so its buffer can't be read reliably). Mirrors the proven offscreen
 * pattern from `bim-3d/animation/MP4Exporter.ts`. The live renderer/scene/camera
 * are never mutated — the camera is cloned before adjusting aspect.
 *
 * @module subapps/dxf-viewer/print/capture/capture-3d
 */

import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../../bim-3d/scene/ThreeJsSceneManager';
import { createOffscreenCaptureRenderer } from '../../bim-3d/scene/scene-setup';
import type { RasterTargetPx } from '../config/paper-types';
import type { CaptureResult } from './capture-types';

/** Clone the live camera and fit it to the export aspect (non-mutating). */
function prepareCamera(source: THREE.Camera, width: number, height: number): THREE.Camera {
  const camera = source.clone();
  const persp = camera as THREE.PerspectiveCamera;
  if (persp.isPerspectiveCamera) {
    persp.aspect = width / height;
    persp.updateProjectionMatrix();
    return persp;
  }
  const ortho = camera as THREE.OrthographicCamera;
  if (ortho.isOrthographicCamera) {
    ortho.updateProjectionMatrix();
  }
  return camera;
}

/**
 * Capture the active 3D scene to a paper-resolution PNG `CaptureResult`.
 * 3D has no real-world 1:N, so `appliedScaleDenominator` is always null.
 */
export function captureCurrent3dView(
  sceneManager: ThreeJsSceneManager,
  raster: RasterTargetPx,
): CaptureResult {
  const { widthPx, heightPx } = raster;
  // ADR-366 §B.5 — shared offscreen-capture renderer SSoT (same config as the MP4 exporter).
  const renderer = createOffscreenCaptureRenderer(widthPx, heightPx);
  try {
    const camera = prepareCamera(sceneManager.getCamera(), widthPx, heightPx);
    renderer.render(sceneManager.scene, camera);

    return {
      kind: 'raster',
      dataUrl: renderer.domElement.toDataURL('image/png'),
      widthPx,
      heightPx,
      appliedScaleDenominator: null,
    };
  } finally {
    renderer.dispose();
  }
}
