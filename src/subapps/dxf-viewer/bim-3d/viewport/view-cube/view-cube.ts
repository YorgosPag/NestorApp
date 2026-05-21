/**
 * ViewCube: interactive 3D navigation widget.
 * PORT_WITH_ADAPTATION from GenArc viewCube.ts (ADR-366 §8.2 SPEC-3D-004A).
 * Adaptation: useSiteStore north-angle subscription → getNorthAngleDeg callback
 * (Nestor has no site store; north angle supplied externally or defaults to 0).
 */

import * as THREE from 'three';
import type { ProjectionMode, CanonicalViewId } from '../viewport-types';
import {
  createVisualCube, createHitTargets, createCompassRing, createHomeButton,
  FACE_DIRS, type HitUserData, type FaceLabels, type CompassLabels,
} from './view-cube-mesh';
import { createRollArrows, createFaceNavArrows, computeCompassDirection } from './view-cube-overlay';
import { computeHighlights } from './view-cube-highlight';
import { matchIsoCanonicalView } from '../canonical-views';

const CUBE_CANVAS_SIZE = 160;
const MAX_PIXEL_RATIO = 1.5;

const FACE_TO_PROJECTION: Record<number, ProjectionMode> = {
  0: 'right', 1: 'left', 2: 'top', 3: 'bottom', 4: 'front', 5: 'back',
} as const;

// Same mapping as FACE_TO_PROJECTION but typed as CanonicalViewId (used by onSnapToView path).
const FACE_INDEX_TO_VIEW_ID: Record<number, CanonicalViewId> = {
  0: 'right', 1: 'left', 2: 'top', 3: 'bottom', 4: 'front', 5: 'back',
} as const;

export interface ViewCubeOptions {
  readonly container: HTMLElement;
  readonly getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly getTarget: () => THREE.Vector3;
  readonly onFaceSnap: (mode: ProjectionMode) => void;
  readonly onDirSnap: (dir: THREE.Vector3) => void;
  readonly onHome: () => void;
  readonly onDragRotate?: (dxPx: number, dyPx: number) => void;
  /**
   * Phase 4.1: canonical dispatch — face/faceNav/edge/corner clicks route here
   * when provided. Falls back to onFaceSnap/onDirSnap when absent.
   */
  readonly onSnapToView?: (id: CanonicalViewId) => void;
  /**
   * Returns true-north offset in degrees (0 = no offset). Defaults to 0.
   * Return null when no topographic data is available (compass hidden by default).
   */
  readonly getNorthAngleDeg?: () => number | null;
  /**
   * Phase 4.3: right-click context menu request with screen coordinates.
   * Consumer (BimViewport3D) renders the React context menu overlay.
   */
  readonly onContextMenuRequest?: (x: number, y: number) => void;
  /** Phase 4.3: initial compass ring visibility (default true). */
  readonly compassVisible?: boolean;
  readonly labels?: {
    readonly faces?: Partial<FaceLabels>;
    readonly compass?: Partial<CompassLabels>;
  };
}

export interface ViewCubeEngine {
  sync(cam: THREE.PerspectiveCamera | THREE.OrthographicCamera, target: THREE.Vector3): void;
  /** Phase 4.3: programmatically toggle compass ring visibility. */
  setCompassVisible(visible: boolean): void;
  dispose(): void;
}

export function createViewCube(opts: ViewCubeOptions): ViewCubeEngine {
  const { container, getCamera, getTarget, onFaceSnap, onDirSnap, onHome, onDragRotate, onSnapToView, getNorthAngleDeg, onContextMenuRequest } = opts;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  const size = CUBE_CANVAS_SIZE;
  canvas.width = size * dpr; canvas.height = size * dpr;
  Object.assign(canvas.style, {
    width: `${size}px`, height: `${size}px`, position: 'absolute',
    top: '12px', right: '12px', pointerEvents: 'auto',
    zIndex: '20', borderRadius: '4px', cursor: 'pointer',
  });
  container.appendChild(canvas);

  const miniRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  miniRenderer.setPixelRatio(dpr);
  miniRenderer.setSize(size, size, false);
  miniRenderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const miniCam = new THREE.OrthographicCamera(-1.95, 1.95, 1.95, -1.95, 0.1, 20);
  miniCam.position.set(0, 0, 8);
  miniCam.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  const faceLabels: FaceLabels = {
    right:  opts.labels?.faces?.right  ?? 'RGT',
    left:   opts.labels?.faces?.left   ?? 'LFT',
    top:    opts.labels?.faces?.top    ?? 'TOP',
    bottom: opts.labels?.faces?.bottom ?? 'BOT',
    front:  opts.labels?.faces?.front  ?? 'FRT',
    back:   opts.labels?.faces?.back   ?? 'BCK',
  };
  const compassLabels: CompassLabels = {
    n: opts.labels?.compass?.n ?? 'N',
    e: opts.labels?.compass?.e ?? 'E',
    s: opts.labels?.compass?.s ?? 'S',
    w: opts.labels?.compass?.w ?? 'W',
  };

  const { mesh: cubeMesh, materials: cubeMaterials, setHighlights: cubeSetHighlights } = createVisualCube(faceLabels);
  const hitTargets = createHitTargets();
  const { group: compassGroup, hitMeshes: compassHitMeshes, ringMaterial } = createCompassRing(compassLabels);
  const { sprite: homeSprite, hitMesh: homeHitMesh } = createHomeButton();
  const { sprites: rollSprites, hitMeshes: rollHitMeshes } = createRollArrows();
  const { group: faceNavGroup, hitMeshes: faceNavHitMeshes, materials: faceNavMats } = createFaceNavArrows();

  const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
  const outlineMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.15 });
  const outlineLines = new THREE.LineSegments(outlineGeo, outlineMat);

  const cubeGroup = new THREE.Group();
  cubeGroup.add(cubeMesh);
  for (const t of hitTargets) cubeGroup.add(t);
  cubeGroup.add(outlineLines);
  cubeGroup.add(compassGroup);
  cubeGroup.add(faceNavGroup);
  scene.add(cubeGroup);

  scene.add(homeSprite); scene.add(homeHitMesh);
  for (const s of rollSprites) scene.add(s);
  for (const hm of rollHitMeshes) scene.add(hm);

  homeSprite.visible = false; homeHitMesh.visible = false;

  const pickables: THREE.Object3D[] = [
    ...hitTargets, ...compassHitMeshes, homeHitMesh,
    ...rollHitMeshes, ...faceNavHitMeshes,
  ];

  for (const mat of cubeMaterials) { mat.transparent = true; mat.opacity = 0.5; }

  // Phase 4.3: compass visibility state (user-controlled, persisted via Bim3DPreferencesService)
  let compassVisibleState = opts.compassVisible ?? true;
  compassGroup.visible = compassVisibleState;

  let hoveredMesh: THREE.Mesh | null = null;
  let cubeHovered = false;
  let isPointerDown = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let prevDragX = 0;
  let prevDragY = 0;

  const DRAG_THRESHOLD_SQ = 9;
  const _raycaster = new THREE.Raycaster();
  const _mouse = new THREE.Vector2();

  function getNorthAngleRad(): number {
    const deg = getNorthAngleDeg?.() ?? 0;
    return ((deg ?? 0) * Math.PI) / 180;
  }

  function getNormalizedMouse(e: PointerEvent): THREE.Vector2 {
    const rect = canvas.getBoundingClientRect();
    _mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
    _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return _mouse;
  }

  function getFirstHit(e: PointerEvent): THREE.Intersection | null {
    getNormalizedMouse(e);
    _raycaster.setFromCamera(_mouse, miniCam);
    const hits = _raycaster.intersectObjects(pickables, false);
    return hits.length > 0 ? hits[0]! : null;
  }

  function computeDirection(faces: readonly number[]): THREE.Vector3 {
    const sum = new THREE.Vector3();
    for (const fi of faces) { const d = FACE_DIRS[fi]; if (d) sum.add(d); }
    return sum.normalize();
  }

  function updateHover(e: PointerEvent): void {
    const hit = getFirstHit(e);
    const newMesh = hit ? (hit.object as THREE.Mesh) : null;
    if (newMesh === hoveredMesh) return;
    hoveredMesh = null;
    if (newMesh !== null) {
      const ud = newMesh.userData as HitUserData;
      hoveredMesh = newMesh;
      if (ud.type === 'face' || ud.type === 'edge' || ud.type === 'corner') {
        cubeSetHighlights(computeHighlights(ud.type, ud.faces));
      } else {
        cubeSetHighlights(null);
      }
      canvas.style.cursor = 'pointer';
    } else {
      cubeSetHighlights(null);
      canvas.style.cursor = 'grab';
    }
    miniRenderer.render(scene, miniCam);
  }

  function handleClick(e: PointerEvent): void {
    const hit = getFirstHit(e);
    if (!hit) return;
    const ud = hit.object.userData as HitUserData;
    if (ud.type === 'home') { onHome(); return; }
    if (ud.type === 'roll' && ud.rollDir) {
      const cam = getCamera(); const tgt = getTarget();
      const fwd = new THREE.Vector3().subVectors(tgt, cam.position).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(fwd, (ud.rollDir * Math.PI) / 2);
      const offset = cam.position.clone().sub(tgt);
      offset.applyQuaternion(q);
      onDirSnap(offset.normalize());
      return;
    }
    // faceNav arrows (front/back/left/right only — never top/bottom)
    if (ud.type === 'faceNav' && ud.navTarget) {
      if (onSnapToView) { onSnapToView(ud.navTarget as CanonicalViewId); return; }
      onFaceSnap(ud.navTarget);
      return;
    }
    if (ud.type === 'compass' && ud.cardinal) {
      onDirSnap(computeCompassDirection(ud.cardinal, getNorthAngleRad(), getCamera().position, getTarget()));
      return;
    }
    if (ud.type === 'face' && ud.faces.length === 1) {
      const faceIdx = ud.faces[0]!;
      if (onSnapToView) {
        const viewId = FACE_INDEX_TO_VIEW_ID[faceIdx];
        if (viewId) { onSnapToView(viewId); return; }
      }
      const mode = FACE_TO_PROJECTION[faceIdx];
      if (mode) { onFaceSnap(mode); return; }
    }
    if (ud.type === 'edge' || ud.type === 'corner') {
      const dir = computeDirection(ud.faces);
      if (onSnapToView) {
        const isoId = matchIsoCanonicalView(dir);
        if (isoId) { onSnapToView(isoId); return; }
      }
      onDirSnap(dir);
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true; isDragging = false;
    dragStartX = prevDragX = e.clientX;
    dragStartY = prevDragY = e.clientY;
  }

  function onPointerMove(e: PointerEvent): void {
    if (isPointerDown) {
      if (!isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
        isDragging = true;
        canvas.style.cursor = 'grabbing';
      }
      if (onDragRotate) onDragRotate(e.clientX - prevDragX, e.clientY - prevDragY);
      prevDragX = e.clientX;
      prevDragY = e.clientY;
      return;
    }
    updateHover(e);
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !isPointerDown) return;
    isPointerDown = false;
    e.stopPropagation();
    canvas.releasePointerCapture(e.pointerId);
    if (isDragging) { isDragging = false; canvas.style.cursor = hoveredMesh ? 'pointer' : 'grab'; return; }
    handleClick(e);
  }

  function onCanvasClick(e: MouseEvent): void { e.stopPropagation(); }

  function onCanvasContextMenu(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    onContextMenuRequest?.(e.clientX, e.clientY);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  canvas.addEventListener('mouseenter', () => { cubeHovered = true; });
  canvas.addEventListener('mouseleave', () => { cubeHovered = false; });

  const _q = new THREE.Quaternion();

  function sync(
    cam: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    _target: THREE.Vector3,
  ): void {
    cam.getWorldQuaternion(_q);
    cubeGroup.quaternion.copy(_q).conjugate();
    compassGroup.rotation.y = getNorthAngleRad();
    compassGroup.visible = compassVisibleState;
    const tgtAlpha = cubeHovered ? 1.0 : 0.5;
    const lerp = 0.15;
    for (const mat of cubeMaterials) { mat.opacity += (tgtAlpha - mat.opacity) * lerp; }
    outlineMat.opacity += ((cubeHovered ? 0.35 : 0.15) - outlineMat.opacity) * lerp;
    ringMaterial.opacity += ((cubeHovered ? 0.8 : 0.4) - ringMaterial.opacity) * lerp;
    homeSprite.visible = cubeHovered; homeHitMesh.visible = cubeHovered;
    for (const s of rollSprites) s.visible = cubeHovered;
    for (const hm of rollHitMeshes) hm.visible = cubeHovered;
    for (const child of faceNavGroup.children) child.visible = cubeHovered;
    for (const hm of faceNavHitMeshes) hm.visible = cubeHovered;
    const navAlpha = cubeHovered ? 0.7 : 0;
    for (const m of faceNavMats) m.opacity = navAlpha;
    miniRenderer.render(scene, miniCam);
  }

  function setCompassVisible(visible: boolean): void {
    compassVisibleState = visible;
    compassGroup.visible = visible;
    miniRenderer.render(scene, miniCam);
  }

  function dispose(): void {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('contextmenu', onCanvasContextMenu);
    cubeMesh.geometry.dispose();
    for (const mat of cubeMaterials) { mat.map?.dispose(); mat.dispose(); }
    for (const t of hitTargets) t.geometry.dispose();
    for (const hm of compassHitMeshes) hm.geometry.dispose();
    outlineGeo.dispose(); outlineMat.dispose();
    homeHitMesh.geometry.dispose();
    homeSprite.material.map?.dispose(); homeSprite.material.dispose();
    for (const s of rollSprites) { s.material.map?.dispose(); s.material.dispose(); }
    for (const hm of rollHitMeshes) hm.geometry.dispose();
    for (const hm of faceNavHitMeshes) hm.geometry.dispose();
    miniRenderer.dispose();
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
  }

  return { sync, setCompassVisible, dispose };
}
