/**
 * ADR-549 Φ3 — HoverBeautyCache (beauty snapshot for the instant hover-only fast path).
 *
 * Verifies the state machine that turns a ~40ms hover re-render into a ~1-2ms blit:
 *   • a fresh cache is a MISS (blit returns false, nothing snapshotted),
 *   • capture() snapshots the screen framebuffer (copyFramebufferToTexture) → hasCapture,
 *   • blit() paints the cached beauty (fullscreen quad) and returns true on a hit,
 *   • invalidate() drops the snapshot → the next blit is a miss again (no stale beauty).
 */

import * as THREE from 'three';
import { HoverBeautyCache } from '../hover-beauty-cache';

interface MockRenderer {
  getDrawingBufferSize: (v: THREE.Vector2) => THREE.Vector2;
  setRenderTarget: jest.Mock;
  copyFramebufferToTexture: jest.Mock;
  render: jest.Mock;
}

function makeRenderer(): { renderer: THREE.WebGLRenderer; mock: MockRenderer } {
  const mock: MockRenderer = {
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(800, 600),
    setRenderTarget: jest.fn(),
    copyFramebufferToTexture: jest.fn(),
    render: jest.fn(),
  };
  return { renderer: mock as unknown as THREE.WebGLRenderer, mock };
}

describe('HoverBeautyCache', () => {
  it('is a MISS until a capture exists', () => {
    const cache = new HoverBeautyCache();
    const { renderer, mock } = makeRenderer();
    expect(cache.hasCapture()).toBe(false);
    expect(cache.blit(renderer)).toBe(false); // nothing to paint → caller falls back to a full render
    expect(mock.copyFramebufferToTexture).not.toHaveBeenCalled();
    cache.dispose();
  });

  it('capture() snapshots the framebuffer → blit() paints it and returns true', () => {
    const cache = new HoverBeautyCache();
    const { renderer, mock } = makeRenderer();

    cache.capture(renderer);
    expect(cache.hasCapture()).toBe(true);
    expect(mock.copyFramebufferToTexture).toHaveBeenCalledTimes(1); // the screen snapshot

    expect(cache.blit(renderer)).toBe(true); // hit → painted
    expect(mock.render).toHaveBeenCalledTimes(1); // the fullscreen quad drew the cached beauty
    cache.dispose();
  });

  it('invalidate() drops the snapshot → the next blit is a miss again', () => {
    const cache = new HoverBeautyCache();
    const { renderer } = makeRenderer();
    cache.capture(renderer);
    expect(cache.blit(renderer)).toBe(true);

    cache.invalidate();
    expect(cache.hasCapture()).toBe(false);
    expect(cache.blit(renderer)).toBe(false); // stale beauty is never blitted
    cache.dispose();
  });
});
