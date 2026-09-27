/**
 * @fileoverview **Η ΜΗΧΑΝΗ ΤΟΥ ΘΕΑΤΗ** — imperative three.js: κάμερα στο κέντρο, δύο κύβοι (τρέχων + επόμενος) για το
 * διασταυρούμενο σβήσιμο, απόδοση **κατ' απαίτηση** (ADR-884 Φ1 · §4.8 · Α2).
 * @related `tour-panorama-shader.ts` · `lib/spatial-tour/viewer/{tour-viewer-view,tour-viewer-transition}.ts` ·
 *   `TourPanoramaStage.tsx` (ο μόνος κάτοχος)
 * @module components/spatial-tour/viewer/tour-panorama-engine
 *
 * 🔑 **Μόνο ο πυρήνας του `three`** — κανένα addon, καμία εισαγωγή από το `dxf-viewer` (CHECK 3.62): φορτώνεται στη
 *   δημόσια αγγελία πίσω από `next/dynamic`.
 * 🔑 **Κανένα συνεχές RAF**: ένα καρέ ζητιέται όταν αλλάξει κάτι (θέαση · μέγεθος · σβήσιμο). Ένα πανόραμα που κανείς
 *   δεν κουνά δεν καίει μπαταρία — οι PSV/Pannellum αποδίδουν συνεχώς.
 * 🔑 **Κάθε πόρος έχει κάτοχο**: υφές ανά κύβο, απελευθέρωση στην αντικατάσταση και στο `dispose` (καμία διαρροή GPU
 *   σε 250 κόμβους).
 * 🔑 **Γωνίες**: `rotation.order = 'YXZ'`· δεξιόστροφα ⇒ `rotation.y = -γωνία` (το three στρέφει αριστερόστροφα).
 * 🔑 **Η κάμερα ζει στον κόσμο, κάθε κύβος στρέφεται κατά τη ΔΙΚΗ του κατεύθυνση λήψης** (`mesh.rotation.y = -heading`):
 *   δύο λήψεις με διαφορετικό «βορρά» σβήνουν η μία μέσα στην άλλη **ευθυγραμμισμένες** — ο επισκέπτης δεν βλέπει τον
 *   κόσμο να «πηδά» στη μέση της μετάβασης. Το `TourView.yaw` μένει σχετικό με τον **τρέχοντα** κύβο.
 */

import {
  BackSide, BoxGeometry, CanvasTexture, LinearFilter, Mesh, PerspectiveCamera, SRGBColorSpace, Scene, ShaderMaterial, Texture,
  Vector3, WebGLRenderer,
} from 'three';

import { normalizeAngleDiff, radToDeg } from '@/lib/geometry/angle';
import { createExternalStore } from '@/lib/state/createExternalStore';
import {
  directionToYawPitch, TOUR_CUBE_FACES, type TourCubeFace, yawPitchToDirection,
} from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourView } from '@/lib/spatial-tour/viewer/tour-viewer-view';

import type { TourCubeFaceImages } from './tour-panorama-source';
import { TOUR_FACE_UNIFORM, TOUR_PANORAMA_FRAGMENT_SHADER, TOUR_PANORAMA_VERTEX_SHADER } from './tour-panorama-shader';

/** Θέση στην οθόνη ενός σημείου του πανοράματος — `null` όταν είναι πίσω από τον θεατή ή εκτός κάδρου. */
export type ScreenPoint = { readonly x: number; readonly y: number } | null;

export interface TourPanoramaEngine {
  readonly maxFaceSize: number;
  setView(view: TourView): void;
  resize(widthCss: number, heightCss: number, pixelRatio: number): void;
  /** Αντικαθιστά ακαριαία τον τρέχοντα κύβο (`headingRad` = διόπτευση του κέντρου του πανοράματος). */
  showNow(faces: TourCubeFaceImages, headingRad: number): void;
  /** Ανάβει τον επόμενο κύβο πάνω από τον τρέχοντα με `opacity` 0‥1· στο 1 γίνεται ο τρέχων. */
  setIncoming(faces: TourCubeFaceImages, headingRad: number): void;
  setIncomingOpacity(opacity: number): void;
  commitIncoming(): void;
  /** Θέση στην οθόνη (CSS px) ενός yaw/κλίσης **του τρέχοντος κύβου** — για τα κουμπιά συνδέσμων πάνω από τον καμβά. */
  project(yaw: number, pitch: number): ScreenPoint;
  /** Το αντίστροφο: σημείο οθόνης (CSS px) → yaw/κλίση **του τρέχοντος κύβου** — το σύρσιμο βελακιού (Φ2δ, §4.10). */
  unproject(x: number, y: number): { readonly yaw: number; readonly pitch: number };
  /** Καλείται μετά από κάθε καρέ — ο κάτοχος ξαναβάζει τα κουμπιά στη θέση τους. */
  onFrame(listener: () => void): () => void;
  dispose(): void;
}

interface Cube {
  readonly mesh: Mesh<BoxGeometry, ShaderMaterial>;
  textures: Texture[];
  heading: number;
}

function makeCube(renderOrder: number): Cube {
  const uniforms: Record<string, { value: Texture | number | null }> = { opacity: { value: 1 } };
  for (const face of TOUR_CUBE_FACES) uniforms[TOUR_FACE_UNIFORM[face]] = { value: null };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: TOUR_PANORAMA_VERTEX_SHADER,
    fragmentShader: TOUR_PANORAMA_FRAGMENT_SHADER,
    transparent: renderOrder > 0,
    depthTest: false,
    depthWrite: false,
    side: BackSide, // ο θεατής είναι ΜΕΣΑ στον κύβο
  });
  const mesh = new Mesh(new BoxGeometry(2, 2, 2), material);
  mesh.renderOrder = renderOrder;
  mesh.visible = false;
  mesh.frustumCulled = false;
  return { mesh, textures: [], heading: 0 };
}

function faceTexture(image: TourCubeFaceImages[TourCubeFace]): Texture {
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function loadCube(cube: Cube, faces: TourCubeFaceImages | null, headingRad = 0): void {
  cube.heading = headingRad;
  cube.mesh.rotation.y = -headingRad;
  for (const texture of cube.textures) texture.dispose();
  cube.textures = [];
  cube.mesh.visible = faces !== null;
  if (faces === null) return;
  for (const face of TOUR_CUBE_FACES) {
    const texture = faceTexture(faces[face]);
    cube.textures.push(texture);
    cube.mesh.material.uniforms[TOUR_FACE_UNIFORM[face]].value = texture;
  }
}

function disposeCube(cube: Cube): void {
  loadCube(cube, null);
  cube.mesh.geometry.dispose();
  cube.mesh.material.dispose();
}

/** Όριο όψης: το όριο υφής της συσκευής, ποτέ πάνω από 2048 (περιθώριο για κινητά — ADR-884 §4.8). */
const FACE_SIZE_CEILING = 2048;

class ThreeTourPanoramaEngine implements TourPanoramaEngine {
  readonly maxFaceSize: number;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(65, 1, 0.1, 10);
  private current = makeCube(0);
  private incoming = makeCube(1);
  /** Αριθμός καρέ — οι ακροατές `onFrame` είναι συνδρομητές του (το ΕΝΑ pub/sub primitive, CHECK 3.7). */
  private readonly frames = createExternalStore(0);
  private readonly probe = new Vector3();
  private frame = 0;
  private size = { width: 1, height: 1 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
    this.maxFaceSize = Math.min(FACE_SIZE_CEILING, this.renderer.capabilities.maxTextureSize);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.current.mesh, this.incoming.mesh);
  }

  private readonly render = (): void => {
    this.frame = 0;
    this.renderer.render(this.scene, this.camera);
    this.frames.set(this.frames.get() + 1);
  };

  private request(): void {
    if (this.frame === 0) this.frame = requestAnimationFrame(this.render);
  }

  setView(view: TourView): void {
    this.camera.rotation.set(view.pitch, -(this.current.heading + view.yaw), 0);
    this.camera.fov = radToDeg(view.fov);
    this.camera.updateProjectionMatrix();
    this.request();
  }

  resize(widthCss: number, heightCss: number, pixelRatio: number): void {
    this.size = { width: Math.max(1, widthCss), height: Math.max(1, heightCss) };
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.size.width, this.size.height, false);
    this.camera.aspect = this.size.width / this.size.height;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  showNow(faces: TourCubeFaceImages, headingRad: number): void {
    loadCube(this.current, faces, headingRad);
    loadCube(this.incoming, null);
    this.request();
  }

  setIncoming(faces: TourCubeFaceImages, headingRad: number): void {
    loadCube(this.incoming, faces, headingRad);
    this.incoming.mesh.material.uniforms.opacity.value = 0;
    this.request();
  }

  setIncomingOpacity(opacity: number): void {
    this.incoming.mesh.material.uniforms.opacity.value = opacity;
    this.request();
  }

  commitIncoming(): void {
    [this.current, this.incoming] = [this.incoming, this.current];
    setLayer(this.current, 0);
    setLayer(this.incoming, 1);
    loadCube(this.incoming, null);
    this.request();
  }

  project(yaw: number, pitch: number): ScreenPoint {
    const d = yawPitchToDirection(this.current.heading + yaw, pitch);
    const p = this.probe.set(d.x, d.y, d.z).project(this.camera);
    if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
    return { x: ((p.x + 1) / 2) * this.size.width, y: ((1 - p.y) / 2) * this.size.height };
  }

  unproject(x: number, y: number): { readonly yaw: number; readonly pitch: number } {
    // Η κάμερα κάθεται στο κέντρο: το σημείο στο μέσο βάθος του κόλουρου ΕΙΝΑΙ η κατεύθυνση της ακτίνας.
    const ndcX = (x / this.size.width) * 2 - 1;
    const ndcY = 1 - (y / this.size.height) * 2;
    const { yaw, pitch } = directionToYawPitch(this.probe.set(ndcX, ndcY, 0.5).unproject(this.camera));
    return { yaw: normalizeAngleDiff(yaw - this.current.heading), pitch };
  }

  onFrame(listener: () => void): () => void {
    return this.frames.subscribe(listener);
  }

  dispose(): void {
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frames.reset(0);
    disposeCube(this.current);
    disposeCube(this.incoming);
    this.renderer.dispose();
  }
}

/** Στρώση κύβου: 0 = τρέχων (αδιαφανής), 1 = επόμενος (σβήνει-ανάβει από πάνω). */
function setLayer(cube: Cube, layer: 0 | 1): void {
  cube.mesh.renderOrder = layer;
  cube.mesh.material.transparent = layer === 1;
  cube.mesh.material.uniforms.opacity.value = layer === 0 ? 1 : 0;
}

/** Η μηχανή πάνω σε έναν καμβά — ο κάτοχος καλεί `dispose` στην αποπροσάρτηση. */
export function createTourPanoramaEngine(canvas: HTMLCanvasElement): TourPanoramaEngine {
  return new ThreeTourPanoramaEngine(canvas);
}
