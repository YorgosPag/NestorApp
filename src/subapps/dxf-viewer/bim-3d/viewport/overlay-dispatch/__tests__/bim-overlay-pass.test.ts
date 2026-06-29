/**
 * Tests for the pure 3D overlay dispatch frame renderer (ADR-555). Verifies the pull-model
 * contract: size+clear ONCE, z-order, motion gate, dirty/skip gate (ADR-549 Phase 3), forcePaint,
 * per-pass state isolation, and the no-camera/no-ctx no-ops.
 */

import type * as THREE from 'three';
import type { ThreeJsSceneManager } from '../../../scene/ThreeJsSceneManager';
import type { GripDepthOccluder } from '../../../grips/grip-3d-depth-occluder';
import {
  paintBimOverlayFrame,
  activePassSignature,
  type BimOverlayPass,
  type BimOverlayFrame,
} from '../bim-overlay-pass';

// Control whether a (fake) 2D context is produced, mirroring `sizeCanvasToContainerDpr`.
let mockCtx: CanvasRenderingContext2D | null;
jest.mock('../../../../rendering/canvas/withCanvasState', () => ({
  sizeCanvasToContainerDpr: jest.fn(() => mockCtx),
}));

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    clearRect: jest.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const camera = {} as THREE.Camera;
const canvas = {} as HTMLCanvasElement;
const container = {} as HTMLElement;
const occluder = { tag: 'occ' } as unknown as GripDepthOccluder;

function makeManager(cam: THREE.Camera | null = camera): ThreeJsSceneManager {
  return { getCamera: () => cam } as unknown as ThreeJsSceneManager;
}

/** A pass that records the frame it received, with overridable gate fields. */
function makePass(
  over: Partial<BimOverlayPass> & { tag: string },
): BimOverlayPass & { calls: BimOverlayFrame[] } {
  const calls: BimOverlayFrame[] = [];
  return {
    active: true,
    hideOnMotion: false,
    paint: (frame) => calls.push(frame),
    ...over,
    calls,
  };
}

const STILL = () => false;
const MOVING = () => true;

beforeEach(() => {
  mockCtx = makeCtx();
});

describe('paintBimOverlayFrame — pull model', () => {
  it('sizes+clears once and paints active passes in z-order', () => {
    const a = makePass({ tag: 'a' });
    const b = makePass({ tag: 'b' });
    const order: string[] = [];
    a.paint = () => order.push('a');
    b.paint = () => order.push('b');
    paintBimOverlayFrame(canvas, container, makeManager(), [a, b], occluder, STILL, true);
    expect(order).toEqual(['a', 'b']);
  });

  it('threads ctx/camera/manager/occluder into each pass', () => {
    const a = makePass({ tag: 'a' });
    const mgr = makeManager();
    paintBimOverlayFrame(canvas, container, mgr, [a], occluder, STILL, true);
    expect(a.calls).toHaveLength(1);
    expect(a.calls[0]).toMatchObject({ ctx: mockCtx, canvas, camera, manager: mgr, occluder });
  });

  it('skips inactive passes', () => {
    const on = makePass({ tag: 'on' });
    const off = makePass({ tag: 'off', active: false });
    paintBimOverlayFrame(canvas, container, makeManager(), [on, off], occluder, STILL, true);
    expect(on.calls).toHaveLength(1);
    expect(off.calls).toHaveLength(0);
  });

  it('wraps every pass in save()/restore() for state isolation', () => {
    const a = makePass({ tag: 'a' });
    const b = makePass({ tag: 'b' });
    paintBimOverlayFrame(canvas, container, makeManager(), [a, b], occluder, STILL, true);
    expect(mockCtx!.save).toHaveBeenCalledTimes(2);
    expect(mockCtx!.restore).toHaveBeenCalledTimes(2);
  });
});

describe('paintBimOverlayFrame — motion gate', () => {
  it('hides hideOnMotion passes during camera motion but keeps the follow ones', () => {
    const hud = makePass({ tag: 'hud', hideOnMotion: true });
    const glow = makePass({ tag: 'glow', hideOnMotion: false });
    paintBimOverlayFrame(canvas, container, makeManager(), [glow, hud], occluder, MOVING, false);
    expect(glow.calls).toHaveLength(1);
    expect(hud.calls).toHaveLength(0);
  });

  it('motion forces a paint even when passes report clean', () => {
    const glow = makePass({ tag: 'glow', hideOnMotion: false, isDirty: () => false });
    paintBimOverlayFrame(canvas, container, makeManager(), [glow], occluder, MOVING, false);
    expect(glow.calls).toHaveLength(1);
  });
});

describe('paintBimOverlayFrame — dirty/skip gate (ADR-549 Phase 3)', () => {
  it('skips the whole frame (no clear, no paint) when static + clean + not forced', () => {
    const glow = makePass({ tag: 'glow', isDirty: () => false });
    paintBimOverlayFrame(canvas, container, makeManager(), [glow], occluder, STILL, false);
    expect(glow.calls).toHaveLength(0);
    expect(mockCtx!.save).not.toHaveBeenCalled();
  });

  it('paints when a clean pass is forced (active-set changed)', () => {
    const glow = makePass({ tag: 'glow', isDirty: () => false });
    paintBimOverlayFrame(canvas, container, makeManager(), [glow], occluder, STILL, true);
    expect(glow.calls).toHaveLength(1);
  });

  it('paints when a pass reports dirty', () => {
    const glow = makePass({ tag: 'glow', isDirty: () => true });
    paintBimOverlayFrame(canvas, container, makeManager(), [glow], occluder, STILL, false);
    expect(glow.calls).toHaveLength(1);
  });

  it('a pass without isDirty is conservative (always repaints when active)', () => {
    const grips = makePass({ tag: 'grips' }); // no isDirty
    paintBimOverlayFrame(canvas, container, makeManager(), [grips], occluder, STILL, false);
    expect(grips.calls).toHaveLength(1);
  });

  it('skips when the visible set is empty and not forced', () => {
    const off = makePass({ tag: 'off', active: false });
    paintBimOverlayFrame(canvas, container, makeManager(), [off], occluder, STILL, false);
    expect(mockCtx!.save).not.toHaveBeenCalled();
  });
});

describe('paintBimOverlayFrame — no-ops', () => {
  it('no-op when the camera is unavailable', () => {
    const a = makePass({ tag: 'a' });
    paintBimOverlayFrame(canvas, container, makeManager(null), [a], occluder, STILL, true);
    expect(a.calls).toHaveLength(0);
  });

  it('no-op when the 2D context is unavailable', () => {
    mockCtx = null;
    const a = makePass({ tag: 'a' });
    paintBimOverlayFrame(canvas, container, makeManager(), [a], occluder, STILL, true);
    expect(a.calls).toHaveLength(0);
  });
});

describe('paintBimOverlayFrame — return value (did it paint?)', () => {
  it('returns true when it paints, false when it skips', () => {
    const dirty = makePass({ tag: 'd', isDirty: () => true });
    expect(paintBimOverlayFrame(canvas, container, makeManager(), [dirty], occluder, STILL, false)).toBe(true);
    const clean = makePass({ tag: 'c', isDirty: () => false });
    expect(paintBimOverlayFrame(canvas, container, makeManager(), [clean], occluder, STILL, false)).toBe(false);
  });

  it('returns false on a no-op (forcePaint but no camera)', () => {
    const a = makePass({ tag: 'a' });
    expect(paintBimOverlayFrame(canvas, container, makeManager(null), [a], occluder, STILL, true)).toBe(false);
  });
});

describe('activePassSignature', () => {
  it('encodes only active indices and changes when the set changes', () => {
    const a = makePass({ tag: 'a' });
    const b = makePass({ tag: 'b', active: false });
    const c = makePass({ tag: 'c' });
    expect(activePassSignature([a, b, c])).toBe('0,2,');
    const sigBefore = activePassSignature([a, b, c]);
    const sigAfter = activePassSignature([a, makePass({ tag: 'b', active: true }), c]);
    expect(sigAfter).not.toBe(sigBefore);
  });

  it('empty when nothing is active', () => {
    expect(activePassSignature([makePass({ tag: 'x', active: false })])).toBe('');
  });
});
