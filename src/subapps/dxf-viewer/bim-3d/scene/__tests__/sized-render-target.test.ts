/**
 * ADR-516 Phase 2 — ensureSizedRenderTarget SSoT (size-managed WebGLRenderTarget).
 *
 * The branch logic shared by SelectionOutlinePass / grip-3d-depth-occluder / dxf-backdrop-cache:
 *   • null → calls `create` once,
 *   • same size → returns the SAME instance, never re-creates / re-sizes,
 *   • changed size → setSize-in-place (keeps the texture object), no new instance,
 *   • width/height floored & clamped to ≥1.
 */

import * as THREE from 'three';
import { ensureSizedRenderTarget } from '../sized-render-target';

describe('ensureSizedRenderTarget', () => {
  it('creates once when there is no existing target', () => {
    const create = jest.fn((w: number, h: number) => new THREE.WebGLRenderTarget(w, h));
    const rt = ensureSizedRenderTarget(null, 800, 600, create);
    expect(create).toHaveBeenCalledTimes(1);
    expect([rt.width, rt.height]).toEqual([800, 600]);
  });

  it('reuses the same instance (no setSize) when the size is unchanged', () => {
    const rt = new THREE.WebGLRenderTarget(800, 600);
    const setSize = jest.spyOn(rt, 'setSize');
    const create = jest.fn();
    const out = ensureSizedRenderTarget(rt, 800, 600, create as never);
    expect(out).toBe(rt);
    expect(create).not.toHaveBeenCalled();
    expect(setSize).not.toHaveBeenCalled();
  });

  it('resizes in place (same instance + texture) when the size changes', () => {
    const rt = new THREE.WebGLRenderTarget(800, 600);
    const texture = rt.texture;
    const out = ensureSizedRenderTarget(rt, 1024, 768, () => new THREE.WebGLRenderTarget(1, 1));
    expect(out).toBe(rt);            // resized, not re-created
    expect(out.texture).toBe(texture); // bound material.map / depthTexture stays valid
    expect([out.width, out.height]).toEqual([1024, 768]);
  });

  it('floors and clamps width/height to >= 1', () => {
    const create = jest.fn((w: number, h: number) => new THREE.WebGLRenderTarget(w, h));
    ensureSizedRenderTarget(null, 0, 12.9, create);
    expect(create).toHaveBeenCalledWith(1, 12);
  });
});
