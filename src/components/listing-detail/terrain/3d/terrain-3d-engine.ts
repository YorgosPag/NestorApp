/**
 * @fileoverview **Η ΜΗΧΑΝΗ ΤΟΥ ΘΕΑΤΗ ΕΔΑΦΟΥΣ** — renderer, τροχιά, κύβος, απόδοση μόνο όταν χρειάζεται (ADR-920 §14.5).
 * @related `terrain-3d-scene.ts` (τι ζωγραφίζεται) · `terrain-3d-camera.ts` (πού στέκεται η κάμερα) ·
 *   `terrain-3d-flight.ts` (οι πτήσεις) · `@/lib/three/view-cube/view-cube` (ο κύβος του viewer) ·
 *   `spatial-tour/viewer/tour-panorama-engine.ts` (ίδιο μοτίβο σε δημόσια σελίδα)
 * @module components/listing-detail/terrain/3d/terrain-3d-engine
 *
 * 🔑 **Καρέ μόνο όταν κάτι άλλαξε** (three.js manual, «Rendering on Demand»): το `change` του `OrbitControls` ζητά ΕΝΑ
 *   καρέ· μέσα στο καρέ το `controls.update()` συνεχίζει την αδράνεια και ξαναστέλνει `change` όσο η κάμερα κινείται.
 *   Ακίνητη σκηνή = μηδέν GPU, μηδέν μπαταρία.
 * 🔑 **Αφή όπως Sketchfab**: 1 δάχτυλο περιστροφή, 2 δάχτυλα μετατόπιση + τσίμπημα ζουμ (προεπιλογή `OrbitControls`).
 *   Η μετατόπιση γίνεται **πάνω στο έδαφος** (`screenSpacePanning = false`) και ο στόχος μένει μέσα στη σφαίρα του
 *   οικοπέδου (`cursor` + `maxTargetRadius`): δεν «χάνεις» ποτέ το οικόπεδο.
 * 🔑 **Ο κύβος του viewer, χωρίς δεύτερο WebGL context**: `sync` πριν από το καρέ, `composite()` στο τέλος (ADR-553).
 *   Χωρίς `onRoll`: η κύλιση γύρω από τον άξονα θέασης δεν έχει νόημα πάνω σε έδαφος.
 * ♿ Βέλη πληκτρολογίου μετακινούν τη σκηνή (`listenToKeyEvents`).
 * ⚠️ **Χαμένο πλαίσιο GPU** ⇒ `onContextLost`: ο καταναλωτής δείχνει ονομασμένη αποτυχία, ποτέ μαύρο κουτί.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { getCanonicalViewDef, HOME_CANONICAL_VIEW_ID } from '@/lib/three/view-cube/canonical-views';
import type { CanonicalViewId } from '@/lib/three/view-cube/canonical-view-types';
import { createViewCube, type ViewCubeEngine, type ViewCubeOptions } from '@/lib/three/view-cube/view-cube';
import type { Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

import {
  orbitAround,
  TERRAIN_3D_FOV_DEG,
  TERRAIN_3D_MAX_POLAR_RAD,
  terrainOrbitLimits,
  terrainPoseFor,
  type Terrain3dBounds,
  type TerrainPose,
} from './terrain-3d-camera';
import { createTerrain3dFlight, type Terrain3dFlight } from './terrain-3d-flight';
import { createTerrain3dScene, type Terrain3dScene } from './terrain-3d-scene';

/** Ανώτατη πυκνότητα pixel: πάνω από 2× ένα έδαφος λίγων χιλιάδων τριγώνων δεν κερδίζει τίποτα ορατό. */
const MAX_PIXEL_RATIO = 2;

export interface Terrain3dEngineOptions {
  readonly canvas: HTMLCanvasElement;
  /** Δοχείο (`position: relative`) όπου ο κύβος βάζει το επίπεδο αφής του. */
  readonly cubeHost: HTMLElement;
  readonly geometry: Terrain3dGeometry;
  readonly cubeLabels: ViewCubeOptions['labels'];
  readonly onContextLost: () => void;
}

export interface Terrain3dEngine {
  resize(widthCss: number, heightCss: number): void;
  /** Νέα γεωμετρία (υπερβολή): η κάμερα μένει όπου είναι, τα όρια ξαναϋπολογίζονται. */
  setGeometry(geometry: Terrain3dGeometry): void;
  /** Επαναφορά: ισομετρική ΒΑ όψη, όλο το οικόπεδο στην οθόνη. */
  home(): void;
  dispose(): void;
}

/** Τα κομμάτια της μηχανής που μοιράζονται οι βοηθοί της. */
interface Rig {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly terrain: Terrain3dScene;
  readonly flight: Terrain3dFlight;
  readonly request: () => void;
  bounds: Terrain3dBounds;
}

/** Το `toCamera` μιας κανονικής όψης (το `lookDir` του κύβου είναι κάμερα → στόχος). */
function toCameraOf(id: CanonicalViewId): THREE.Vector3 | null {
  const def = getCanonicalViewDef(id);
  return def ? new THREE.Vector3(...def.lookDir).negate() : null;
}

function poseToward(rig: Rig, toCamera: THREE.Vector3 | null): TerrainPose | null {
  return toCamera === null ? null : terrainPoseFor(toCamera, rig.bounds, rig.camera.aspect);
}

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = TERRAIN_3D_MAX_POLAR_RAD;
  controls.listenToKeyEvents(canvas);
  return controls;
}

function applyLimits(rig: Rig): void {
  const limits = terrainOrbitLimits(rig.bounds);
  rig.controls.cursor.copy(limits.centre);
  rig.controls.maxTargetRadius = limits.maxTargetRadius;
  rig.controls.minDistance = limits.minDistance;
  rig.controls.maxDistance = limits.maxDistance;
  rig.camera.near = limits.near;
  rig.camera.far = limits.far;
  rig.camera.updateProjectionMatrix();
}

function resizeRig(rig: Rig, widthCss: number, heightCss: number): void {
  const width = Math.max(1, widthCss);
  const height = Math.max(1, heightCss);
  rig.renderer.setSize(width, height, false);
  rig.camera.aspect = width / height;
  rig.camera.updateProjectionMatrix();
  rig.terrain.setLineResolution(width, height);
  rig.request();
}

/** Ο κύβος: κάθε όψη γίνεται πτήση (κλαδεμένη πάνω από τον ορίζοντα), η σύρση περιστρέφει γύρω από τον στόχο. */
function createTerrainCube(rig: Rig, host: HTMLElement, labels: ViewCubeOptions['labels']): ViewCubeEngine {
  const flyToward = (toCamera: THREE.Vector3 | null): void => rig.flight.flyTo(poseToward(rig, toCamera));
  return createViewCube({
    container: host,
    renderer: rig.renderer,
    onRenderNeeded: rig.request,
    getCamera: () => rig.camera,
    getTarget: () => rig.controls.target,
    onSnapToView: (id) => flyToward(toCameraOf(id)),
    // Με `onSnapToView` ο κύβος στέλνει κάθε όψη εκεί· αυτό μένει ως εφεδρεία του συμβολαίου του.
    onFaceSnap: (mode) => {
      if (mode !== 'perspective') flyToward(toCameraOf(mode));
    },
    // Το `dir` της πυξίδας είναι ήδη στόχος → κάμερα (ίδιο με το `snapToViewDirection` του viewer).
    onDirSnap: (dir) => flyToward(dir),
    onHome: () => rig.flight.flyTo(poseToward(rig, toCameraOf(HOME_CANONICAL_VIEW_ID))),
    onDragRotate: (dx, dy) => {
      if (rig.flight.isFlying()) return;
      const radPerPx = (2 * Math.PI) / Math.max(rig.canvas.clientHeight, 1);
      rig.camera.position.copy(orbitAround(rig.camera.position, rig.controls.target, dx * radPerPx, dy * radPerPx));
      rig.request();
    },
    getNorthAngleDeg: () => 0,
    labels,
  });
}

function createRig(options: Terrain3dEngineOptions, request: () => void): Rig {
  const camera = new THREE.PerspectiveCamera(TERRAIN_3D_FOV_DEG, 1, 0.1, 1000);
  const controls = createControls(camera, options.canvas);
  return {
    canvas: options.canvas,
    renderer: createRenderer(options.canvas),
    camera,
    controls,
    terrain: createTerrain3dScene(options.geometry),
    flight: createTerrain3dFlight({ camera, controls, onFrame: request }),
    request,
    bounds: options.geometry.bounds,
  };
}

/** Καρέ κατ' απαίτηση: πολλά αιτήματα στο ίδιο tick ⇒ ΕΝΑ καρέ. */
function createFrameScheduler(draw: () => void): { request: () => void; cancel: () => void } {
  let frame = 0;
  const run = (): void => {
    frame = 0;
    draw();
  };
  return {
    request: () => {
      if (frame === 0) frame = requestAnimationFrame(run);
    },
    cancel: () => {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

export function createTerrain3dEngine(options: Terrain3dEngineOptions): Terrain3dEngine {
  const scheduler = createFrameScheduler(() => draw());
  const rig = createRig(options, scheduler.request);
  const cube = createTerrainCube(rig, options.cubeHost, options.cubeLabels);
  const draw = (): void => {
    if (!rig.flight.isFlying()) rig.controls.update();
    cube.sync(rig.camera, rig.controls.target);
    rig.renderer.render(rig.terrain.scene, rig.camera);
    cube.composite();
  };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    options.onContextLost();
  };
  rig.controls.addEventListener('change', rig.request);
  rig.canvas.addEventListener('webglcontextlost', onContextLost);
  applyLimits(rig);
  resizeRig(rig, rig.canvas.clientWidth, rig.canvas.clientHeight);
  const initial = poseToward(rig, toCameraOf(HOME_CANONICAL_VIEW_ID));
  if (initial !== null) {
    rig.camera.position.copy(initial.position);
    rig.controls.target.copy(initial.target);
  }
  return {
    resize: (width, height) => resizeRig(rig, width, height),
    setGeometry: (geometry) => {
      rig.bounds = geometry.bounds;
      rig.terrain.replace(geometry);
      applyLimits(rig);
      rig.request();
    },
    home: () => rig.flight.flyTo(poseToward(rig, toCameraOf(HOME_CANONICAL_VIEW_ID))),
    dispose: () => disposeRig(rig, cube, scheduler.cancel, onContextLost),
  };
}

function disposeRig(rig: Rig, cube: ViewCubeEngine, cancelFrame: () => void, onContextLost: (event: Event) => void): void {
  rig.flight.cancel();
  cancelFrame();
  rig.canvas.removeEventListener('webglcontextlost', onContextLost);
  rig.controls.removeEventListener('change', rig.request);
  rig.controls.stopListenToKeyEvents();
  rig.controls.dispose();
  cube.dispose();
  rig.terrain.dispose();
  rig.renderer.dispose();
}
