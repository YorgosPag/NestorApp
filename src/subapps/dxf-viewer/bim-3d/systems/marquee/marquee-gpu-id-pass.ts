/**
 * marquee-gpu-id-pass.ts — GPU id-picking pass: ΠΟΙΕΣ BIM οντότητες είναι ΠΡΑΓΜΑΤΙΚΑ ΟΡΑΤΕΣ
 * μέσα στο ορθογώνιο του marquee (ADR-692 Φ2, «visible-only» / X-ray off).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ: το CPU test (`marquee-3d-hit-test`) είναι occlusion-agnostic — προβάλλει το
 * AABB κάθε οντότητας και ρωτά «πέφτει στο κουτί;». Ένας τοίχος πίσω από άλλον τοίχο περνάει.
 * Αυτό είναι το σωστό CAD default (select-through, AutoCAD/Revit), αλλά όταν ο χρήστης θέλει
 * «μόνο ό,τι βλέπω», η ΜΟΝΗ σωστή απάντηση είναι pixel-exact — δηλαδή να ρωτήσουμε τον
 * rasterizer, όχι να «μαντέψουμε» με raycasts ανά οντότητα.
 *
 * ΠΩΣ: κάθε οντότητα παίρνει έναν 24-bit ακέραιο δείκτη κωδικοποιημένο ως RGB. Ζωγραφίζουμε
 * το BIM subtree με αυτά τα flat χρώματα (depth-test ΚΑΝΟΝΙΚΟ) σε render target και διαβάζουμε
 * πίσω τα pixel: ό,τι δείκτης επέζησε του depth test ΕΙΝΑΙ ορατός. Ό,τι δεν είναι BIM
 * (helpers, ακμές, γραμμές) βάφεται μαύρο (δείκτης 0) — συνεχίζει να ΚΡΥΒΕΙ, αλλά δεν
 * αποκωδικοποιείται ποτέ ως οντότητα.
 *
 * ΑΠΟΔΟΣΗ / ADR-040: τρέχει ΜΟΝΟ on-demand στο mouseup — ΠΟΤΕ per-frame. Το readback είναι
 * σύγχρονο (ένα stall), αποδεκτό μία φορά ανά χειρονομία· async PBO/fenceSync = Φ3.
 * Ο στόχος καλύπτει ΜΟΝΟ το ορθογώνιο (μέσω `camera.setViewOffset`) και είναι capped σε
 * {@link MAX_ID_PASS_AXIS_PX} ανά άξονα, άρα το readback είναι σταθερά μικρό ανεξάρτητα από
 * το πόσο μεγάλο drag έκανε ο χρήστης.
 *
 * ΓΝΩΣΤΑ ΟΡΙΑ (τεκμηριωμένα, ΟΧΙ σιωπηλά): (α) το raw DXF wireframe ΔΕΝ μπαίνει στο pass —
 * γραμμές 1px δεν κρύβουν και δεν κρύβονται αξιόπιστα σε id buffer, οπότε μένει select-through·
 * (β) τα per-material section clipping planes δεν αντιγράφονται στα id materials, άρα γεωμετρία
 * κομμένη από τομή μετράει ως ορατή· (γ) σε πολύ μεγάλο drag το downsampling μπορεί να χάσει
 * οντότητα λεπτότερη από ένα pixel του στόχου.
 */

import * as THREE from 'three';
import { ensureSizedRenderTarget } from '../../scene/sized-render-target';
import { resolveBimTag } from './marquee-3d-hit-test';
import type { ScreenRect } from './marquee-screen-geometry';

/** Ανώτατη ανάλυση του id στόχου ανά άξονα (device px) → σταθερό κόστος readback. */
export const MAX_ID_PASS_AXIS_PX = 1024;

/** Πάνω από αυτό, ο cache των id υλικών αδειάζει (πολύ μεγάλο μοντέλο· κρατά τη μνήμη φραγμένη). */
const MAX_CACHED_ID_MATERIALS = 4096;

export interface MarqueeIdPassInput {
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  /** `manager.bimLayer.group` — το ίδιο tagged subtree που διαβάζει το CPU test. */
  group: THREE.Object3D;
  /** Το WebGL canvas, για το client-rect. */
  canvas: HTMLElement;
  /** Το ορθογώνιο του marquee σε CLIENT px. */
  rect: ScreenRect;
}

// ── Module-level, επαναχρησιμοποιούμενοι πόροι (μηδέν alloc ανά χειρονομία) ────
let _rt: THREE.WebGLRenderTarget | null = null;
let _pixels = new Uint8Array(0);
const _idMaterials = new Map<number, THREE.MeshBasicMaterial>();
const _prevClearColor = new THREE.Color();

/** Το «δεν είναι οντότητα» υλικό: μαύρο (δείκτης 0) — κρύβει, δεν αποκωδικοποιείται. */
const _zeroMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000, side: THREE.DoubleSide, toneMapped: false, fog: false,
});

/**
 * Flat υλικό που κωδικοποιεί έναν 24-bit δείκτη ως RGB.
 * `setRGB(..., LinearSRGBColorSpace)` + linear render target ⇒ τα bytes επιστρέφουν ΑΚΡΙΒΩΣ
 * όπως γράφτηκαν (χωρίς sRGB μετασχηματισμό που θα χαλούσε την αποκωδικοποίηση).
 */
function idMaterial(index: number): THREE.MeshBasicMaterial {
  const cached = _idMaterials.get(index);
  if (cached) return cached;
  if (_idMaterials.size >= MAX_CACHED_ID_MATERIALS) {
    for (const mat of _idMaterials.values()) mat.dispose();
    _idMaterials.clear();
  }
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false, fog: false });
  material.color.setRGB(
    ((index >> 16) & 0xff) / 255,
    ((index >> 8) & 0xff) / 255,
    (index & 0xff) / 255,
    THREE.LinearSRGBColorSpace,
  );
  _idMaterials.set(index, material);
  return material;
}

/** Ένα αντικείμενο του γράφου με υλικό — Mesh, Line, LineSegments, Points, Sprite. */
interface MaterialHolder extends THREE.Object3D {
  material: THREE.Material | THREE.Material[];
}

function hasMaterial(obj: THREE.Object3D): obj is MaterialHolder {
  return (obj as Partial<MaterialHolder>).material !== undefined;
}

/**
 * Βάψε ΟΛΟ το subtree με id υλικά. Επιστρέφει τα σωσμένα υλικά (για επαναφορά) και τη
 * λίστα δεικτών → bimId. Ο δείκτης 0 μένει ελεύθερος για «τίποτα».
 */
function paintIds(group: THREE.Object3D): {
  saved: Array<[MaterialHolder, THREE.Material | THREE.Material[]]>;
  idByIndex: string[];
} {
  const saved: Array<[MaterialHolder, THREE.Material | THREE.Material[]]> = [];
  const indexById = new Map<string, number>();
  const idByIndex: string[] = ['']; // θέση 0 = background

  group.traverse((obj) => {
    if (!hasMaterial(obj)) return;
    saved.push([obj, obj.material]);
    const tag = (obj as THREE.Mesh).isMesh ? resolveBimTag(obj) : null;
    if (!tag) {
      obj.material = _zeroMaterial; // κρύβει κανονικά, αλλά δεν είναι οντότητα
      return;
    }
    let index = indexById.get(tag.id);
    if (index === undefined) {
      index = idByIndex.length;
      idByIndex.push(tag.id);
      indexById.set(tag.id, index);
    }
    obj.material = idMaterial(index);
  });

  return { saved, idByIndex };
}

/**
 * Το ορθογώνιο σε συντεταγμένες canvas (CSS px), κομμένο στα όρια του canvas. Null αν εκφυλισμένο.
 * Εξαγόμενο για unit test: η μετατροπή client→canvas ήταν ακριβώς το σημείο που ένα λάθος
 * πρόσημο δίνει «διάλεξε λάθος περιοχή» χωρίς κανένα ορατό σφάλμα.
 */
export function clipRectToCanvas(
  rect: ScreenRect,
  canvasRect: DOMRect,
): { x: number; y: number; width: number; height: number } | null {
  const x0 = Math.max(0, Math.min(rect.min.x, rect.max.x) - canvasRect.left);
  const y0 = Math.max(0, Math.min(rect.min.y, rect.max.y) - canvasRect.top);
  const x1 = Math.min(canvasRect.width, Math.max(rect.min.x, rect.max.x) - canvasRect.left);
  const y1 = Math.min(canvasRect.height, Math.max(rect.min.y, rect.max.y) - canvasRect.top);
  const width = x1 - x0;
  const height = y1 - y0;
  return width >= 1 && height >= 1 ? { x: x0, y: y0, width, height } : null;
}

/** Η ανάλυση του στόχου για ένα CSS-px ορθογώνιο: device px, capped ανά άξονα. */
export function idPassTargetSize(width: number, height: number, pixelRatio: number): { w: number; h: number } {
  return {
    w: Math.max(1, Math.min(MAX_ID_PASS_AXIS_PX, Math.round(width * pixelRatio))),
    h: Math.max(1, Math.min(MAX_ID_PASS_AXIS_PX, Math.round(height * pixelRatio))),
  };
}

/** Ο τρέχων view offset της κάμερας (αν υπάρχει), ώστε το pass να τον επαναφέρει ΑΚΡΙΒΩΣ. */
type ViewOffsetCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

function asViewOffsetCamera(camera: THREE.Camera): ViewOffsetCamera | null {
  return camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera
    ? camera
    : null;
}

function restoreViewOffset(camera: ViewOffsetCamera, view: ViewOffsetCamera['view']): void {
  if (view && view.enabled) {
    camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height);
  } else {
    camera.clearViewOffset();
  }
}

/**
 * Τα bimIds που έχουν ΕΣΤΩ ΕΝΑ ορατό pixel μέσα στο ορθογώνιο.
 *
 * `null` σημαίνει «δεν μπόρεσα να αποφανθώ» (μη υποστηριζόμενη κάμερα ή εκφυλισμένο
 * ορθογώνιο) — ο καλών ΠΡΕΠΕΙ τότε να πέσει πίσω σε select-through αντί να επιστρέψει
 * κενή επιλογή (σιωπηλό «δεν βρέθηκε τίποτα» θα ήταν χειρότερο από το CAD default).
 */
export function collectVisibleBimIdsInRect(input: MarqueeIdPassInput): Set<string> | null {
  const { renderer, group, canvas, rect } = input;
  const camera = asViewOffsetCamera(input.camera);
  if (!camera) return null;

  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width < 1 || canvasRect.height < 1) return null;
  const clipped = clipRectToCanvas(rect, canvasRect);
  if (!clipped) return null;

  const { w, h } = idPassTargetSize(clipped.width, clipped.height, renderer.getPixelRatio());
  _rt = ensureSizedRenderTarget(_rt, w, h, (cw, ch) => new THREE.WebGLRenderTarget(cw, ch, {
    depthBuffer: true,
    // Γραμμικός στόχος ⇒ κανένας μετασχηματισμός χρώματος στην έξοδο (τα bytes = οι δείκτες).
    colorSpace: THREE.NoColorSpace,
  }));

  const { saved, idByIndex } = paintIds(group);
  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  const prevView = camera.view ? { ...camera.view } : null;
  renderer.getClearColor(_prevClearColor);
  const prevClearAlpha = renderer.getClearAlpha();

  try {
    // Ζωγράφισε ΜΟΝΟ την περιοχή του marquee μέσα σε ολόκληρο τον στόχο.
    camera.setViewOffset(
      canvasRect.width, canvasRect.height,
      clipped.x, clipped.y, clipped.width, clipped.height,
    );
    renderer.setRenderTarget(_rt);
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(group, camera);

    const needed = w * h * 4;
    if (_pixels.length < needed) _pixels = new Uint8Array(needed);
    renderer.readRenderTargetPixels(_rt, 0, 0, w, h, _pixels);
  } finally {
    for (const [obj, material] of saved) obj.material = material;
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(_prevClearColor, prevClearAlpha);
    restoreViewOffset(camera, prevView);
  }

  return decodeVisibleIds(_pixels, w * h, idByIndex);
}

/** Αποκωδικοποίηση του id buffer → σύνολο bimIds (δείκτης 0 = τίποτα). */
export function decodeVisibleIds(
  pixels: Uint8Array,
  pixelCount: number,
  idByIndex: readonly string[],
): Set<string> {
  const visible = new Set<string>();
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const index = (pixels[o] << 16) | (pixels[o + 1] << 8) | pixels[o + 2];
    if (index === 0) continue;
    const id = idByIndex[index];
    if (id) visible.add(id);
  }
  return visible;
}

/** Απελευθέρωση των GPU πόρων του pass (κλείσιμο 3D viewport). */
export function disposeMarqueeIdPass(): void {
  _rt?.dispose();
  _rt = null;
  _pixels = new Uint8Array(0);
  for (const material of _idMaterials.values()) material.dispose();
  _idMaterials.clear();
}
