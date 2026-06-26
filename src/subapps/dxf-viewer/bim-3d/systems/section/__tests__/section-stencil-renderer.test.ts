/**
 * ADR-452 v2.20 — single-pass axis-cut parity.
 *
 * The lone-plane cut cap used to count stencil parity with TWO full-scene passes
 * (BackSide IncrementWrap + FrontSide DecrementWrap). v2.20 consolidates it into ONE
 * DoubleSide scene pass via the box path's proven warmup + `gl.stencilOpSeparate`
 * trick, halving the full-scene renders this hot path costs per frame (the section
 * zoom/orbit lag). These tests pin BOTH the parity-material config (lone-plane rule)
 * AND the behavioural contract (exactly one main-scene parity render + the FRONT→DECR
 * override) without a real WebGL context — the visual result is browser-verified.
 */

import * as THREE from 'three';
import { createSinglePassCutParityMaterial } from '../section-stencil-materials';
import { SectionStencilRenderer } from '../section-stencil-renderer';

describe('createSinglePassCutParityMaterial', () => {
  it('is a DoubleSide, colour-less, depth-test-OFF IncrementWrap parity material', () => {
    const mat = createSinglePassCutParityMaterial();
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.colorWrite).toBe(false);
    expect(mat.depthWrite).toBe(false);
    // Lone-plane rule: parity must be counted over the WHOLE sliced solid, NOT
    // depth-tested (a depth-tested parity polluted above the cut). This is the only
    // config difference from the box `createSinglePassMaterial`.
    expect(mat.depthTest).toBe(false);
    expect(mat.stencilWrite).toBe(true);
    expect(mat.stencilFunc).toBe(THREE.AlwaysStencilFunc);
    expect(mat.stencilFail).toBe(THREE.KeepStencilOp);
    expect(mat.stencilZFail).toBe(THREE.KeepStencilOp);
    // BACK face increments via the material; FRONT face decrements via the per-pass
    // raw gl.stencilOpSeparate override (asserted below).
    expect(mat.stencilZPass).toBe(THREE.IncrementWrapStencilOp);
  });
});

interface MockGL {
  readonly FRONT: number;
  readonly KEEP: number;
  readonly DECR_WRAP: number;
  stencilOpSeparate: jest.Mock;
}

interface MockRenderer {
  autoClear: boolean;
  autoClearColor: boolean;
  autoClearDepth: boolean;
  autoClearStencil: boolean;
  getContext: () => MockGL;
  clearStencil: jest.Mock;
  render: jest.Mock;
}

function makeMockRenderer(): { renderer: MockRenderer; gl: MockGL } {
  const gl: MockGL = {
    FRONT: 0x0404,
    KEEP: 0x1e00,
    DECR_WRAP: 0x8508,
    stencilOpSeparate: jest.fn(),
  };
  const renderer: MockRenderer = {
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
    getContext: () => gl,
    clearStencil: jest.fn(),
    render: jest.fn(),
  };
  return { renderer, gl };
}

describe('SectionStencilRenderer.renderAxisCutCap — single-pass parity (v2.20)', () => {
  function build(): { stencil: SectionStencilRenderer; warmupScene: THREE.Scene } {
    const bimGroup = new THREE.Group();
    const stencil = new SectionStencilRenderer({
      getBimGroup: () => bimGroup,
      getDxfBounds: () => null,
    });
    // The warmup scene is private; reach it for identity comparison in the render spy.
    const warmupScene = (stencil as unknown as { warmupScene: THREE.Scene }).warmupScene;
    return { stencil, warmupScene };
  }

  it('renders the sliced solid ONCE (was twice) and overrides the FRONT face to DECR_WRAP', () => {
    const { stencil, warmupScene } = build();
    const { renderer, gl } = makeMockRenderer();
    const mainScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

    // 'fast' → grey base only (no per-colour loop): isolates the single parity pass.
    stencil.renderAxisCutCap(
      renderer as unknown as THREE.WebGLRenderer,
      mainScene, camera, plane, [], bounds, 'fast',
    );

    // The expensive cost is renders of the FULL BIM scene. Single-pass ⇒ exactly one.
    const mainSceneRenders = renderer.render.mock.calls.filter((c) => c[0] === mainScene);
    expect(mainSceneRenders).toHaveLength(1);

    // The warmup (zero-area cache seed) runs before the parity pass.
    const warmupRenders = renderer.render.mock.calls.filter((c) => c[0] === warmupScene);
    expect(warmupRenders).toHaveLength(1);

    // The FRONT face is decremented via a raw GL override (the cache trick).
    expect(gl.stencilOpSeparate).toHaveBeenCalledTimes(1);
    expect(gl.stencilOpSeparate).toHaveBeenCalledWith(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);

    stencil.dispose();
  });

  it('restores renderer autoClear flags + scene background after the cap passes', () => {
    const { stencil } = build();
    const { renderer } = makeMockRenderer();
    const mainScene = new THREE.Scene();
    const bg = new THREE.Color(0x123456);
    mainScene.background = bg;
    const camera = new THREE.PerspectiveCamera();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

    stencil.renderAxisCutCap(
      renderer as unknown as THREE.WebGLRenderer,
      mainScene, camera, plane, [], bounds, 'fast',
    );

    expect(renderer.autoClear).toBe(true);
    expect(renderer.autoClearStencil).toBe(true);
    expect(mainScene.background).toBe(bg);
    stencil.dispose();
  });
});
