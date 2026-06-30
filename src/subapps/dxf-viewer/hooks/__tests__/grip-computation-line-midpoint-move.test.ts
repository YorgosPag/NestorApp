/**
 * ADR-363 regression — the LINE MIDPOINT grip must be flagged `movesEntity: true`
 * so the grip-drag paths treat "drag the line body" as a whole-entity move and
 * apply the ORTHO (F8) axis-lock (`applyMoveConstraints` → `movesWhole`).
 *
 * Incident (2026-06-12): ORTHO locked while DRAWING a line but NOT while moving it
 * by its midpoint ("σύρω το σώμα της γραμμής"). Root cause: the midpoint grip was
 * `movesEntity: false`, so `movesWhole` was false in `grip-projections` /
 * `grip-mouse-handlers` and the ORTHO delta-lock was skipped. The endpoints stay
 * `movesEntity: false` (they reshape, not translate).
 *
 * `edgeVertexIndices: [0, 1]` is retained so the COMMIT still routes through
 * `gripToVertexRefs` (line-start + line-end vertexMoves) — the StretchEntityCommand
 * path is unchanged; only the ORTHO eligibility flips.
 */

import { computeDxfEntityGrips } from '../grip-computation';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';

function makeLine(): DxfEntityUnion {
  return {
    id: 'line-1',
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
  } as unknown as DxfEntityUnion;
}

describe('computeDxfEntityGrips — line midpoint = whole-entity move (ADR-363 ORTHO regression)', () => {
  const grips = computeDxfEntityGrips(makeLine());

  it('produces 5 grips: start (0), end (1), midpoint (2), rotation (3), move cross (4)', () => {
    // ADR-363 Slice F/G.5 — grip 3 is the rotation handle (¼-east) and grip 4 is the
    // MOVE cross (¼-west); the first 3 (start/end/midpoint) keep their indices +
    // semantics unchanged (appended-after, so this regression's contract holds).
    expect(grips).toHaveLength(5);
    expect(grips[0].gripIndex).toBe(0);
    expect(grips[1].gripIndex).toBe(1);
    expect(grips[2].gripIndex).toBe(2);
    expect(grips[3].gripIndex).toBe(3);
    expect(grips[3].lineGripKind).toBe('line-rotation');
    expect(grips[4].gripIndex).toBe(4);
    expect(grips[4].lineGripKind).toBe('line-move');
  });

  it('endpoints reshape — movesEntity stays false', () => {
    expect(grips[0].movesEntity).toBe(false);
    expect(grips[1].movesEntity).toBe(false);
  });

  it('midpoint translates the whole line — movesEntity is true (ORTHO eligible)', () => {
    const mid = grips[2];
    expect(mid.type).toBe('edge');
    expect(mid.movesEntity).toBe(true);
  });

  it('midpoint keeps edgeVertexIndices [0,1] so the commit path is unchanged', () => {
    expect(grips[2].edgeVertexIndices).toEqual([0, 1]);
  });
});
