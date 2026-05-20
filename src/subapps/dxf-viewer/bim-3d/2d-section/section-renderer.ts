/**
 * ADR-366 §A.3 Q3 Phase 7.0B — 2D Section Panel standalone renderer.
 *
 * Dedicated WebGLRenderer + OrthographicCamera για το 2D section view.
 * Camera looks along -Z (front view), Y up. Render-on-demand — no rAF loop.
 *
 * Port από `C:\genarc\src\engines\viewport\sectionRenderer.ts` (245 LOC,
 * PORT_WITH_ADAPTATION per SPEC-3D-004A §3.2) με:
 *   - LoupeSceneData → SectionPanelScene (Nestor naming, content unchanged)
 *   - Constants από `section-2d-constants.ts` (Nestor scoping)
 *   - SECTION_2D_PANEL_COLORS.background αντί SECTION_BG hardcoded
 *
 * @see SPEC-3D-004A §3.2 — GenArc port reference
 * @see ADR-366 §A.3 Q3
 */

import * as THREE from 'three';
import { SECTION_2D_PANEL_COLORS } from '../../config/color-config';
import {
  SECTION_2D_DEFAULT_ORTHO_SIZE_M,
  SECTION_2D_PIXEL_RATIO_CAP,
  SECTION_2D_CAMERA_PADDING,
  SECTION_2D_ZOOM_FACTOR,
  SECTION_2D_ZOOM_MIN,
  SECTION_2D_ZOOM_MAX,
  SECTION_2D_LINE_PICK_THRESHOLD_M,
  SECTION_2D_DEFAULT_WIDTH_PX,
  SECTION_2D_DEFAULT_HEIGHT_PX,
  SECTION_2D_CAMERA_DISTANCE_M,
} from './section-2d-constants';
import type { SectionPanelScene, SectionElementType } from './section-geometry';

export interface SectionPickResult {
  readonly bimId: string;
  readonly bimType: SectionElementType;
}

export interface SectionPanelRenderer {
  readonly mount: (container: HTMLElement) => void;
  readonly unmount: () => void;
  readonly update: (sceneData: SectionPanelScene) => void;
  readonly updateContent: (sceneData: SectionPanelScene) => void;
  readonly render: () => void;
  readonly resize: (width: number, height: number) => void;
  readonly zoom: (delta: number, ndcX: number, ndcY: number) => void;
  readonly pan: (dxPx: number, dyPx: number) => void;
  readonly pick: (ndcX: number, ndcY: number) => SectionPickResult | null;
  readonly resetView: () => void;
  readonly dispose: () => void;
}

export function createSectionPanelRenderer(): SectionPanelRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SECTION_2D_PIXEL_RATIO_CAP));
  renderer.setClearColor(SECTION_2D_PANEL_COLORS.background);

  const domEl = renderer.domElement;
  domEl.style.width = '100%';
  domEl.style.height = '100%';
  domEl.style.display = 'block';

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const viewDir = new THREE.Vector3(0, 0, -1);
  const cameraUp = new THREE.Vector3(0, 1, 0);
  camera.up.copy(cameraUp);

  const scene = new THREE.Scene();
  let contentRoot: THREE.Group | null = null;
  let currentDispose: (() => void) | null = null;
  let width = SECTION_2D_DEFAULT_WIDTH_PX;
  let height = SECTION_2D_DEFAULT_HEIGHT_PX;
  let lastBbox: THREE.Box3 | null = null;
  const pickRaycaster = new THREE.Raycaster();
  pickRaycaster.params.Line = { threshold: SECTION_2D_LINE_PICK_THRESHOLD_M };

  function frameToBbox(bbox: THREE.Box3): void {
    if (bbox.isEmpty()) return;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bbox.getCenter(center);
    bbox.getSize(size);
    const right = new THREE.Vector3().crossVectors(viewDir, cameraUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();
    const halfX = Math.abs(size.dot(right)) * 0.5;
    const halfY = Math.abs(size.dot(up)) * 0.5;
    const aspect = width / Math.max(height, 1);
    const zoomX = aspect > 0 && halfX > 0
      ? SECTION_2D_DEFAULT_ORTHO_SIZE_M / (halfX * SECTION_2D_CAMERA_PADDING)
      : 1;
    const zoomY = halfY > 0
      ? SECTION_2D_DEFAULT_ORTHO_SIZE_M / (halfY * SECTION_2D_CAMERA_PADDING)
      : 1;
    const zoom = Math.max(Math.min(zoomX, zoomY), SECTION_2D_ZOOM_MIN);
    camera.zoom = zoom;
    camera.position.copy(center).addScaledVector(viewDir, -SECTION_2D_CAMERA_DISTANCE_M);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  function applySize(w: number, h: number): void {
    width = w;
    height = h;
    const aspect = w / Math.max(h, 1);
    camera.left = -SECTION_2D_DEFAULT_ORTHO_SIZE_M * aspect;
    camera.right = SECTION_2D_DEFAULT_ORTHO_SIZE_M * aspect;
    camera.top = SECTION_2D_DEFAULT_ORTHO_SIZE_M;
    camera.bottom = -SECTION_2D_DEFAULT_ORTHO_SIZE_M;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function removeContent(): void {
    if (contentRoot) {
      scene.remove(contentRoot);
      contentRoot = null;
    }
    if (currentDispose) {
      currentDispose();
      currentDispose = null;
    }
  }

  function setContent(sceneData: SectionPanelScene): void {
    removeContent();
    contentRoot = sceneData.root;
    scene.add(contentRoot);
    currentDispose = sceneData.dispose;
    lastBbox = sceneData.bbox.clone();
  }

  applySize(width, height);

  return {
    mount(container) {
      container.appendChild(renderer.domElement);
    },

    unmount() {
      renderer.domElement.parentElement?.removeChild(renderer.domElement);
    },

    update(sceneData) {
      setContent(sceneData);
      frameToBbox(sceneData.bbox);
      renderer.render(scene, camera);
    },

    updateContent(sceneData) {
      setContent(sceneData);
      renderer.render(scene, camera);
    },

    render() {
      renderer.render(scene, camera);
    },

    resize(w, h) {
      applySize(w, h);
      if (lastBbox) frameToBbox(lastBbox);
      renderer.render(scene, camera);
    },

    zoom(delta, ndcX, ndcY) {
      const factor = delta > 0 ? SECTION_2D_ZOOM_FACTOR : 1 / SECTION_2D_ZOOM_FACTOR;
      const halfW0 = (camera.right - camera.left) / (2 * camera.zoom);
      const halfH0 = (camera.top - camera.bottom) / (2 * camera.zoom);
      const wx = camera.position.x + ndcX * halfW0;
      const wy = camera.position.y + ndcY * halfH0;
      camera.zoom = Math.max(SECTION_2D_ZOOM_MIN, Math.min(camera.zoom * factor, SECTION_2D_ZOOM_MAX));
      const halfW1 = (camera.right - camera.left) / (2 * camera.zoom);
      const halfH1 = (camera.top - camera.bottom) / (2 * camera.zoom);
      camera.position.x = wx - ndcX * halfW1;
      camera.position.y = wy - ndcY * halfH1;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },

    pan(dxPx, dyPx) {
      const frustumW = camera.right - camera.left;
      const worldPerPx = frustumW / (camera.zoom * width);
      camera.position.x -= dxPx * worldPerPx;
      camera.position.y += dyPx * worldPerPx;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },

    pick(ndcX, ndcY) {
      const ndc = new THREE.Vector2(ndcX, ndcY);
      pickRaycaster.setFromCamera(ndc, camera);
      const hits = pickRaycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        const ud = hit.object.userData as { bimId?: string; bimType?: string };
        if (ud.bimId && ud.bimType) {
          return { bimId: ud.bimId, bimType: ud.bimType as SectionElementType };
        }
      }
      return null;
    },

    resetView() {
      if (lastBbox) frameToBbox(lastBbox);
      renderer.render(scene, camera);
    },

    dispose() {
      removeContent();
      renderer.dispose();
    },
  };
}
