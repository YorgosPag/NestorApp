/**
 * ADR-537 underlay-depth — underlay-pass SSoT.
 *
 * The DXF reference linework is drawn in a dedicated forward pass AFTER the lit scene + SSAO so
 * it is depth-correct yet never AO/tone-shaded. These tests pin the contract with a mock renderer
 * (no WebGL in jsdom): the underlay subtree is flipped visible ONLY for its own render, the bound
 * target is never cleared, and the EffectComposer pass targets the readBuffer (not the screen).
 */

import * as THREE from 'three';
import { markUnderlayRoot, findUnderlayRoot, renderUnderlay, UnderlayPass } from '../underlay-pass';

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
  } as unknown as THREE.WebGLRenderer & {
    autoClear: boolean;
  };
  return { renderer, calls, setTargets };
}

describe('markUnderlayRoot / findUnderlayRoot', () => {
  it('marks the root + hides it from the main render', () => {
    const g = new THREE.Group();
    markUnderlayRoot(g);
    expect(g.userData.dxfUnderlay).toBe(true);
    expect(g.visible).toBe(false);
  });

  it('finds the marked direct child, null when none', () => {
    const scene = new THREE.Scene();
    expect(findUnderlayRoot(scene)).toBeNull();
    const other = new THREE.Group();
    const underlay = new THREE.Group();
    markUnderlayRoot(underlay);
    scene.add(other, underlay);
    expect(findUnderlayRoot(scene)).toBe(underlay);
  });
});

describe('renderUnderlay', () => {
  const camera = new THREE.PerspectiveCamera();

  it('is a no-op when there is no underlay (renderer.render never called)', () => {
    const { renderer, calls } = makeRenderer();
    const scene = new THREE.Scene();
    renderUnderlay(renderer, scene, camera);
    expect(calls).toHaveLength(0);
  });

  it('renders the underlay subtree visible, with autoClear OFF, then restores both', () => {
    const { renderer, calls } = makeRenderer();
    const scene = new THREE.Scene();
    const underlay = new THREE.Group();
    markUnderlayRoot(underlay); // visible=false
    scene.add(underlay);
    renderer.autoClear = true;

    renderUnderlay(renderer, scene, camera);

    // exactly one draw, of the underlay subtree, visible + without clearing the lit scene
    expect(calls).toHaveLength(1);
    expect(calls[0].object).toBe(underlay);
    expect(calls[0].visible).toBe(true);
    expect(calls[0].autoClear).toBe(false);
    // restored afterwards → main render keeps skipping it, autoClear back to prior value
    expect(underlay.visible).toBe(false);
    expect(renderer.autoClear).toBe(true);
  });
});

describe('UnderlayPass', () => {
  const camera = new THREE.PerspectiveCamera();
  const rt = { isWebGLRenderTarget: true } as unknown as THREE.WebGLRenderTarget;

  it('never swaps composer buffers', () => {
    const scene = new THREE.Scene();
    const pass = new UnderlayPass(scene, () => camera);
    expect(pass.needsSwap).toBe(false);
  });

  it('targets the readBuffer (not the screen) as a middle pass', () => {
    const { renderer, calls, setTargets } = makeRenderer();
    const scene = new THREE.Scene();
    const underlay = new THREE.Group();
    markUnderlayRoot(underlay);
    scene.add(underlay);
    const pass = new UnderlayPass(scene, () => camera);
    pass.renderToScreen = false;

    pass.render(renderer, rt, rt);

    expect(setTargets[0]).toBe(rt); // readBuffer, so the underlay reaches the final CopyPass
    expect(calls).toHaveLength(1);
    expect(calls[0].object).toBe(underlay);
  });

  it('targets the screen when it is the final pass', () => {
    const { renderer, setTargets } = makeRenderer();
    const scene = new THREE.Scene();
    const pass = new UnderlayPass(scene, () => camera);
    pass.renderToScreen = true;

    pass.render(renderer, rt, rt);

    expect(setTargets[0]).toBeNull();
  });
});
