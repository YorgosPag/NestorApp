/**
 * ADR-516 Phase 2 — DxfBackdropCache (frozen DXF backdrop for 1:1 entity-drag).
 *
 * Verifies the state machine that fixes the GPU back-pressure root cause:
 *   • inert until armed, and gated OFF while section-cut / path-trace own the frame,
 *   • the static DXF underlay is captured ONCE (not re-drawn every drag frame),
 *   • invalidate() (DXF re-sync / resize) forces exactly one re-capture,
 *   • the per-frame composite draws the LIVE gizmo, not the underlay (it is in the cache).
 */

import * as THREE from 'three';
import { DxfBackdropCache } from '../dxf-backdrop-cache';
import { registerPostFxOverlay } from '../post-fx-overlay-pass';

interface MockRenderer {
  autoClearColor: boolean;
  getDrawingBufferSize: (v: THREE.Vector2) => THREE.Vector2;
  setRenderTarget: jest.Mock;
  clear: jest.Mock;
  render: jest.Mock;
}

function makeRenderer(): { renderer: THREE.WebGLRenderer; mock: MockRenderer } {
  const mock: MockRenderer = {
    autoClearColor: true,
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(800, 600),
    setRenderTarget: jest.fn(),
    clear: jest.fn(),
    render: jest.fn(),
  };
  return { renderer: mock as unknown as THREE.WebGLRenderer, mock };
}

/** Number of binds to an offscreen render target (= capture passes). */
const rtBinds = (mock: MockRenderer): number =>
  mock.setRenderTarget.mock.calls.filter((c) => c[0] instanceof THREE.WebGLRenderTarget).length;

describe('DxfBackdropCache', () => {
  const noGuards = { isSectionActive: () => false, isPathTracerActive: () => false };

  it('is inert until armed', () => {
    const cache = new DxfBackdropCache(noGuards);
    expect(cache.isActive()).toBe(false);
    cache.arm();
    expect(cache.isActive()).toBe(true);
    cache.disarm();
    expect(cache.isActive()).toBe(false);
  });

  it('is gated OFF while section-cut or path-trace own the frame', () => {
    const section = new DxfBackdropCache({ isSectionActive: () => true, isPathTracerActive: () => false });
    section.arm();
    expect(section.isActive()).toBe(false);

    const pathTrace = new DxfBackdropCache({ isSectionActive: () => false, isPathTracerActive: () => true });
    pathTrace.arm();
    expect(pathTrace.isActive()).toBe(false);
  });

  it('captures the underlay once, re-captures only after invalidate()', () => {
    const scene = new THREE.Scene();
    const underlay = new THREE.Object3D();
    registerPostFxOverlay(scene, () => [underlay], 'underlay');
    const { renderer, mock } = makeRenderer();
    const camera = new THREE.PerspectiveCamera();
    const cache = new DxfBackdropCache(noGuards);
    cache.arm();

    cache.renderFrame(renderer, scene, camera);
    expect(rtBinds(mock)).toBe(1); // first frame captures

    cache.renderFrame(renderer, scene, camera);
    expect(rtBinds(mock)).toBe(1); // cache reused — no re-draw of the lines

    cache.invalidate();
    cache.renderFrame(renderer, scene, camera);
    expect(rtBinds(mock)).toBe(2); // re-captured exactly once

    cache.dispose();
  });

  it('composites the LIVE gizmo each frame and restores autoClearColor', () => {
    const scene = new THREE.Scene();
    const underlay = new THREE.Object3D();
    const gizmo = new THREE.Object3D();
    registerPostFxOverlay(scene, () => [underlay], 'underlay');
    registerPostFxOverlay(scene, () => [gizmo], 'gizmo');
    const { renderer, mock } = makeRenderer();
    const camera = new THREE.PerspectiveCamera();
    const cache = new DxfBackdropCache(noGuards);
    cache.arm();

    cache.renderFrame(renderer, scene, camera);

    const rendered = mock.render.mock.calls.map((c) => c[0]);
    expect(rendered).toContain(gizmo);   // gizmo drawn live, on top
    expect(rendered).toContain(underlay); // underlay drawn ONCE into the cache
    expect(mock.autoClearColor).toBe(true); // restored after the live BIM pass

    cache.dispose();
  });
});
