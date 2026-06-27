// CoordinateTransforms transitively pulls config that may import firebase — stub it.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-544 — overlay-projector: ο 2D projector είναι byte-identical με το παλιό inline
 * `worldToScreen`, και το `projectorScaleAt` ισούται με `transform.scale` σε affine 2D (ώστε το
 * dimension sizing να μένει αμετάβλητο στο 2D path).
 */

import { fromTransform, projectorScaleAt } from '../overlay-projector';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { ViewTransform } from '../../../rendering/types/Types';

const VIEWPORT = { width: 800, height: 600 };
const TRANSFORM: ViewTransform = { scale: 2.5, offsetX: 30, offsetY: -12 };

describe('fromTransform', () => {
  it('matches CoordinateTransforms.worldToScreen for arbitrary points (byte-identical 2D)', () => {
    const project = fromTransform(TRANSFORM, VIEWPORT);
    for (const p of [{ x: 0, y: 0 }, { x: 1234, y: -567 }, { x: -42, y: 99 }]) {
      const direct = CoordinateTransforms.worldToScreen(p, TRANSFORM, VIEWPORT);
      expect(project(p)).toEqual(direct);
    }
  });
});

describe('projectorScaleAt', () => {
  it('equals transform.scale for the affine 2D projector', () => {
    const project = fromTransform(TRANSFORM, VIEWPORT);
    expect(projectorScaleAt(project, { x: 100, y: 100 })).toBeCloseTo(TRANSFORM.scale, 6);
  });

  it('is independent of the reference point (uniform affine scale)', () => {
    const project = fromTransform(TRANSFORM, VIEWPORT);
    expect(projectorScaleAt(project, { x: 0, y: 0 }))
      .toBeCloseTo(projectorScaleAt(project, { x: 5000, y: -3000 }), 6);
  });
});
