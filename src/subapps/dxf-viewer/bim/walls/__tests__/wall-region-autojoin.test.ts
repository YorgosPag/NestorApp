/**
 * ADR-363 Phase 1K — region-fill wall auto-join (Revit "Allow Join") tests.
 *
 * A filling wall whose endpoint sits on a neighbour's FACE must extend to the
 * neighbour's CENTRELINE so the junction trim can butt it cleanly (no gap).
 */

import { extendFillingWallToNeighbors } from '../wall-region-autojoin';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../types/wall-types';

function makeWall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  thickness = 200,
  idSuffix = '',
): WallEntity {
  const params: WallParams = { ...buildDefaultWallParams(start, end), thickness, dna: undefined };
  const result = buildWallEntity(params, '0', 'straight');
  if (!result.ok) throw new Error('build failed: ' + result.hardErrors.join(', '));
  return idSuffix ? { ...result.entity, id: result.entity.id + idSuffix } : result.entity;
}

describe('extendFillingWallToNeighbors', () => {
  // Through wall: centreline y=0, thickness 300 → faces at y=±150.
  const through = makeWall({ x: -1000, y: 0 }, { x: 1000, y: 0 }, 300, 'THRU');

  it('extends an endpoint sitting on the neighbour face to the neighbour centreline', () => {
    // Filling wall whose START (0,150) sits on the through wall's TOP face (y=150).
    const fill = makeWall({ x: 0, y: 150 }, { x: 0, y: 2000 }, 100, 'FILL');
    const joined = extendFillingWallToNeighbors(fill, [through], 'mm');
    expect(joined.params.start.x).toBeCloseTo(0, 3);
    expect(joined.params.start.y).toBeCloseTo(0, 3);   // pulled down to centreline
    expect(joined.params.end.y).toBeCloseTo(2000, 3);  // far end untouched
    // Geometry recomputed → longer wall.
    expect(joined.geometry.length).toBeGreaterThan(fill.geometry.length);
  });

  it('leaves the wall unchanged when there are no neighbours', () => {
    const fill = makeWall({ x: 0, y: 150 }, { x: 0, y: 2000 }, 100, 'FILL');
    expect(extendFillingWallToNeighbors(fill, [], 'mm')).toBe(fill);
  });

  it('does not extend to a neighbour beyond the join range (gap > half + slack)', () => {
    // Endpoint at y=400 → 400 from the centreline > half(150)+slack(50)=200 → reject.
    const fill = makeWall({ x: 0, y: 400 }, { x: 0, y: 2000 }, 100, 'FILL');
    const r = extendFillingWallToNeighbors(fill, [through], 'mm');
    expect(r.params.start.y).toBeCloseTo(400, 3);
  });

  it('is idempotent — an already-joined endpoint (on the centreline) does not move again', () => {
    const fill = makeWall({ x: 0, y: 150 }, { x: 0, y: 2000 }, 100, 'FILL');
    const joined = extendFillingWallToNeighbors(fill, [through], 'mm');
    expect(extendFillingWallToNeighbors(joined, [through], 'mm')).toBe(joined);
  });

  it('extends BOTH endpoints when each sits on a different neighbour', () => {
    // Two parallel through walls (y=0 and y=3000, half=150). A vertical fill between
    // them with both ends on the inner faces (y=150 and y=2850).
    const top = makeWall({ x: -1000, y: 3000 }, { x: 1000, y: 3000 }, 300, 'TOP');
    const fill = makeWall({ x: 0, y: 150 }, { x: 0, y: 2850 }, 100, 'FILL');
    const joined = extendFillingWallToNeighbors(fill, [through, top], 'mm');
    expect(joined.params.start.y).toBeCloseTo(0, 3);     // to bottom centreline
    expect(joined.params.end.y).toBeCloseTo(3000, 3);    // to top centreline
  });
});
