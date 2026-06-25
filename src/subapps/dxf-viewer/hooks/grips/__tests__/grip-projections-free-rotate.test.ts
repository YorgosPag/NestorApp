/**
 * ADR-397 — buildRotateReferencePreview FREE rotate (`rotate-free`) ghost tests.
 *
 * The Revit/AutoCAD free rotate spins the entity live from the centre. The preview
 * must encode the cursor sweep through the SAME identity the 6-click reference flow
 * uses: `anchorPos = pivot + refDir`, `delta = alignDir − refDir`, with
 * `rotatePivot = pivot`, so `apply*GripDrag('*-rotation', …)` sweeps
 * `angle(align) − angle(ref)` around the centre. Locks the signed direction
 * (positive = CCW) and the no-baseline (pivot ⊙ only) case.
 */

import {
  buildRotateReferencePreview,
  rotateDeltaForAngleDeg,
  rotateSweepDegFromDirs,
  resolveLiveRotationFromCursor,
} from '../grip-projections';
import type { UnifiedGripInfo } from '../unified-grip-types';

const PIVOT = { x: 0, y: 0 };

function rotationGrip(): UnifiedGripInfo {
  return {
    id: 'g', source: 'dxf', type: 'vertex',
    entityId: 'wall_1', gripIndex: 4,
    wallGripKind: 'wall-rotation',
    position: PIVOT, movesEntity: false,
  } as unknown as UnifiedGripInfo;
}

describe('ADR-397 — buildRotateReferencePreview rotate-free', () => {
  it('baseline East + cursor North → +90° CCW sweep encoded in anchor/delta', () => {
    const baseline = { x: 10, y: 0 };  // refDir = East (φ0 = 0°)
    const cursor = { x: 0, y: 10 };    // alignDir = North (φ = 90°)
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, cursor, baseline,
    );
    expect(preview).not.toBeNull();
    // anchor = pivot + refDir = East arm; currentPos = anchor + delta = pivot + alignDir = North.
    expect(preview!.anchorPos).toEqual({ x: 10, y: 0 });
    expect(preview!.delta).toEqual({ x: -10, y: 10 });
    expect(preview!.rotatePivot).toEqual(PIVOT);
    expect(preview!.hotGrip).toBe(true);
    // currentPos (anchor+delta) points North → +90° from the East reference (CCW).
    const currentPos = { x: preview!.anchorPos!.x + preview!.delta.x, y: preview!.anchorPos!.y + preview!.delta.y };
    expect(currentPos).toEqual({ x: 0, y: 10 });
  });

  it('cursor South of the East baseline → negative (CW) sweep', () => {
    const baseline = { x: 10, y: 0 };  // East
    const cursor = { x: 0, y: -10 };   // South → −90° (CW)
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, cursor, baseline,
    );
    const currentPos = { x: preview!.anchorPos!.x + preview!.delta.x, y: preview!.anchorPos!.y + preview!.delta.y };
    // currentPos South of the East reference → the sweep is clockwise (negative Y).
    expect(currentPos).toEqual({ x: 0, y: -10 });
  });

  it('no baseline yet → centre locked, zero sweep (pivot ⊙ only)', () => {
    const cursor = { x: 5, y: 5 };
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, cursor, null,
    );
    expect(preview).not.toBeNull();
    expect(preview!.delta).toEqual({ x: 0, y: 0 });
    expect(preview!.anchorPos).toEqual(PIVOT);
    expect(preview!.rotatePivot).toEqual(PIVOT);
  });

  it('null pivot (centre not picked) → null preview', () => {
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', null, null, null, null, { x: 5, y: 5 }, { x: 1, y: 0 },
    );
    expect(preview).toBeNull();
  });

  it('live sweep is signed: cursor CCW of baseline → +deg in rotateSweepDeg', () => {
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 0, y: 10 }, { x: 10, y: 0 },
    );
    expect(preview!.rotateSweepDeg).toBeCloseTo(90, 6);
    expect(preview!.rotateReadoutAnchor).toEqual({ x: 0, y: 10 });
  });
});

describe('ADR-397 Σ3 — typed angle override', () => {
  it('typedAngleDeg=90 → unit-East ghost rotated +90°, readout shows 90', () => {
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 3, y: 4 }, { x: 1, y: 0 }, 90,
    );
    expect(preview!.anchorPos).toEqual({ x: 1, y: 0 });   // pivot + East
    expect(preview!.delta.x).toBeCloseTo(-1, 6);          // cos90−1
    expect(preview!.delta.y).toBeCloseTo(1, 6);           // sin90
    expect(preview!.rotateSweepDeg).toBe(90);
    expect(preview!.rotateReadoutAnchor).toEqual({ x: 3, y: 4 }); // pinned to the cursor
  });

  it('typed overrides the cursor sweep (ignores freeBaseline/cursor geometry)', () => {
    const a = buildRotateReferencePreview(rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 99, y: -99 }, { x: 10, y: 0 }, 30);
    const b = buildRotateReferencePreview(rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 5, y: 5 }, { x: 0, y: 7 }, 30);
    expect(a!.delta).toEqual(b!.delta);                   // same typed angle → same ghost
    expect(a!.rotateSweepDeg).toBe(30);
  });
});

describe('ADR-397 Σ3 — pure angle helpers', () => {
  it('rotateDeltaForAngleDeg: 0°→(0,0), 90°→(−1,1), 180°→(−2,0)', () => {
    expect(rotateDeltaForAngleDeg(0).x).toBeCloseTo(0, 6);
    expect(rotateDeltaForAngleDeg(0).y).toBeCloseTo(0, 6);
    expect(rotateDeltaForAngleDeg(90).x).toBeCloseTo(-1, 6);
    expect(rotateDeltaForAngleDeg(90).y).toBeCloseTo(1, 6);
    expect(rotateDeltaForAngleDeg(180).x).toBeCloseTo(-2, 6);
    expect(rotateDeltaForAngleDeg(180).y).toBeCloseTo(0, 6);
  });

  it('rotateSweepDegFromDirs: signed + normalized to (−180,180]', () => {
    expect(rotateSweepDegFromDirs({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 6);   // CCW
    expect(rotateSweepDegFromDirs({ x: 1, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-90, 6); // CW
    expect(rotateSweepDegFromDirs({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180, 6); // half-turn → +180
    expect(rotateSweepDegFromDirs({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 6);
  });
});

describe('ADR-040 Φ12 — resolveLiveRotationFromCursor (live = React parity)', () => {
  it('rotate-free returns rotateCursorDriven so the ghost may recompute live', () => {
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 0, y: 10 }, { x: 10, y: 0 },
    );
    expect(preview!.rotateCursorDriven).toBe(true);
  });

  it('typed-angle is NOT cursor-driven (stays on the React dragPreview)', () => {
    const preview = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 3, y: 4 }, { x: 1, y: 0 }, 90,
    );
    expect(preview!.rotateCursorDriven).toBeUndefined();
  });

  it('free rotate: live recompute at a new cursor == buildRotateReferencePreview at that cursor', () => {
    const baseline = { x: 10, y: 0 };
    // The drag snapshot the React path produced at the FIRST cursor.
    const snap = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, { x: 0, y: 10 }, baseline,
    )!;
    // The cursor moves to a new position — the live ghost recomputes off the snapshot.
    const newCursor = { x: -7, y: 7 };
    const live = resolveLiveRotationFromCursor(snap, newCursor);
    // The React path would have produced this at the new cursor (same baseline/pivot).
    const reactAtNew = buildRotateReferencePreview(
      rotationGrip(), 'rotate-free', PIVOT, null, null, null, newCursor, baseline,
    )!;
    expect(live.delta).toEqual(reactAtNew.delta);
    expect(live.rotateSweepDeg).toBeCloseTo(reactAtNew.rotateSweepDeg!, 6);
    expect(live.rotateReadoutAnchor).toEqual(newCursor);
  });

  it('6-click align-end: live recompute updates the align line + matches the React path', () => {
    const refStart = { x: 0, y: 0 };
    const refEnd = { x: 10, y: 0 };       // refDir = East
    const alignStart = { x: 2, y: 2 };
    const snap = buildRotateReferencePreview(
      rotationGrip(), 'await-align-end', PIVOT, refStart, refEnd, alignStart, { x: 5, y: 5 },
    )!;
    expect(snap.rotateCursorDriven).toBe(true);
    const newCursor = { x: 2, y: 9 };     // alignDir = North (from alignStart)
    const live = resolveLiveRotationFromCursor(snap, newCursor);
    const reactAtNew = buildRotateReferencePreview(
      rotationGrip(), 'await-align-end', PIVOT, refStart, refEnd, alignStart, newCursor,
    )!;
    expect(live.delta).toEqual(reactAtNew.delta);
    expect(live.rotateAlignLine).toEqual({ from: alignStart, to: newCursor });
  });
});
