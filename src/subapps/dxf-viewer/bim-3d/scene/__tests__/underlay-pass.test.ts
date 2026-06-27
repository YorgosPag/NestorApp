/**
 * ADR-537 underlay-depth — underlay-pass SSoT.
 *
 * The DXF reference linework is drawn in a dedicated forward pass AFTER the lit scene + SSAO so
 * it is depth-correct yet never AO/tone-shaded. These tests pin the contract with a mock renderer
 * (no WebGL in jsdom): the underlay root (resolved through its OWNER accessor) is flipped visible
 * ONLY for its own render, the bound target is never cleared, and the EffectComposer pass targets
 * the readBuffer (not the screen). No underlay → no draw.
 */

import * as THREE from 'three';
import { renderUnderlay, UnderlayPass } from '../underlay-pass';

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

describe('renderUnderlay', () => {
  const camera = new THREE.PerspectiveCamera();

  it('is a no-op when there is no underlay root (renderer.render never called)', () => {
    const { renderer, calls } = makeRenderer();
    renderUnderlay(renderer, null, camera);
    expect(calls).toHaveLength(0);
  });

  it('renders the underlay root visible, with autoClear OFF, then restores both', () => {
    const { renderer, calls } = makeRenderer();
    const root = new THREE.Group();
    root.visible = false; // the converter keeps it hidden from the main render
    renderer.autoClear = true;

    renderUnderlay(renderer, root, camera);

    // exactly one draw, of the underlay root, visible + without clearing the lit scene
    expect(calls).toHaveLength(1);
    expect(calls[0].object).toBe(root);
    expect(calls[0].visible).toBe(true);
    expect(calls[0].autoClear).toBe(false);
    // restored afterwards → main render keeps skipping it, autoClear back to prior value
    expect(root.visible).toBe(false);
    expect(renderer.autoClear).toBe(true);
  });
});

describe('UnderlayPass', () => {
  const camera = new THREE.PerspectiveCamera();
  const rt = { isWebGLRenderTarget: true } as unknown as THREE.WebGLRenderTarget;

  it('never swaps composer buffers', () => {
    const pass = new UnderlayPass(() => null, () => camera);
    expect(pass.needsSwap).toBe(false);
  });

  it('targets the readBuffer (not the screen) as a middle pass + draws the owner root', () => {
    const { renderer, calls, setTargets } = makeRenderer();
    const root = new THREE.Group();
    const pass = new UnderlayPass(() => root, () => camera);
    pass.renderToScreen = false;

    pass.render(renderer, rt, rt);

    expect(setTargets[0]).toBe(rt); // readBuffer, so the underlay reaches the final CopyPass
    expect(calls).toHaveLength(1);
    expect(calls[0].object).toBe(root);
  });

  it('targets the screen when it is the final pass', () => {
    const { renderer, setTargets } = makeRenderer();
    const pass = new UnderlayPass(() => null, () => camera);
    pass.renderToScreen = true;

    pass.render(renderer, rt, rt);

    expect(setTargets[0]).toBeNull();
  });
});
