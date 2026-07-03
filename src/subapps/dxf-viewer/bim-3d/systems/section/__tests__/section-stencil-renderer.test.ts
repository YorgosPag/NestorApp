/**
 * ADR-452 v2.22 — robust grey-base cut-cap parity (split from the v2.20 single-pass).
 *
 * The ALWAYS-SOLID grey base poché must NEVER read hollow on a heavy floor. The v2.20
 * single-pass parity (warmup seed + raw `gl.stencilOpSeparate(FRONT→DECR)` cache trick)
 * can be wiped by a mid-render program compile on ~800 meshes → the front faces stop
 * decrementing → the cap fills nothing → «λεπτά κάθετα κούφια πανό». So the grey base now
 * uses the ROBUST explicit two-pass (BACK increment + FRONT decrement, no cache trick),
 * while the per-material COLOUR refine loop (settle-time, off the critical path) keeps the
 * cheaper single-pass. These tests pin the parity-material configs AND the behavioural
 * split (grey = 2 plain scene passes, colour = warmup + FRONT override) without a real
 * WebGL context — the visual result is browser-verified.
 */

import * as THREE from 'three';
import {
  createSinglePassCutParityMaterial,
  createBackParityMaterial,
  createFrontParityMaterial,
  createOpaqueCutCapMaterial,
} from '../section-stencil-materials';
import { SectionStencilRenderer } from '../section-stencil-renderer';

describe('createSinglePassCutParityMaterial', () => {
  it('is a DoubleSide, colour-less, depth-test-OFF IncrementWrap parity material', () => {
    const mat = createSinglePassCutParityMaterial();
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.colorWrite).toBe(false);
    expect(mat.depthWrite).toBe(false);
    // Lone-plane rule: parity must be counted over the WHOLE sliced solid, NOT
    // depth-tested (a depth-tested parity polluted above the cut).
    expect(mat.depthTest).toBe(false);
    expect(mat.stencilWrite).toBe(true);
    expect(mat.stencilFunc).toBe(THREE.AlwaysStencilFunc);
    expect(mat.stencilFail).toBe(THREE.KeepStencilOp);
    expect(mat.stencilZFail).toBe(THREE.KeepStencilOp);
    // BACK face increments via the material; FRONT face decrements via the per-pass
    // raw gl.stencilOpSeparate override (single-pass colour path only).
    expect(mat.stencilZPass).toBe(THREE.IncrementWrapStencilOp);
  });
});

describe('robust 2-pass parity materials (ADR-452 v2.22, grey base)', () => {
  it('back pass = BackSide, colour-less, depth-OFF, IncrementWrap', () => {
    const mat = createBackParityMaterial();
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.colorWrite).toBe(false);
    expect(mat.depthWrite).toBe(false);
    // Lone-plane rule (same as the single-pass): count over the whole sliced solid.
    expect(mat.depthTest).toBe(false);
    expect(mat.stencilWrite).toBe(true);
    expect(mat.stencilFunc).toBe(THREE.AlwaysStencilFunc);
    expect(mat.stencilFail).toBe(THREE.KeepStencilOp);
    expect(mat.stencilZFail).toBe(THREE.KeepStencilOp);
    expect(mat.stencilZPass).toBe(THREE.IncrementWrapStencilOp);
  });

  it('front pass = FrontSide DecrementWrap (mirror of the back pass)', () => {
    const mat = createFrontParityMaterial();
    expect(mat.side).toBe(THREE.FrontSide);
    expect(mat.colorWrite).toBe(false);
    expect(mat.depthWrite).toBe(false);
    expect(mat.depthTest).toBe(false);
    expect(mat.stencilWrite).toBe(true);
    expect(mat.stencilFunc).toBe(THREE.AlwaysStencilFunc);
    expect(mat.stencilZPass).toBe(THREE.DecrementWrapStencilOp);
  });
});

describe('createOpaqueCutCapMaterial (ADR-452 v2.19 depth + v2.22 polygonOffset)', () => {
  it('is depth-tested (occlusion) with a negative polygonOffset (rim z-fight guard)', () => {
    const mat = createOpaqueCutCapMaterial();
    // v2.19 — the VISIBLE cap must depth-test so a roof cut is occluded from below.
    expect(mat.depthTest).toBe(true);
    expect(mat.depthWrite).toBe(false);
    // v2.22 — bias the coplanar cap quad toward the camera so it wins the rim z-fight
    // on heavy / large-extent scenes without changing which geometry occludes it.
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBeLessThan(0);
    expect(mat.polygonOffsetUnits).toBeLessThan(0);
    // NotEqual(0) stencil mask — fill only where the parity marked a cut cross-section.
    expect(mat.stencilFunc).toBe(THREE.NotEqualStencilFunc);
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

describe('SectionStencilRenderer.renderAxisCutCap — grey base = robust 2-pass (v2.22)', () => {
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

  const camera = (): THREE.PerspectiveCamera => new THREE.PerspectiveCamera();
  const bounds = (): THREE.Box3 =>
    new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const plane = (): THREE.Plane => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  it('draws the grey base with TWO plain scene passes and NO cache trick', () => {
    const { stencil, warmupScene } = build();
    const { renderer, gl } = makeMockRenderer();
    const mainScene = new THREE.Scene();

    // 'fast' → grey base only (no per-colour loop): isolates the grey parity strategy.
    stencil.renderAxisCutCap(
      renderer as unknown as THREE.WebGLRenderer,
      mainScene, camera(), plane(), [], bounds(), 'fast',
    );

    // Robust two-pass ⇒ the FULL BIM scene is rendered TWICE (back incr + front decr).
    const mainSceneRenders = renderer.render.mock.calls.filter((c) => c[0] === mainScene);
    expect(mainSceneRenders).toHaveLength(2);

    // No warmup seed and no raw FRONT override — that fragile cache trick is gone here.
    const warmupRenders = renderer.render.mock.calls.filter((c) => c[0] === warmupScene);
    expect(warmupRenders).toHaveLength(0);
    expect(gl.stencilOpSeparate).not.toHaveBeenCalled();

    stencil.dispose();
  });

  it('keeps the cheaper single-pass for the per-material COLOUR refine loop', () => {
    const { stencil, warmupScene } = build();
    const { renderer, gl } = makeMockRenderer();
    const mainScene = new THREE.Scene();

    // One BIM mesh → one colour group, so the colour loop runs on 'full'.
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    mesh.userData.bimId = 'col-1';
    mainScene.add(mesh);

    stencil.renderAxisCutCap(
      renderer as unknown as THREE.WebGLRenderer,
      mainScene, camera(), plane(), [], bounds(), 'full',
    );

    // Grey base (2 passes) + one colour group single-pass (1 pass) = 3 main-scene renders.
    const mainSceneRenders = renderer.render.mock.calls.filter((c) => c[0] === mainScene);
    expect(mainSceneRenders).toHaveLength(3);

    // Exactly the colour pass uses the warmup + FRONT override (grey base does not).
    const warmupRenders = renderer.render.mock.calls.filter((c) => c[0] === warmupScene);
    expect(warmupRenders).toHaveLength(1);
    expect(gl.stencilOpSeparate).toHaveBeenCalledTimes(1);
    expect(gl.stencilOpSeparate).toHaveBeenCalledWith(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP);

    stencil.dispose();
  });

  it('anchors the cap quad over the SCENE CENTRE, not the world origin (geo-referenced fix)', () => {
    const { stencil } = build();
    const { renderer } = makeMockRenderer();
    const mainScene = new THREE.Scene();
    // Horizontal cut plane at Y=3 (normal +Y ⇒ constant −3), building offset far in X/Z (real
    // project coordinates). The OLD origin-projection put the quad at (0,3,0) — off the building.
    const p = new THREE.Plane(new THREE.Vector3(0, 1, 0), -3);
    const offsetBounds = new THREE.Box3(
      new THREE.Vector3(1000 - 5, 0, 2000 - 5),
      new THREE.Vector3(1000 + 5, 6, 2000 + 5),
    );

    stencil.renderAxisCutCap(
      renderer as unknown as THREE.WebGLRenderer,
      mainScene, camera(), p, [], offsetBounds, 'fast',
    );

    const capMesh = (stencil as unknown as { cutCapMesh: THREE.Mesh }).cutCapMesh;
    // Centred over the building (X≈1000, Z≈2000) ON the plane (Y=3) — covers the geometry.
    expect(capMesh.position.x).toBeCloseTo(1000);
    expect(capMesh.position.z).toBeCloseTo(2000);
    expect(capMesh.position.y).toBeCloseTo(3);
    stencil.dispose();
  });

  it('restores renderer autoClear flags + scene background after the cap passes', () => {
    const { stencil } = build();
    const { renderer } = makeMockRenderer();
    const mainScene = new THREE.Scene();
    const bg = new THREE.Color(0x123456);
    mainScene.background = bg;

    stencil.renderAxisCutCap(
      renderer as unknown as THREE.WebGLRenderer,
      mainScene, camera(), plane(), [], bounds(), 'fast',
    );

    expect(renderer.autoClear).toBe(true);
    expect(renderer.autoClearStencil).toBe(true);
    expect(mainScene.background).toBe(bg);
    stencil.dispose();
  });
});
