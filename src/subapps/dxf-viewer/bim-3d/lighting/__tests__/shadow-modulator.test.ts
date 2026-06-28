import * as THREE from 'three';
import { ShadowModulator } from '../shadow-modulator';
import { DXF_TIMING } from '../../../config/dxf-timing';

/**
 * ShadowModulator — ADR-366 §B.5 adaptive shadows + static shadow-map (autoUpdate=false) contract.
 * We drive the modulator with a fake renderer (only `shadowMap` state is touched) and a real scene
 * so material invalidation traverses, asserting the ON↔OFF toggle, the `needsUpdate` rebuild
 * triggers, and that an unchanged state is a no-op.
 */

interface FakeShadowMap { enabled: boolean; needsUpdate: boolean; type: number; }
function fakeRenderer(enabled: boolean): { renderer: THREE.WebGLRenderer; shadowMap: FakeShadowMap } {
  const shadowMap: FakeShadowMap = { enabled, needsUpdate: false, type: 0 };
  return { renderer: { shadowMap } as unknown as THREE.WebGLRenderer, shadowMap };
}

function sceneWithMesh(): { scene: THREE.Scene; material: THREE.MeshStandardMaterial } {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
  return { scene, material };
}

// Deterministic clock so the SHADOW_SETTLE motion window is controllable.
let nowMs = 0;
const realNow = performance.now;
beforeAll(() => { performance.now = () => nowMs; });
afterAll(() => { performance.now = realNow; });
beforeEach(() => { nowMs = 10_000; });

describe('ShadowModulator — ADR-366 §B.5', () => {
  it('invalidateShadowMap() flags a one-shot rebuild (partner of renderer.shadowMap.autoUpdate=false)', () => {
    const { renderer, shadowMap } = fakeRenderer(true);
    const { scene } = sceneWithMesh();
    const mod = new ShadowModulator(renderer, scene);
    expect(shadowMap.needsUpdate).toBe(false);

    mod.invalidateShadowMap();
    expect(shadowMap.needsUpdate).toBe(true);
    mod.dispose();
  });

  it('OFF→ON (settled) enables shadows, rebuilds the map ONCE, and invalidates materials', () => {
    const { renderer, shadowMap } = fakeRenderer(false);
    const { scene, material } = sceneWithMesh();
    const v0 = material.version; // `needsUpdate` is a write-only setter → assert via the version bump
    const mod = new ShadowModulator(renderer, scene);

    mod.update(false); // not moving → want shadows ON
    expect(shadowMap.enabled).toBe(true);
    expect(shadowMap.needsUpdate).toBe(true);     // first crisp frame rebuilds the static map
    expect(material.version).toBeGreaterThan(v0);  // program re-acquired (cache hit after warmUp)
    mod.dispose();
  });

  it('ON→OFF (moving) disables shadows WITHOUT a map rebuild (no wasted depth pass)', () => {
    const { renderer, shadowMap } = fakeRenderer(true);
    const { scene } = sceneWithMesh();
    const mod = new ShadowModulator(renderer, scene);

    mod.update(true); // camera/cursor moving → want shadows OFF
    expect(shadowMap.enabled).toBe(false);
    expect(shadowMap.needsUpdate).toBe(false);     // turning OFF never rebuilds
    mod.dispose();
  });

  it('is a no-op when already in the desired state (idempotent per-frame driver)', () => {
    const { renderer, shadowMap } = fakeRenderer(true);
    const { scene, material } = sceneWithMesh();
    const v0 = material.version;
    const mod = new ShadowModulator(renderer, scene);

    mod.update(false); // already enabled + not moving → want ON → no change
    expect(shadowMap.enabled).toBe(true);
    expect(shadowMap.needsUpdate).toBe(false);
    expect(material.version).toBe(v0);              // no churn
    mod.dispose();
  });

  it('a recent cursor move keeps shadows OFF until SHADOW_SETTLE elapses', () => {
    const { renderer, shadowMap } = fakeRenderer(false);
    const { scene } = sceneWithMesh();
    const mod = new ShadowModulator(renderer, scene);

    // Simulate a cursor move (the modulator's own window listener stamps lastMoveMs).
    window.dispatchEvent(new MouseEvent('mousemove'));
    mod.update(false); // cameraMoving=false but cursor moved < SHADOW_SETTLE ago → still moving
    expect(shadowMap.enabled).toBe(false);

    nowMs += DXF_TIMING.gesture.SHADOW_SETTLE + 10; // genuine stillness
    mod.update(false);
    expect(shadowMap.enabled).toBe(true);
    mod.dispose();
  });
});
