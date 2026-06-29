import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { readPersistedCamera3D, persistCamera3D, type Camera3DPose } from '../../services/camera3d-persistence';
import { DXF_TIMING } from '../../config/dxf-timing';

/**
 * ADR-400 §3D — wire persist/restore of the 3D camera view (URL deep-link + localStorage)
 * for one mounted `ThreeJsSceneManager`. Extracted from `BimViewport3D` (file-size N.7.1).
 *
 * On attach: restore the persisted pose BEFORE the initial DXF auto-fit (the URL `lvl` key —
 * shared with the 2D URL — wins; per-level localStorage is the fallback). `restoreCameraView`
 * latches the fit flag so the subsequent Zoom-Extents never animates the restored pose away.
 *
 * While attached: every camera settle (orbit/pan/wheel-idle/tumble routes through the manager's
 * interaction-end) debounce-persists with the 2D URL_DEBOUNCE for a consistent feel.
 *
 * On `dispose()`: flush any pending persist (a 2D toggle / unmount IS the save moment) then
 * detach the settle callback. Caller MUST invoke it before disposing the manager.
 */
export function attachCamera3DPersistence(manager: ThreeJsSceneManager): { dispose: () => void } {
  const docId = new URLSearchParams(window.location.search).get('lvl'); // same key the 2D URL uses
  const persisted = readPersistedCamera3D(docId);
  if (persisted) {
    manager.restoreCameraView(
      new THREE.Vector3(...persisted.position),
      new THREE.Vector3(...persisted.target),
      persisted.zoom,
      persisted.projection,
    );
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const persistNow = (): void => {
    const cam = manager.viewport.camera;
    const tgt = manager.viewport.target;
    const pose: Camera3DPose = {
      position: [cam.position.x, cam.position.y, cam.position.z],
      target: [tgt.x, tgt.y, tgt.z],
      zoom: manager.viewport.getZoom(),
      projection: manager.viewport.projectionMode,
    };
    persistCamera3D(docId, pose);
  };

  manager.setCameraSettledCallback(() => {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { persistTimer = null; persistNow(); }, DXF_TIMING.ui.URL_DEBOUNCE);
  });

  return {
    dispose() {
      if (persistTimer !== null) { clearTimeout(persistTimer); persistTimer = null; persistNow(); }
      manager.setCameraSettledCallback(null);
    },
  };
}
