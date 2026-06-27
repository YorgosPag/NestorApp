/**
 * ADR-537 — post-fx-overlay-pass SSoT.
 *
 * UI/reference overlays (DXF underlay + edit gizmo) are drawn in a dedicated forward pass AFTER the
 * lit scene + SSAO so they are depth-correct yet never AO/tone-shaded. These tests pin the registry
 * + render contract with a mock renderer (no WebGL in jsdom): providers are scene-scoped, only the
 * SHOWN roots are drawn, each is flipped visible ONLY for its own render, the bound target is never
 * cleared, and the EffectComposer pass targets the readBuffer (not the screen).
 */

import * as THREE from 'three';
import {
  registerPostFxOverlay,
  collectPostFxOverlayRoots,
  renderPostFxOverlays,
  PostFxOverlayPass,
} from '../post-fx-overlay-pass';

/** Mock renderer that records the live `autoClear` + the root's `visible` at each `render()`. */
function makeRenderer() {
  const calls: Array<{ object: THREE.Object3D; autoClear: boolean; visible: boolean }> = [];
  const setTargets: Array<THREE.WebGLRenderTarget | null> = [];
  const renderer = {
    autoClear: true,
    setRenderTarget(t: THREE.WebGLRenderTarget | null) { setTargets.push(t); },
    render(object: THREE.Object3D) {
      calls.push({ object, autoClear: renderer.autoClear, visible: object.visible });
    },
  } as unknown as THREE.WebGLRenderer & { autoClear: boolean };
  return { renderer, calls, setTargets };
}

describe('registry (scene-scoped)', () => {
  it('collects only providers registered for the SAME scene, and flattens roots', () => {
    const sceneA = new THREE.Scene();
    const sceneB = new THREE.Scene();
    const r1 = new THREE.Group();
    const r2 = new THREE.Group();
    const rB = new THREE.Group();
    const offA1 = registerPostFxOverlay(sceneA, () => [r1, r2]);
    const offB = registerPostFxOverlay(sceneB, () => [rB]);

    expect(collectPostFxOverlayRoots(sceneA)).toEqual([r1, r2]);
    expect(collectPostFxOverlayRoots(sceneB)).toEqual([rB]); // no cross-viewport bleed
    offA1();
    expect(collectPostFxOverlayRoots(sceneA)).toEqual([]); // unregister removes
    offB();
  });

  it('a provider returning [] (nothing shown) contributes no roots', () => {
    const scene = new THREE.Scene();
    let shown = false;
    const root = new THREE.Group();
    const off = registerPostFxOverlay(scene, () => (shown ? [root] : []));
    expect(collectPostFxOverlayRoots(scene)).toEqual([]);
    shown = true;
    expect(collectPostFxOverlayRoots(scene)).toEqual([root]);
    off();
  });
});

describe('renderPostFxOverlays', () => {
  const camera = new THREE.PerspectiveCamera();

  it('is a no-op when nothing is registered (renderer.render never called)', () => {
    const { renderer, calls } = makeRenderer();
    renderPostFxOverlays(renderer, new THREE.Scene(), camera);
    expect(calls).toHaveLength(0);
  });

  it('renders each shown root visible, with autoClear OFF, then restores both', () => {
    const { renderer, calls } = makeRenderer();
    const scene = new THREE.Scene();
    const a = new THREE.Group(); a.visible = false; // owners keep roots hidden from the main render
    const b = new THREE.Group(); b.visible = false;
    const off = registerPostFxOverlay(scene, () => [a, b]);
    renderer.autoClear = true;

    renderPostFxOverlays(renderer, scene, camera);

    expect(calls.map((c) => c.object)).toEqual([a, b]);
    expect(calls.every((c) => c.visible === true)).toBe(true);   // visible during its own draw
    expect(calls.every((c) => c.autoClear === false)).toBe(true); // never clears the lit scene
    expect(a.visible).toBe(false); // restored → main render keeps skipping them
    expect(b.visible).toBe(false);
    expect(renderer.autoClear).toBe(true);
    off();
  });
});

describe('PostFxOverlayPass', () => {
  const camera = new THREE.PerspectiveCamera();
  const rt = { isWebGLRenderTarget: true } as unknown as THREE.WebGLRenderTarget;

  it('never swaps composer buffers', () => {
    const pass = new PostFxOverlayPass(new THREE.Scene(), () => camera);
    expect(pass.needsSwap).toBe(false);
  });

  it('targets the readBuffer (not the screen) as a middle pass + draws the registered root', () => {
    const { renderer, calls, setTargets } = makeRenderer();
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const off = registerPostFxOverlay(scene, () => [root]);
    const pass = new PostFxOverlayPass(scene, () => camera);
    pass.renderToScreen = false;

    pass.render(renderer, rt, rt);

    expect(setTargets[0]).toBe(rt); // readBuffer, so the overlay reaches the final CopyPass
    expect(calls.map((c) => c.object)).toEqual([root]);
    off();
  });

  it('targets the screen when it is the final pass', () => {
    const { renderer, setTargets } = makeRenderer();
    const pass = new PostFxOverlayPass(new THREE.Scene(), () => camera);
    pass.renderToScreen = true;

    pass.render(renderer, rt, rt);

    expect(setTargets[0]).toBeNull();
  });
});
