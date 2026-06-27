/**
 * grip-3d-depth-occluder.ts — GPU depth-occlusion for the 3D reshape-grip overlay
 * (ADR-535 Φ5b). Revit / Maxon (Cinema 4D) grade: a grip hidden behind a solid surface
 * (another entity OR the selected entity's own body) is culled from the draw AND the pick.
 *
 * The grips stay a Canvas2D overlay drawn with the ONE 2D `UnifiedGripRenderer` (Φ5 SSoT —
 * no second renderer). Occlusion is resolved on the GPU, never CPU-raycast:
 *   1. Depth pre-pass — render the SOLID scene depth into a `DepthTexture` (non-solid line /
 *      point / sprite primitives are hidden so only real surfaces occlude). One cheap
 *      colour-less render.
 *   2. Probe pass — render the N grips as 1px `Points` into an N×1 target; each fragment
 *      samples the scene depth at the grip's screen UV and compares eye-space Z with a mm
 *      bias (the SAME rule as `isGripOccluded`). The depth→view-Z math reuses Three.js'
 *      own `perspectiveDepthToViewZ` (`#include <packing>`) — zero hand-rolled depth formula.
 *   3. Read-back — N RGBA bytes → per-grip visibility.
 *
 * Recompute is CACHED: it only re-runs when the camera or the grip set changes, so a static
 * selection (or an in-progress drag, camera frozen) costs nothing. The depth math is unit
 * tested via the pure `grip-3d-depth-occlusion-math` slice; this class is the THREE plumbing.
 */

import * as THREE from 'three';
import {
  projectGripToProbe,
  decodeGripVisibility,
  probeSlotClipX,
} from './grip-3d-depth-occlusion-math';

/** Occlusion bias (metres ≈ 5 mm) — absorbs the coplanar self-surface case (Φ5b §6 trap 1). */
const OCCLUSION_BIAS_M = 0.005;

const PROBE_VERTEX_SHADER = /* glsl */ `
  attribute vec2 aUv;
  attribute float aViewZ;
  varying vec2 vUv;
  varying float vViewZ;
  void main() {
    vUv = aUv;
    vViewZ = aViewZ;
    // position.x already holds the slot's clip-space X (pixel column); 1px point.
    gl_Position = vec4( position.x, 0.0, 0.0, 1.0 );
    gl_PointSize = 1.0;
  }
`;

const PROBE_FRAGMENT_SHADER = /* glsl */ `
  #include <packing>
  uniform sampler2D tDepth;
  uniform float uNear;
  uniform float uFar;
  uniform float uBias;
  varying vec2 vUv;
  varying float vViewZ;
  void main() {
    float depth = texture2D( tDepth, vUv ).x;
    float sceneViewZ = perspectiveDepthToViewZ( depth, uNear, uFar );
    // Occluded only when the grip sits at least uBias BEHIND the nearest surface.
    float visible = ( vViewZ < sceneViewZ - uBias ) ? 0.0 : 1.0;
    gl_FragColor = vec4( visible, 0.0, 0.0, 1.0 );
  }
`;

/** Non-solid primitives that must NOT occlude grips (edges / wireframes / labels). */
function isNonSolidPrimitive(obj: THREE.Object3D): boolean {
  return (
    obj instanceof THREE.Line ||
    obj instanceof THREE.LineSegments ||
    obj instanceof THREE.Points ||
    obj instanceof THREE.Sprite ||
    // ADR-537 β — flat DXF text-annotation planes are labels, not solids: they must not occlude
    // grips (a coplanar text quad would otherwise cull its own centre grip at grazing angles).
    obj.userData?.isDxfAnnotation === true
  );
}

export class GripDepthOccluder {
  private depthRT: THREE.WebGLRenderTarget | null = null;
  private probeRT: THREE.WebGLRenderTarget | null = null;
  private readonly depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
  private readonly probeScene = new THREE.Scene();
  private readonly probeCamera = new THREE.Camera();
  private readonly probeMaterial: THREE.ShaderMaterial;
  private probeGeometry: THREE.BufferGeometry | null = null;
  private probePoints: THREE.Points | null = null;

  private readonly drawSize = new THREE.Vector2();
  private capacity = 0;
  private readBuf = new Uint8Array(0);
  private offscreen: boolean[] = [];

  // Recompute cache — skip the GPU work while the camera + grip set are unchanged.
  private readonly cachedView = new THREE.Matrix4();
  private readonly cachedProj = new THREE.Matrix4();
  private cachedCount = -1;
  private lastVisible: boolean[] = [];

  constructor() {
    this.probeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: null },
        uNear: { value: 0.1 },
        uFar: { value: 1000 },
        uBias: { value: OCCLUSION_BIAS_M },
      },
      vertexShader: PROBE_VERTEX_SHADER,
      fragmentShader: PROBE_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Per-grip visibility (true = draw + pickable). `worlds[i]` is grip `i`'s world position
   * (footprint, not the live-dragged point — the caller keeps the dragged square visible).
   * Returns all-visible for a non-perspective camera (ortho views skip occlusion) or before
   * the first probe. CACHED on the camera + grip count, so a frozen view costs nothing.
   */
  computeVisibility(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    worlds: readonly THREE.Vector3[],
  ): boolean[] {
    const n = worlds.length;
    if (n === 0) return (this.lastVisible = []);
    if (!(camera instanceof THREE.PerspectiveCamera)) return new Array(n).fill(true);
    if (this.isCacheValid(camera, n)) return this.lastVisible;

    this.ensureCapacity(renderer, n);
    this.renderDepthPrepass(renderer, scene, camera);
    this.fillProbeAttributes(camera, worlds);
    this.runProbe(renderer, camera, n);
    this.updateCache(camera, n);
    return this.lastVisible;
  }

  // ── recompute cache ──────────────────────────────────────────────────────────
  private isCacheValid(camera: THREE.PerspectiveCamera, n: number): boolean {
    return (
      n === this.cachedCount &&
      this.cachedView.equals(camera.matrixWorldInverse) &&
      this.cachedProj.equals(camera.projectionMatrix) &&
      this.lastVisible.length === n
    );
  }

  private updateCache(camera: THREE.PerspectiveCamera, n: number): void {
    this.cachedView.copy(camera.matrixWorldInverse);
    this.cachedProj.copy(camera.projectionMatrix);
    this.cachedCount = n;
  }

  // ── depth pre-pass ───────────────────────────────────────────────────────────
  private renderDepthPrepass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    const depthRT = this.ensureDepthTarget(renderer);
    const hidden = this.hideNonSolids(scene);
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = scene.overrideMaterial;
    scene.overrideMaterial = this.depthMaterial;
    renderer.setRenderTarget(depthRT);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    scene.overrideMaterial = prevOverride;
    renderer.setRenderTarget(prevTarget);
    for (const obj of hidden) obj.visible = true;
  }

  private hideNonSolids(scene: THREE.Scene): THREE.Object3D[] {
    const hidden: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.visible && isNonSolidPrimitive(obj)) {
        obj.visible = false;
        hidden.push(obj);
      }
    });
    return hidden;
  }

  // ── probe pass ───────────────────────────────────────────────────────────────
  private fillProbeAttributes(camera: THREE.PerspectiveCamera, worlds: readonly THREE.Vector3[]): void {
    const geom = this.probeGeometry;
    if (!geom) return;
    const uv = geom.getAttribute('aUv') as THREE.BufferAttribute;
    const vz = geom.getAttribute('aViewZ') as THREE.BufferAttribute;
    for (let i = 0; i < worlds.length; i++) {
      const s = projectGripToProbe(worlds[i], camera);
      uv.setXY(i, s.u, s.v);
      vz.setX(i, s.viewZ);
      this.offscreen[i] = s.offscreen;
    }
    uv.needsUpdate = true;
    vz.needsUpdate = true;
  }

  private runProbe(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, n: number): void {
    const probeRT = this.probeRT;
    const depthRT = this.depthRT;
    if (!probeRT || !depthRT) return;
    const u = this.probeMaterial.uniforms;
    u['tDepth'].value = depthRT.depthTexture;
    u['uNear'].value = camera.near;
    u['uFar'].value = camera.far;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(probeRT);
    renderer.clear(true, false, false);
    renderer.render(this.probeScene, this.probeCamera);
    renderer.readRenderTargetPixels(probeRT, 0, 0, n, 1, this.readBuf);
    renderer.setRenderTarget(prevTarget);
    this.lastVisible = decodeGripVisibility(this.readBuf, n, this.offscreen);
  }

  // ── lazy GPU resources ───────────────────────────────────────────────────────
  private ensureDepthTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
    const size = renderer.getDrawingBufferSize(this.drawSize);
    const w = Math.max(1, Math.floor(size.x));
    const h = Math.max(1, Math.floor(size.y));
    if (!this.depthRT) {
      const rt = new THREE.WebGLRenderTarget(w, h);
      rt.depthTexture = new THREE.DepthTexture(w, h);
      this.depthRT = rt;
    } else if (this.depthRT.width !== w || this.depthRT.height !== h) {
      this.depthRT.setSize(w, h);
    }
    return this.depthRT;
  }

  private ensureCapacity(renderer: THREE.WebGLRenderer, n: number): void {
    if (n === this.capacity && this.probeGeometry) return;
    this.disposeProbe();
    this.capacity = n;
    this.readBuf = new Uint8Array(n * 4);
    this.offscreen = new Array(n).fill(false);
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) positions[i * 3] = probeSlotClipX(i, n);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    geom.setAttribute('aViewZ', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.probeGeometry = geom;
    this.probePoints = new THREE.Points(geom, this.probeMaterial);
    this.probePoints.frustumCulled = false;
    this.probeScene.add(this.probePoints);
    this.probeRT = new THREE.WebGLRenderTarget(n, 1, { depthBuffer: false, stencilBuffer: false });
  }

  private disposeProbe(): void {
    if (this.probePoints) this.probeScene.remove(this.probePoints);
    this.probePoints = null;
    this.probeGeometry?.dispose();
    this.probeGeometry = null;
    this.probeRT?.dispose();
    this.probeRT = null;
  }

  /** Release all GPU resources (overlay unmount). */
  dispose(): void {
    this.disposeProbe();
    this.depthRT?.depthTexture?.dispose();
    this.depthRT?.dispose();
    this.depthRT = null;
    this.depthMaterial.dispose();
    this.probeMaterial.dispose();
    this.cachedCount = -1;
    this.lastVisible = [];
  }
}
