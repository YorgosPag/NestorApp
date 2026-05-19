/**
 * ADR-363 Phase 2.5 — `opening-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getOpeningGrips()` returns the single `opening-offset` grip positioned
 *     at the opening's world center (geometry.position).
 *   - `applyOpeningGripDrag()`:
 *       · projects the cursor onto host wall axis → new offsetFromStart
 *       · clamps to `[frameWidth, hostLength - width - frameWidth]`
 *       · refuses the move when the host is too short for opening + jambs
 *       · returns the original params unchanged when delta resolves to the
 *         current offset (idempotent identity)
 *       · ignores foreign grip kinds gracefully
 */

import { applyOpeningGripDrag, getOpeningGrips } from '../opening-grips';
import {
  buildDefaultOpeningParams,
  buildOpeningEntity,
} from '../../../hooks/drawing/opening-completion';
import {
  buildDefaultWallParams,
  buildWallEntity,
} from '../../../hooks/drawing/wall-completion';
import type { OpeningEntity } from '../../types/opening-types';
import type { WallEntity } from '../../types/wall-types';

function unwrapWall(r: ReturnType<typeof buildWallEntity>): WallEntity {
  if (!r.ok) throw new Error('expected wall ok, hardErrors: ' + r.hardErrors.join(','));
  return r.entity;
}
function unwrapOpening(r: ReturnType<typeof buildOpeningEntity>): OpeningEntity {
  if (!r.ok) throw new Error('expected opening ok, hardErrors: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('opening-grips (Phase 2.5)', () => {
  // 4000mm horizontal wall along +X. (wall length = 4m).
  const wallStart = { x: 0, y: 0 };
  const wallEnd = { x: 4000, y: 0 };

  function makeHorizontalWall(): WallEntity {
    return unwrapWall(buildWallEntity(buildDefaultWallParams(wallStart, wallEnd), '0', 'straight'));
  }

  function makeDoor(host: WallEntity, clickX: number): OpeningEntity {
    const params = buildDefaultOpeningParams(host, { x: clickX, y: 0 }, { kind: 'door' });
    return unwrapOpening(buildOpeningEntity(params, host, '0'));
  }

  // ─── getOpeningGrips ─────────────────────────────────────────────────────

  it('1. door opening → single `opening-offset` grip', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const grips = getOpeningGrips(opening);
    expect(grips).toHaveLength(1);
    expect(grips[0].openingGripKind).toBe('opening-offset');
    expect(grips[0].type).toBe('center');
    expect(grips[0].movesEntity).toBe(true);
  });

  it('2. grip position equals geometry.position (world center on wall axis)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const grips = getOpeningGrips(opening);
    expect(grips[0].position.x).toBeCloseTo(opening.geometry.position.x, 3);
    expect(grips[0].position.y).toBeCloseTo(opening.geometry.position.y, 3);
  });

  // ─── applyOpeningGripDrag ────────────────────────────────────────────────

  it('3. drag along axis updates offsetFromStart toward cursor projection', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const before = opening.params.offsetFromStart;
    const next = applyOpeningGripDrag('opening-offset', {
      originalParams: opening.params,
      currentPos: { x: 3000, y: 50 }, // off-axis y ignored after projection
      hostWall: host,
    });
    // Projected offset = 3000, candidate left = 3000 - width/2.
    const expected = 3000 - opening.params.width / 2;
    expect(next.offsetFromStart).toBeCloseTo(expected, 0);
    expect(next.offsetFromStart).not.toBe(before);
  });

  it('4. clamp at min: cursor before host start → offset = frameWidth', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const next = applyOpeningGripDrag('opening-offset', {
      originalParams: opening.params,
      currentPos: { x: -500, y: 0 },
      hostWall: host,
    });
    expect(next.offsetFromStart).toBe(opening.params.frameWidth);
  });

  it('5. clamp at max: cursor past host end → offset = hostLength - width - frameWidth', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const hostLengthMm = host.geometry.length * 1000;
    const frameWidth = opening.params.frameWidth ?? 50;
    const expectedMax = hostLengthMm - opening.params.width - frameWidth;
    const next = applyOpeningGripDrag('opening-offset', {
      originalParams: opening.params,
      currentPos: { x: 99999, y: 0 },
      hostWall: host,
    });
    expect(next.offsetFromStart).toBeCloseTo(expectedMax, 0);
  });

  it('6. refuses when host too short for opening + both jambs', () => {
    // 800mm wall + 900mm door = cannot fit even ignoring jambs.
    const shortHost = unwrapWall(buildWallEntity(
      buildDefaultWallParams({ x: 0, y: 0 }, { x: 800, y: 0 }),
      '0',
      'straight',
    ));
    // We can't buildDefaultOpeningParams (validator would reject); fabricate
    // an opening with params pointing at shortHost — the drag handler must
    // hand back originalParams unchanged.
    const longHost = makeHorizontalWall();
    const opening = makeDoor(longHost, 2000);
    const originalParams = { ...opening.params, wallId: shortHost.id };
    const next = applyOpeningGripDrag('opening-offset', {
      originalParams,
      currentPos: { x: 400, y: 0 },
      hostWall: shortHost,
    });
    expect(next).toBe(originalParams); // referential identity, no change
  });

  it('7. idempotent when cursor projects to current center', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const center = opening.geometry.position;
    const next = applyOpeningGripDrag('opening-offset', {
      originalParams: opening.params,
      currentPos: { x: center.x, y: center.y },
      hostWall: host,
    });
    expect(next).toBe(opening.params);
  });

  it('8. unknown grip kind → no-op returns originalParams', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const next = applyOpeningGripDrag(
      'foreign-grip' as 'opening-offset',
      { originalParams: opening.params, currentPos: { x: 0, y: 0 }, hostWall: host },
    );
    expect(next).toBe(opening.params);
  });
});
