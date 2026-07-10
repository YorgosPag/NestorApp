/**
 * ADR-627 — whole-hatch MOVE cross + rotation handle grip SSoT.
 *
 * Pins the two invariants the parity depends on:
 *  1. PLACEMENT parity — the hatch handles land at the EXACT same world positions the
 *     polyline/area outline places them (both delegate to `resolveMoveRotateHandleWorld`),
 *     so «όλα ΙΔΙΑ με το περίγραμμα εμβαδού» can never drift.
 *  2. SHAPE — the two grips carry the `hatch-move` / `hatch-rotation` kinds, the correct
 *     types (`center` move / `vertex` rotation), `movesEntity` flags, and sequential indices.
 */

// Firebase auth mock — type barrels can touch auth on the import path (handoff trap).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import type { Point2D } from '../../../rendering/types/Types';
import { getHatchMoveRotateGrips } from '../hatch-move-rotate-grips';
import {
  getPolylineMoveRotateGrips,
  resolveMoveRotateHandleWorld,
} from '../../../systems/polyline/polyline-grips';

const SQUARE: Point2D[] = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];
const L_RING: Point2D[] = [
  { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 12 }, { x: 0, y: 12 },
];

describe('ADR-627 — getHatchMoveRotateGrips (whole-hatch move/rotate parity)', () => {
  it('τοποθετεί τα handles στις ΙΔΙΕΣ θέσεις με το polyline/area (κοινό placement SSoT)', () => {
    for (const ring of [SQUARE, L_RING]) {
      const poly = getPolylineMoveRotateGrips('e', ring, true, 4);
      const hatch = getHatchMoveRotateGrips('e', ring, 4);
      expect(hatch).toHaveLength(2);
      expect(hatch[0].position).toEqual(poly[0].position); // move cross
      expect(hatch[1].position).toEqual(poly[1].position); // rotation handle
      // …και ίδια με το άμεσο placement SSoT.
      const pos = resolveMoveRotateHandleWorld(ring, true)!;
      expect(hatch[0].position).toEqual(pos.move);
      expect(hatch[1].position).toEqual(pos.rotation);
    }
  });

  it('εκπέμπει hatch-move (center, movesEntity) + hatch-rotation (vertex) με διαδοχικά indices', () => {
    const [move, rot] = getHatchMoveRotateGrips('h1', SQUARE, 12);
    expect(move.gripKind).toEqual({ on: 'hatch', kind: 'hatch-move' });
    expect(move.type).toBe('center');
    expect(move.movesEntity).toBe(true);
    expect(move.gripIndex).toBe(12);

    expect(rot.gripKind).toEqual({ on: 'hatch', kind: 'hatch-rotation' });
    expect(rot.type).toBe('vertex');
    expect(rot.movesEntity).toBe(false);
    expect(rot.gripIndex).toBe(13);
  });

  it('εκφυλισμένο όριο (<2 κορυφές) → κανένα handle', () => {
    expect(getHatchMoveRotateGrips('h', [{ x: 1, y: 1 }], 0)).toEqual([]);
    expect(getHatchMoveRotateGrips('h', [], 0)).toEqual([]);
  });
});
