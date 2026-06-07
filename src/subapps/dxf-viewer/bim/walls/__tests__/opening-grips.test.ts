/**
 * ADR-363 Phase 2.5 — `opening-grips` pure handlers tests (full wall parity).
 *
 * Coverage:
 *   - `getOpeningGrips()` emits 6 grips (move + rotation + 4 corners), centred-box
 *     layout, with the correct `openingGripKind` per role.
 *   - `applyOpeningGripDrag()`:
 *       · `opening-move` projects the cursor onto the host wall axis → offsetFromStart
 *         (clamped· refuses when host too short· idempotent identity).
 *       · `opening-corner-ne/se` resize the END jamb (width grows, offset pinned).
 *       · `opening-corner-nw/sw` resize the START jamb (offset + width, end pinned).
 *       · `opening-rotation` flips door handing by cursor side (deterministic).
 *       · foreign / no-swing kinds → original params unchanged.
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

describe('opening-grips (Phase 2.5 — wall parity)', () => {
  // 4000mm horizontal wall along +X (wall length = 4m).
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

  it('1. emits 6 grips: move + rotation + 4 corners', () => {
    const host = makeHorizontalWall();
    const grips = getOpeningGrips(makeDoor(host, 2000));
    expect(grips).toHaveLength(6);
    expect(grips.map((g) => g.openingGripKind)).toEqual([
      'opening-move',
      'opening-rotation',
      'opening-corner-ne',
      'opening-corner-nw',
      'opening-corner-sw',
      'opening-corner-se',
    ]);
    expect(grips[0].type).toBe('center');
    expect(grips[0].movesEntity).toBe(true);
    expect(grips[1].movesEntity).toBe(false);
  });

  it('2. move grip sits at geometry.position (opening world centre)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const move = getOpeningGrips(opening)[0];
    expect(move.position.x).toBeCloseTo(opening.geometry.position.x, 3);
    expect(move.position.y).toBeCloseTo(opening.geometry.position.y, 3);
  });

  it('3. the 4 corners coincide with the cutout outline vertices', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const corners = getOpeningGrips(opening).slice(2);
    const outline = opening.geometry.outline.vertices;
    // Every corner grip must match some outline vertex (set equality up to ε).
    for (const c of corners) {
      const hit = outline.some(
        (v) => Math.abs(v.x - c.position.x) < 1e-6 && Math.abs(v.y - c.position.y) < 1e-6,
      );
      expect(hit).toBe(true);
    }
  });

  // ─── move (along wall) ───────────────────────────────────────────────────

  it('4. opening-move projects cursor → offsetFromStart, clamps, idempotent', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const moved = applyOpeningGripDrag('opening-move', {
      originalParams: opening.params,
      currentPos: { x: 3000, y: 50 },
      hostWall: host,
    });
    expect(moved.offsetFromStart).toBeCloseTo(3000 - opening.params.width / 2, 0);
    // Idempotent when cursor projects to the current centre.
    const center = opening.geometry.position;
    const same = applyOpeningGripDrag('opening-move', {
      originalParams: opening.params,
      currentPos: { x: center.x, y: center.y },
      hostWall: host,
    });
    expect(same).toBe(opening.params);
  });

  // ─── corner resize ───────────────────────────────────────────────────────

  it('5. end corner (ne/se) grows width, start jamb (offset) pinned', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const { offsetFromStart, width } = opening.params;
    const next = applyOpeningGripDrag('opening-corner-ne', {
      originalParams: opening.params,
      currentPos: { x: offsetFromStart + width + 300, y: 0 },
      hostWall: host,
    });
    expect(next.offsetFromStart).toBe(offsetFromStart); // start jamb pinned
    expect(next.width).toBeCloseTo(width + 300, 0);
  });

  it('6. start corner (nw/sw) moves start jamb, end jamb pinned', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const { offsetFromStart, width } = opening.params;
    const endAxial = offsetFromStart + width;
    const next = applyOpeningGripDrag('opening-corner-sw', {
      originalParams: opening.params,
      currentPos: { x: offsetFromStart - 200, y: 0 },
      hostWall: host,
    });
    expect(next.offsetFromStart).toBeCloseTo(offsetFromStart - 200, 0);
    expect(next.offsetFromStart + next.width).toBeCloseTo(endAxial, 0); // end jamb pinned
  });

  it('7. corner resize clamps width to MIN_OPENING_WIDTH_MM', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const { offsetFromStart } = opening.params;
    // Drag the end jamb far back past the start jamb → clamps to min width.
    const next = applyOpeningGripDrag('opening-corner-se', {
      originalParams: opening.params,
      currentPos: { x: offsetFromStart - 1000, y: 0 },
      hostWall: host,
    });
    expect(next.width).toBeGreaterThan(0);
    expect(next.offsetFromStart).toBe(offsetFromStart);
  });

  // ─── rotation = flip handing ─────────────────────────────────────────────

  it('8. rotation flips door handing by cursor side (deterministic)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const leftDoor = { ...opening.params, handing: 'left' as const };
    const centerAxial = leftDoor.offsetFromStart + leftDoor.width / 2;
    // Cursor on the end side (axial > centre) → 'right'.
    const flipped = applyOpeningGripDrag('opening-rotation', {
      originalParams: leftDoor,
      currentPos: { x: centerAxial + 500, y: 300 },
      hostWall: host,
    });
    expect(flipped.handing).toBe('right');
    // Same side as current handing → no-op (referential identity).
    const same = applyOpeningGripDrag('opening-rotation', {
      originalParams: leftDoor,
      currentPos: { x: centerAxial - 500, y: 300 },
      hostWall: host,
    });
    expect(same).toBe(leftDoor);
  });

  it('9. rotation is a no-op for openings without a swing (no handing)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const noSwing = { ...opening.params, handing: undefined };
    const next = applyOpeningGripDrag('opening-rotation', {
      originalParams: noSwing,
      currentPos: { x: 3000, y: 300 },
      hostWall: host,
    });
    expect(next).toBe(noSwing);
  });

  // ─── guards ──────────────────────────────────────────────────────────────

  it('10. unknown grip kind → no-op returns originalParams', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const next = applyOpeningGripDrag('foreign-grip' as 'opening-move', {
      originalParams: opening.params,
      currentPos: { x: 0, y: 0 },
      hostWall: host,
    });
    expect(next).toBe(opening.params);
  });

  it('12. METRES scene — move & resize convert scene-units→mm (regression)', () => {
    // 4m wall in a metres scene. Cursor positions are in metres (scene units).
    const host = unwrapWall(
      buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: 4, y: 0 }, undefined, 'm'), '0', 'straight', 'm'),
    );
    const opening = unwrapOpening(
      buildOpeningEntity(buildDefaultOpeningParams(host, { x: 2, y: 0 }, { kind: 'door' }, 'm'), host, '0', 'm'),
    );
    // Move: cursor at 3m → offsetFromStart ≈ 3000mm − width/2 (NOT clamped to a boundary).
    const moved = applyOpeningGripDrag('opening-move', {
      originalParams: opening.params,
      currentPos: { x: 3, y: 0 },
      hostWall: host,
    });
    expect(moved.offsetFromStart).toBeCloseTo(3000 - opening.params.width / 2, 0);
    expect(moved.offsetFromStart).not.toBe(opening.params.offsetFromStart);
    // End-corner resize: cursor at 3m → end jamb at 3000mm → width = 3000 − offset.
    const resized = applyOpeningGripDrag('opening-corner-ne', {
      originalParams: opening.params,
      currentPos: { x: 3, y: 0 },
      hostWall: host,
    });
    expect(resized.width).toBeCloseTo(3000 - opening.params.offsetFromStart, 0);
    expect(resized.width).not.toBe(opening.params.width);
  });

  it('11. move refuses when host too short for opening + jambs', () => {
    const shortHost = unwrapWall(
      buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: 800, y: 0 }), '0', 'straight'),
    );
    const opening = makeDoor(makeHorizontalWall(), 2000);
    const originalParams = { ...opening.params, wallId: shortHost.id };
    const next = applyOpeningGripDrag('opening-move', {
      originalParams,
      currentPos: { x: 400, y: 0 },
      hostWall: shortHost,
    });
    expect(next).toBe(originalParams);
  });
});
