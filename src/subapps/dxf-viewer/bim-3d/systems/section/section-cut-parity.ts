/**
 * section-cut-parity — stencil-parity strategies + dev diagnostic for the axis-cut caps.
 *
 * Extracted from `section-stencil-renderer.ts` (Google file-size SSoT, N.7.1). Owns the two
 * parity strategies a cut-section cap can use (ADR-452 v2.22) plus the dev-only cap diagnostic.
 *
 * @see ADR-452 — cut-plane caps
 */

import * as THREE from 'three';

/** Parity strategy for one cut-section cap pass. */
export type ParityMode = 'single' | 'twopass';

const CAP_DEBUG_COLOR = 0xff00ff;
let lastCapDebugLogMs = 0;

/**
 * ADR-452 v2.22 — dev-only visual diagnostic. With `localStorage['dxf-section-cap-debug'] = '1'`
 * the grey base cap is drawn magenta, depthTest-OFF AND stencil-test OFF, so the cap quad FLOODS
 * magenta over the whole cut plane REGARDLESS of parity/depth. That separates the failure modes
 * that all look like «γκρι φέτες»: a magenta flood ⇒ the cap path runs (the fault is parity/position);
 * NO magenta at all ⇒ the frame never reaches this cap path. Inert in production / when the flag is
 * unset. (This is the diagnostic that pinned the v2.22 world-origin-anchor bug.)
 */
export function isSectionCapDebug(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('dxf-section-cap-debug') === '1'
  );
}

/** Throttled breadcrumb proving `renderAxisCutCap` actually runs this frame (see isSectionCapDebug). */
function logCapDebugOnce(quality: string): void {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  if (now - lastCapDebugLogMs < 500) return;
  lastCapDebugLogMs = now;
  // eslint-disable-next-line no-console
  console.log('[section-cap v2.22] renderAxisCutCap running — quality:', quality);
}

/**
 * Apply the dev diagnostic state to the grey base cap material for this frame (idempotent — reset
 * to the real render state every frame so toggling the flag at runtime takes effect at once).
 */
export function applyCapDebugState(
  mat: THREE.MeshBasicMaterial,
  baseColor: string,
  quality: string,
): void {
  const debug = isSectionCapDebug();
  mat.depthTest = !debug;
  mat.color.set(debug ? CAP_DEBUG_COLOR : baseColor);
  mat.stencilFunc = debug ? THREE.AlwaysStencilFunc : THREE.NotEqualStencilFunc;
  if (debug) logCapDebugOnce(quality);
}

/** Shared parity materials/scene the pass writes through (owned by the renderer, no state copy). */
export interface CutParityContext {
  readonly backParityMat: THREE.MeshBasicMaterial;
  readonly frontParityMat: THREE.MeshBasicMaterial;
  readonly singlePassMat: THREE.MeshBasicMaterial;
  readonly warmupScene: THREE.Scene;
}

/**
 * Run the back-increment / front-decrement stencil parity over `mainScene` (clipped by
 * `parityClip`), leaving stencil != 0 at the cut cross-section. Caller clears/positions the cap
 * quad afterwards. ADR-452 v2.22:
 *  • 'twopass' — ROBUST explicit two passes (BACK incr + FRONT decr), no cache-desync trick.
 *                Used by the ALWAYS-SOLID grey base so it can never read hollow on a heavy scene:
 *                Three.js re-issues `gl.stencilOp` on each material swap, and the back-face op can
 *                never be desynced (the raw override only ever touched FRONT).
 *  • 'single'  — cheaper v2.20 single-pass (warmup seed + raw FRONT override). Used by the per-colour
 *                refine loop only (settle-time, off the must-be-solid path).
 * Both keep `depthTest` off on the parity material (lone-plane rule — count over the whole sliced solid).
 */
export function runCutParityPass(
  renderer: THREE.WebGLRenderer,
  mainScene: THREE.Scene,
  camera: THREE.Camera,
  parityClip: THREE.Plane[],
  parityMode: ParityMode,
  ctx: CutParityContext,
): void {
  renderer.clearStencil();
  if (parityMode === 'twopass') {
    ctx.backParityMat.clippingPlanes = parityClip;
    mainScene.overrideMaterial = ctx.backParityMat;
    renderer.render(mainScene, camera);
    ctx.frontParityMat.clippingPlanes = parityClip;
    mainScene.overrideMaterial = ctx.frontParityMat;
    renderer.render(mainScene, camera);
  } else {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    renderer.render(ctx.warmupScene, camera);
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    ctx.singlePassMat.clippingPlanes = parityClip;
    mainScene.overrideMaterial = ctx.singlePassMat;
    renderer.render(mainScene, camera);
  }
  mainScene.overrideMaterial = null;
}
