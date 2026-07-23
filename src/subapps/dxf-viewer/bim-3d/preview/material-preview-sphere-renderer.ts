/**
 * MaterialPreviewSphereRenderer — SSoT mini-THREE sphere for the Material Editor
 * «Εμφάνιση» live preview (ADR-687 Φ1). The C4D Material Editor shows a real 3D
 * sphere of the material being authored; this renders exactly that from the SAME
 * `MeshStandardMaterial` the 3D viewport uses (`buildMat`), under the SAME lighting
 * rig (`createBimLights`) — so what the user sees on the sphere is what a painted
 * face will look like.
 *
 * Deliberately NOT the main `ThreeJsSceneManager` / `BimViewport3D` (the ADR-040
 * high-frequency path) — a self-contained, RENDER-ON-DEMAND scene (one frame per
 * material change, no RAF loop), a fixed 3/4 camera, shadows OFF. Same lightweight
 * philosophy as `BandStackPreviewRenderer` (the wall/slab «Edit Type» preview), but
 * a single sphere instead of a band stack.
 *
 * Lifecycle: construct → `setDef` (live colour/gloss/metalness change) → `resize`
 * → `dispose` (frees the WebGL context — browsers cap concurrent contexts).
 *
 * ADR-687 (realistic preview) — the sphere is lit like a big-player Material Editor
 * (Cinema 4D / Substance / Marmoset / Blender look-dev): a procedural **HDR studio
 * environment** (`buildStudioPreviewEnvTexture`, bright softbox panels on neutral grey)
 * drives image-based lighting (IBL) so metals/roughness show crisp reflective highlights
 * instead of a flat ambient blob, and **ACES filmic tone mapping** renders the HDR
 * reflections cinematically (no blown-out clipping). The Three.js lights are kept LOW and
 * only shape a subtle key — the environment is the primary light, which is what makes a
 * metal read as metal. PMREM textures are per-GL-context, so the preview owns its own
 * `EnvmapGenerator` instance (bound to the preview renderer+scene).
 *
 * @see ../materials/pbr-material-builder.ts — buildMat (the SOLE PBR face factory)
 * @see ../lighting/studio-preview-environment.ts — the procedural HDR studio env (SSoT)
 * @see ../lighting/envmap-generator.ts — applyEquirectEnvironment (PMREM SSoT)
 * @see ./band-stack-preview-renderer.ts — the sibling preview (band stack)
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import * as THREE from 'three';
import type { PbrMaterialDef } from '../../bim/materials/material-catalog-defs';
import { buildMat } from '../materials/pbr-material-builder';
import { createBimLights } from '../scene/scene-setup';
import { EnvmapGenerator } from '../lighting/envmap-generator';
import { buildStudioPreviewEnvTexture } from '../lighting/studio-preview-environment';
import { buildDiagonalStripeBackdropTexture } from './preview-backdrop-texture';

/** Fallback size before the container has laid out (matches the editor swatch box). */
const FALLBACK_PX = 160;

export class MaterialPreviewSphereRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly mesh: THREE.Mesh;
  /** Per-instance material (own clone from `buildMat`, never a catalog singleton). */
  private material: THREE.MeshStandardMaterial;
  /** Own env-map generator (PMREM is per-GL-context — cannot share the main scene's). */
  private readonly envmap: EnvmapGenerator;
  /** In-scene diagonal-stripe backdrop plane (behind the sphere; a transparent material reveals it). */
  private readonly backdrop: THREE.Mesh;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || FALLBACK_PX, container.clientHeight || FALLBACK_PX);
    this.renderer.setClearColor(0x1a1a1a, 1); // fallback dark — the in-scene stripe backdrop covers it
    // ACES filmic tone mapping (like the offscreen capture renderer + every big-player material
    // editor): maps the > 1 HDR studio softbox reflections into a cinematic range instead of
    // clipping them to flat white. sRGB output is the Three.js default; set explicitly for clarity.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // IBL-DOMINANT lighting (big-player material-editor practice): the HDR studio environment
    // below is the PRIMARY light. The Three.js lights are kept LOW — a dim ambient lift + a
    // soft key for a crisp specular streak — so the environment reflections dominate and the
    // surface reads as reflective. (Reuses the lighting SSoT `createBimLights`, then dials the
    // intensities down; hemi is dropped so it can't wash out the reflections. Shadows off.)
    const lights = createBimLights();
    lights.ambient.intensity = 0.18;
    lights.sun.intensity = 1.4;
    lights.sun.castShadow = false;
    lights.sun.position.set(2, 3, 4);
    this.scene.add(lights.ambient, lights.sun);

    // Procedural HDR studio environment → PMREM → `scene.environment` (IBL reflections). The
    // softbox panels (linear values > 1) give metals bright, filmic studio highlights under ACES.
    // Env-only (`scene.background` stays null; the visible backdrop is the stripe plane below).
    // Generated ONCE here (render-on-demand, no RAF loop); disposed with the generator below.
    this.envmap = new EnvmapGenerator(this.renderer, this.scene);
    this.envmap.applyEquirectEnvironment(buildStudioPreviewEnvTexture());

    // Diagonal light/dark grey stripe backdrop (the big-player «ριγωτό» / transparency checker),
    // rendered as an in-scene plane far behind the sphere. `MeshBasicMaterial` + `toneMapped:false`
    // → exact greys under ACES; `depthWrite:false` + far z → the sphere always draws in front, and
    // a transparent material composites over the stripes (opacity becomes readable). Guaranteed to
    // show (independent of canvas alpha / CSS). At z=-20 (25 from camera, fov 30°) a 20×20 plane
    // fills the square preview frame with margin.
    const backdropMat = new THREE.MeshBasicMaterial({
      map: buildDiagonalStripeBackdropTexture(),
      toneMapped: false,
      depthWrite: false,
    });
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), backdropMat);
    this.backdrop.position.set(0, 0, -20);
    this.backdrop.renderOrder = -1;
    this.scene.add(this.backdrop);

    // Fixed front view. Distance leaves a margin so the radius-1 sphere is FULLY in
    // frame (never cropped): at fov 30° the half-height is d·tan15°, so d=5 → 1.34,
    // i.e. the sphere fills ~75% of the frame with clear breathing room on all sides.
    this.camera = new THREE.PerspectiveCamera(30, this.aspect(), 0.01, 100);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    const geo = new THREE.SphereGeometry(1, 64, 48);
    this.material = buildMat({ color: 0xb0b0b0, roughness: 0.5, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(this.mesh);
    this.render();
  }

  /** Rebuild the preview material from a flat PBR def (live slider / colour change). */
  setDef(def: PbrMaterialDef): void {
    const next = buildMat(def);
    this.mesh.material = next;
    this.material.dispose(); // free the previous instance (own clone, safe to dispose)
    this.material = next;
    this.render();
  }

  /** Re-fit the renderer + camera to the container size. */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** Free the WebGL context + GPU resources. Call on unmount. */
  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.backdrop.geometry.dispose();
    const backdropMat = this.backdrop.material as THREE.MeshBasicMaterial;
    backdropMat.map?.dispose();
    backdropMat.dispose();
    this.envmap.dispose(); // frees the PMREM generator + env textures it owns
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private aspect(): number {
    const w = this.renderer.domElement.width || FALLBACK_PX;
    const h = this.renderer.domElement.height || FALLBACK_PX;
    return w / h;
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
