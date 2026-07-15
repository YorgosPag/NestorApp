/**
 * scene-setup — Three.js bootstrap factories extracted from `ThreeJsSceneManager`
 * (ADR-366 Phase 4.4) to keep the manager under the 500-line cap. Pure functions,
 * no class state — call once during manager construction.
 */

import * as THREE from 'three';
import { createDesynchronizedWebglRenderer } from '../../rendering/webgl/desynchronized-webgl-renderer';
import { createViewportCamera } from '../viewport/viewport-camera';
import { createViewCube } from '../viewport/view-cube/view-cube';
import type { ViewportCamera, CanonicalViewId } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import type { CanonicalViewService } from '../viewport/CanonicalViewService';
import { checkReducedMotion, type ReducedMotionOverride } from '../accessibility/use-reduced-motion';

export interface SceneLights {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;
  readonly hemi: THREE.HemisphereLight;
}

export interface InitViewportCameraDeps {
  readonly rendererDomElement: HTMLCanvasElement;
  readonly initialPosition: THREE.Vector3;
  readonly initialTarget: THREE.Vector3;
  readonly onInteractionStart: () => void;
  readonly onInteractionEnd: () => void;
  /** ADR-040 Phase XXIII — fired by OrbitControls 'change' (covers damping inertia). */
  readonly onRenderNeeded: () => void;
  readonly getReducedMotionOverride: () => ReducedMotionOverride;
  /** ADR-366 §A.6.Q5 — static Alt+left-click → orbit-pivot pick (clientX, clientY). */
  readonly onAltClick: (clientX: number, clientY: number) => void;
  /** Alt+left pointer-down → orbit-pivot pick so the drag orbits around the cursor point. */
  readonly onAltPress: (clientX: number, clientY: number) => void;
  /** ADR-363 Φ1G.5 — geometry point under the cursor for the Revit surface-anchored wheel zoom. */
  readonly resolveSurfacePoint: (clientX: number, clientY: number) => THREE.Vector3 | null;
}

export function initViewportCamera(deps: InitViewportCameraDeps): ViewportCamera {
  return createViewportCamera(deps.rendererDomElement, {
    initialPosition: deps.initialPosition.clone(),
    initialTarget: deps.initialTarget.clone(),
    onRenderNeeded: deps.onRenderNeeded,
    onInteractionStart: deps.onInteractionStart,
    onInteractionEnd: deps.onInteractionEnd,
    getReducedMotion: () => checkReducedMotion(deps.getReducedMotionOverride()),
    onAltClick: deps.onAltClick,
    onAltPress: deps.onAltPress,
    resolveSurfacePoint: deps.resolveSurfacePoint,
  });
}

export interface InitViewCubeDeps {
  readonly container: HTMLElement;
  /** ADR-553 — main renderer; the ViewCube draws as a scissored sub-viewport of it (no 2nd context). */
  readonly renderer: THREE.WebGLRenderer;
  /** ADR-553 — request a main-loop frame (→ markSceneDirty) for cube hover/compass repaints. */
  readonly onRenderNeeded: () => void;
  readonly viewport: ViewportCamera;
  readonly canonicalViewService: CanonicalViewService;
  /**
   * Combined BIM∪DXF scene bounds (null when nothing framable yet). The HOME button
   * zoom-to-fits these so the whole drawing is always visible on screen.
   */
  readonly getSceneFramingBounds: () => THREE.Box3 | null;
  readonly onContextMenuRequest: (x: number, y: number) => void;
}

export function initViewCube(deps: InitViewCubeDeps): ViewCubeEngine {
  const { viewport, canonicalViewService } = deps;
  return createViewCube({
    container: deps.container,
    renderer: deps.renderer,
    onRenderNeeded: deps.onRenderNeeded,
    getCamera: () => viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
    getTarget: () => viewport.target,
    onFaceSnap: (mode) => viewport.setProjection(mode),
    onDirSnap: (dir) => viewport.snapToViewDirection(dir),
    onRoll: (dirSign) => viewport.rollView(dirSign),
    onSnapToView: (id: CanonicalViewId) => canonicalViewService.snapTo(id),
    // HOME — home isometric orientation + zoom-to-fit the whole drawing (Giorgio 2026-07-15).
    // Falls back to a plain re-orient when there is no framable geometry yet.
    onHome: () => {
      const bounds = deps.getSceneFramingBounds();
      if (bounds && !bounds.isEmpty()) viewport.frameHome(bounds.min, bounds.max);
      else canonicalViewService.snapHome();
    },
    onDragRotate: (dx, dy) => viewport.applyTumble(dx, dy),
    onContextMenuRequest: deps.onContextMenuRequest,
  });
}

/**
 * stencil:true required for ADR-366 §A.3 Phase 7.0a stencil cap pipeline.
 * (Three.js default is already true, set explicit για future-proofing.)
 */
/**
 * Live-viewport WebGL pixel ratio — SSoT for the `min(devicePixelRatio, 2)` clamp (ADR-549).
 * Clamped to 2: a tiny CAD scene (≈546 tris) gains nothing visible above 2× but pays quadratic
 * fill-rate on HiDPI. Shared by `createBimRenderer` and `ThreeJsSceneManager.syncDevicePixelRatio`
 * (the DPR-change handler) so the live ratio can never drift between init and re-sync.
 */
export function bimPixelRatio(): number {
  return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2);
}

export function createBimRenderer(container: HTMLElement): THREE.WebGLRenderer {
  // ADR-366 §B.5 (2026-06-28): antialias:TRUE — επαναφορά MSAA μετά από regression (Giorgio
  // «3D ποιότητα πολύ χαμηλή, ακμές blurry»). Round-1 το είχε σβήσει με λογική fill-rate, αλλά
  // η σκηνή είναι ΜΙΚΡΟΣΚΟΠΙΚΗ (546 τρίγωνα / 5 draw calls) → το MSAA είναι τετριμμένα φθηνό και
  // δίνει την καλύτερη ποιότητα ακμών. Big players σε τόσο μικρή σκηνή κρατούν crisp full-quality
  // viewport· το post-AA (FXAA/SMAA) θα πρόσθετε full-screen fill-rate + θόλωμα χωρίς λόγο εδώ.
  //
  // preserveDrawingBuffer:FALSE — true ανάγκαζε τον browser να ΑΝΤΙΓΡΑΦΕΙ (αντί swap) τον
  // drawing buffer ΚΑΘΕ καρέ (full-framebuffer cost που κλιμακώνεται με το μέγεθος παραθύρου).
  // Το χρειάζονταν μόνο 2 ΣΠΑΝΙΑ captures του ΚΥΡΙΟΥ renderer (HUD diagnostic screenshot +
  // path-tracer «Save Render»). Λύση χωρίς το per-frame κόστος:
  //   • path-tracer save → το capture γίνεται ΣΥΓΧΡΟΝΑ μέσα στο render tick (renderSample →
  //     onComplete → toBlob, πριν το compositing) → ο buffer είναι έγκυρος ΧΩΡΙΣ preserve.
  //   • HUD diagnostic (user click, εκτός loop) → `manager.captureFrameDataURL()` κάνει ένα
  //     force-render + toDataURL στο ΙΔΙΟ task.
  //   • MP4 export → δικός του renderer (MP4Exporter), ανεπηρέαστος.
  // ADR-549 Phase 5 — LOW-LATENCY PRESENTATION. Μετρημένο (641 samples): το residual cursor lag
  // ήταν σταθερό ~28ms present/compositor latency (input ~2ms, paint ~28ms) — δηλαδή GPU present
  // vsync-locked μέσω compositor, ΟΧΙ CPU/render/overlays. Big-player ισοδύναμο: ο `desynchronized`
  // hint αποσυνδέει το present του canvas από τον vsync-locked compositor (low-latency mode) — το
  // web-platform αντίστοιχο του native low-latency present (DXGI flip-model / waitable swap-chain)
  // που χρησιμοποιούν Revit & Cinema 4D, και ο `desynchronized` canvas που χρησιμοποιεί η Figma για
  // cursor/stylus latency. `powerPreference:'high-performance'` = πρακτική Autodesk Forge/APS &
  // Onshape (force discrete-GPU path). ΣΗΜΕΙΩΣΗ: το three r0.170 ΔΕΝ προωθεί το `desynchronized`
  // στο getContext (μόνο alpha/depth/stencil/antialias/premultipliedAlpha/preserveDrawingBuffer/
  // powerPreference/failIfMajorPerformanceCaveat). Γι' αυτό φτιάχνουμε ΕΜΕΙΣ το webgl2 context με
  // το flag και το περνάμε στον renderer μέσω της παραμέτρου `context`.
  // ADR-639 Στάδιο 5 — ο desynchronized webgl2 context + το belt-and-suspenders fallback
  // ζουν πλέον στο κοινό SSoT (`createDesynchronizedWebglRenderer`) ώστε ο BIM viewport και
  // το 2Δ DXF WebGL line layer να μη μπορούν ΠΟΤΕ να αποκλίνουν στα low-latency flags. Το
  // σκεπτικό (desynchronized low-latency present, discrete-GPU powerPreference, r0.170
  // getContext-forwarding gap) τεκμηριώνεται εκεί. Ο BIM κρατά stencil:true (stencil-cap pipeline).
  const renderer = createDesynchronizedWebglRenderer({ antialias: true, alpha: true, stencil: true });
  renderer.setPixelRatio(bimPixelRatio());
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  renderer.setClearColor(0x1a1a1a, 1);
  renderer.shadowMap.enabled = true;
  // PCF (single-tap) αντί PCFSoft (πολλαπλά taps ανά σκιασμένο pixel) = μείωση shadow
  // fill-rate, αμελητέα οπτική διαφορά σε CAD μοντέλο. (mapSize 2048→1024 στο createBimLights.)
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // ADR-366 §B.5 (2026-06-28) — autoUpdate:FALSE. Το BIM μοντέλο είναι ΣΤΑΤΙΚΟ σε ηρεμία, αλλά το
  // Three.js by-default ξαναχτίζει ΟΛΟ το shadow depth-map σε ΚΑΘΕ render όσο οι σκιές είναι ON.
  // Big-player practice (Three.js docs / iModel.js / Forge): render το shadow map ΜΟΝΟ on-demand.
  // Το `ShadowModulator` κάνει `needsUpdate=true` στο OFF→ON toggle (πρώτο crisp frame) και
  // `invalidateShadowMap()` καλείται στα geometry/light mutation SSoT (sync/sun/preset). Έτσι τα
  // επαναλαμβανόμενα at-rest renders (π.χ. hover σε διαφορετικά entities ενώ ακίνητος) ΔΕΝ
  // πληρώνουν περιττό depth-pass regen.
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);
  return renderer;
}

/**
 * Offscreen capture renderer SSoT (ADR-366 §B.5) — shared by the MP4 exporter
 * (`MP4Exporter.ts`) and the print/PDF 3D capture (`print/capture/capture-3d.ts`).
 *
 * Both genuinely need their OWN renderer (export resolution, and must not disturb
 * the live viewport — whose renderer runs `preserveDrawingBuffer:false`). The
 * INSTANCES are correct to be separate; what was duplicated was the IDENTICAL
 * construction (options + size + pixel-ratio + SRGB output + ACES tone mapping).
 * One source so export-image and video colour can never drift apart. Unlike the
 * interactive renderer, `preserveDrawingBuffer:true` IS required here: the capture
 * (`toDataURL`/`VideoFrame`) may read after the render task yields.
 */
export function createOffscreenCaptureRenderer(width: number, height: number): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}

/** Live viewport pixel size from the renderer canvas, with safe non-zero fallbacks. */
export function getRendererViewportSize(domElement: HTMLElement): { width: number; height: number } {
  return {
    width: domElement.clientWidth || 800,
    height: domElement.clientHeight || 600,
  };
}

export function createBimLights(): SceneLights {
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);

  const sun = new THREE.DirectionalLight(0xfffaf0, 3);
  sun.castShadow = true;
  sun.shadow.bias = -0.002;
  sun.shadow.normalBias = 0.1;
  // ADR-366 §B.5 perf — 1024 αντί 2048: 4× λιγότερα shadow texels → δραστική μείωση
  // shadow-pass fill-rate σε αδύναμη GPU, αμελητέα διαφορά σε CAD κλίμακα (browser-verified
  // fill-rate-bound). Ο QualityModulator ούτως ή άλλως πέφτει στα 1024 κατά την κίνηση.
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);

  return { sun, ambient, hemi };
}

/** Initialize scene with lights. Sets noon default sun position (ADR-366 §7.2). */
export function createBimScene(lights: SceneLights): THREE.Scene {
  const scene = new THREE.Scene();
  // ADR-452 — removed the debug `AxesHelper` (R/G/B lines at world origin). It sat
  // at (0,0,0) — away from the building when the model is offset from origin — and
  // read as a stray, unselectable "flying" sliver (Giorgio: «σκουπίδι στην αρχή των
  // αξόνων»). It was a leftover dev helper with no production purpose.
  scene.add(lights.ambient);
  scene.add(lights.sun);
  scene.add(lights.hemi);
  lights.sun.position.set(-5, 10, 5);
  return scene;
}
