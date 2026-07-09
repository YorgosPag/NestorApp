/**
 * ADR-363 Phase 2.5 + facing-flip — `opening-grips` pure handlers tests.
 *
 * Coverage:
 *   - `getOpeningGrips()`:
 *       · door emits 7 grips (move + rotation + 4 corners + facing).
 *       · window emits 6 grips (no facing grip — openDirection undefined for windows).
 *   - `applyOpeningGripDrag()`:
 *       · `opening-move` projects the cursor onto the host wall axis → offsetFromStart
 *         (clamped· refuses when host too short· idempotent identity).
 *       · `opening-corner-ne/se` resize the END jamb (width grows, offset pinned).
 *       · `opening-corner-nw/sw` resize the START jamb (offset + width, end pinned).
 *       · `opening-rotation` click-to-toggle handing left↔right (cursor position ignored).
 *       · `opening-facing`   click-to-toggle openDirection inward↔outward (Revit «Flip Facing»).
 *       · foreign / no-swing kinds → original params unchanged.
 */

import { applyOpeningGripDrag, applyOpeningAltSlide, resolveOpeningAltMove, getOpeningGrips } from '../opening-grips';
import { DEFAULT_FRAME_WIDTH_MM, MAX_SELF_HOST_THICKNESS_MM } from '../../types/opening-types';
import {
  buildDefaultOpeningParams,
  buildOpeningEntity,
  buildDefaultSelfOpeningParams,
  buildSelfOpeningEntity,
} from '../../../hooks/drawing/opening-completion';
import {
  buildDefaultWallParams,
  buildWallEntity,
} from '../../../hooks/drawing/wall-completion';
import type { OpeningEntity } from '../../types/opening-types';
import type { WallEntity } from '../../types/wall-types';
import { gripKindOf } from '../../../hooks/grip-kinds';

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

  // ADR-363 Φ1G.5 Slice 2 — the central `opening-move` grip is no longer emitted
  // (Alt+drag slides the opening along the wall instead). The `opening-move`
  // TRANSFORM is retained (see applyOpeningGripDrag tests below).
  it('1. door emits 6 grips: rotation + 4 corners + facing (no central move grip)', () => {
    const host = makeHorizontalWall();
    const grips = getOpeningGrips(makeDoor(host, 2000));
    expect(grips).toHaveLength(6);
    expect(grips.map((g) => gripKindOf(g, 'opening'))).toEqual([
      'opening-rotation',
      'opening-corner-ne',
      'opening-corner-nw',
      'opening-corner-sw',
      'opening-corner-se',
      'opening-facing',
    ]);
    expect(grips.map((g) => gripKindOf(g, 'opening'))).not.toContain('opening-move');
    expect(grips.every((g) => !g.movesEntity)).toBe(true);
  });

  it('1b. window emits 5 grips: no facing grip (move removed Slice 2; openDirection undefined)', () => {
    const host = makeHorizontalWall();
    const params = buildDefaultOpeningParams(host, { x: 2000, y: 0 }, { kind: 'window' });
    const windowOpening = unwrapOpening(buildOpeningEntity(params, host, '0'));
    const grips = getOpeningGrips(windowOpening);
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => gripKindOf(g, 'opening'))).not.toContain('opening-facing');
    expect(grips.map((g) => gripKindOf(g, 'opening'))).not.toContain('opening-move');
  });

  it('2. central move grip (opening-move) is NOT emitted; first grip is rotation', () => {
    const host = makeHorizontalWall();
    const grips = getOpeningGrips(makeDoor(host, 2000));
    expect(grips.map((g) => gripKindOf(g, 'opening'))).not.toContain('opening-move');
    expect(gripKindOf(grips[0], 'opening')).toBe('opening-rotation');
  });

  it('3. the 4 corners coincide with the cutout outline vertices', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const corners = getOpeningGrips(opening).filter((g) => gripKindOf(g, 'opening')?.startsWith('opening-corner-'));
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

  // ─── rotation = flip handing (click-to-toggle) ──────────────────────────

  it('8. rotation toggles door handing left↔right regardless of cursor position', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const leftDoor = { ...opening.params, handing: 'left' as const };
    // left → right (cursor position irrelevant — click-to-toggle).
    const flippedToRight = applyOpeningGripDrag('opening-rotation', {
      originalParams: leftDoor,
      currentPos: { x: 0, y: 0 },
      hostWall: host,
    });
    expect(flippedToRight.handing).toBe('right');
    // right → left.
    const rightDoor = { ...opening.params, handing: 'right' as const };
    const flippedToLeft = applyOpeningGripDrag('opening-rotation', {
      originalParams: rightDoor,
      currentPos: { x: 0, y: 0 },
      hostWall: host,
    });
    expect(flippedToLeft.handing).toBe('left');
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

  // ─── facing = flip openDirection (Revit «Flip Facing») ───────────────────

  it('13. facing toggles openDirection inward → outward → inward', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const inward = { ...opening.params, openDirection: 'inward' as const };
    // inward → outward.
    const flippedOut = applyOpeningGripDrag('opening-facing', {
      originalParams: inward,
      currentPos: { x: 0, y: 0 },
      hostWall: host,
    });
    expect(flippedOut.openDirection).toBe('outward');
    // outward → inward.
    const outward = { ...opening.params, openDirection: 'outward' as const };
    const flippedIn = applyOpeningGripDrag('opening-facing', {
      originalParams: outward,
      currentPos: { x: 0, y: 0 },
      hostWall: host,
    });
    expect(flippedIn.openDirection).toBe('inward');
  });

  it('14. facing is a no-op for openings without openDirection (window/fixed)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const noFacing = { ...opening.params, openDirection: undefined };
    const next = applyOpeningGripDrag('opening-facing', {
      originalParams: noFacing,
      currentPos: { x: 0, y: 0 },
      hostWall: host,
    });
    expect(next).toBe(noFacing);
  });

  it('15. facing grip positioned on opposite perp side from rotation grip', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const grips = getOpeningGrips(opening);
    const rotationGrip = grips.find((g) => gripKindOf(g, 'opening') === 'opening-rotation')!;
    const facingGrip = grips.find((g) => gripKindOf(g, 'opening') === 'opening-facing')!;
    // Both grips should share the same X (axial, centered on opening).
    expect(facingGrip.position.x).toBeCloseTo(rotationGrip.position.x, 3);
    // Y positions should be on opposite sides (sum ≈ 2 × opening center Y).
    const centerY = opening.geometry.position.y;
    expect(facingGrip.position.y + rotationGrip.position.y).toBeCloseTo(2 * centerY, 3);
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

// ─── ADR-615 — self-hosted (free-standing) opening grip behaviour ────────────
describe('opening-grips — ADR-615 self-hosted (free-standing, centred-box parity)', () => {
  function makeSelfDoor(anchor = { x: 2000, y: 1000, z: 0 }, rotationRad = 0): OpeningEntity {
    const params = buildDefaultSelfOpeningParams(anchor, rotationRad, { kind: 'door' });
    const r = buildSelfOpeningEntity(params, '0');
    if (!r.ok) throw new Error('expected self-opening ok: ' + r.hardErrors.join(','));
    return r.entity;
  }

  it('S1. KEEPS the central move handle (4-way arrow) that the wall-hosted opening drops', () => {
    const grips = getOpeningGrips(makeSelfDoor());
    const kinds = grips.map((g) => gripKindOf(g, 'opening'));
    expect(kinds).toContain('opening-move');
    expect(kinds).toContain('opening-rotation');
    expect(kinds.filter((k) => k?.startsWith('opening-corner'))).toHaveLength(4);
    const moveGrip = grips.find((g) => gripKindOf(g, 'opening') === 'opening-move');
    expect(moveGrip?.movesEntity).toBe(true);
  });

  it('S2. opening-move freely translates selfHost.anchor by the world delta', () => {
    const door = makeSelfDoor({ x: 2000, y: 1000, z: 0 });
    const next = applyOpeningGripDrag('opening-move', {
      originalParams: door.params,
      currentPos: { x: 0, y: 0 },
      delta: { x: 300, y: -120 },
      sceneUnits: 'mm',
    });
    expect(next.selfHost?.anchor.x).toBeCloseTo(2300, 0);
    expect(next.selfHost?.anchor.y).toBeCloseTo(880, 0);
  });

  it('S3. corner resize changes BOTH μήκος (width) and πλάτος (hostThicknessMm)', () => {
    const door = makeSelfDoor();
    const w0 = door.params.width;
    const t0 = door.params.selfHost!.hostThicknessMm;
    const next = applyOpeningGripDrag('opening-corner-ne', {
      originalParams: door.params,
      currentPos: { x: 0, y: 0 },
      delta: { x: 400, y: 400 },
      sceneUnits: 'mm',
    });
    expect(next.width).toBeGreaterThan(w0);
    expect(next.selfHost!.hostThicknessMm).toBeGreaterThan(t0);
  });

  it('S4. πλάτος (thickness) is clamped to MAX_SELF_HOST_THICKNESS_MM (no 1-metre openings)', () => {
    const door = makeSelfDoor();
    const next = applyOpeningGripDrag('opening-corner-ne', {
      originalParams: door.params,
      currentPos: { x: 0, y: 0 },
      delta: { x: 100, y: 100000 }, // absurd across-drag
      sceneUnits: 'mm',
    });
    expect(next.selfHost!.hostThicknessMm).toBeLessThanOrEqual(MAX_SELF_HOST_THICKNESS_MM);
  });

  it('S5. opening-rotation is a REAL rotate (changes selfHost.rotationRad, not a handing flip)', () => {
    const door = makeSelfDoor({ x: 2000, y: 1000, z: 0 }, 0);
    const next = applyOpeningGripDrag('opening-rotation', {
      originalParams: door.params,
      currentPos: { x: 0, y: 0 },
      delta: { x: 220, y: 180 },
      sceneUnits: 'mm',
    });
    expect(next.selfHost?.rotationRad).not.toBe(0);
  });

  it('S6. opening-facing still flips the swing side (host-agnostic click-toggle)', () => {
    const door = makeSelfDoor();
    const inward = { ...door.params, openDirection: 'inward' as const };
    const next = applyOpeningGripDrag('opening-facing', {
      originalParams: inward,
      currentPos: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
      sceneUnits: 'mm',
    });
    expect(next.openDirection).toBe('outward');
  });
});

// ─── Φ1G.5 Slice 2 — Alt-drag «move-from-characteristic-point» (slide along wall) ──
describe('applyOpeningAltSlide (Alt move along host wall)', () => {
  const wallStart = { x: 0, y: 0 };
  const wallEnd = { x: 4000, y: 0 }; // 4m horizontal wall along +X
  const makeHorizontalWall = (): WallEntity =>
    unwrapWall(buildWallEntity(buildDefaultWallParams(wallStart, wallEnd), '0', 'straight'));
  const makeDoor = (host: WallEntity, clickX: number): OpeningEntity =>
    unwrapOpening(buildOpeningEntity(buildDefaultOpeningParams(host, { x: clickX, y: 0 }, { kind: 'door' }), host, '0'));

  it('slides the opening along the wall by the projected delta (base-point semantics)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const base = opening.geometry.position; // any characteristic point on the opening
    const next = applyOpeningAltSlide({
      originalParams: opening.params,
      basePoint: { x: base.x, y: base.y },
      currentPos: { x: base.x + 500, y: base.y + 999 }, // +500 along axis (perp ignored)
      hostWall: host,
    });
    expect(next.offsetFromStart).toBeCloseTo(opening.params.offsetFromStart + 500, 0);
  });

  it('ignores the perpendicular component (constrained to the wall axis → no-op)', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const base = opening.geometry.position;
    const next = applyOpeningAltSlide({
      originalParams: opening.params,
      basePoint: { x: base.x, y: base.y },
      currentPos: { x: base.x, y: base.y + 800 }, // pure perpendicular drag
      hostWall: host,
    });
    expect(next).toBe(opening.params);
  });

  it('clamps within [frame, hostLength − width − frame]', () => {
    const host = makeHorizontalWall();
    const opening = makeDoor(host, 2000);
    const base = opening.geometry.position;
    const next = applyOpeningAltSlide({
      originalParams: opening.params,
      basePoint: { x: base.x, y: base.y },
      currentPos: { x: base.x + 99999, y: base.y }, // far past the end → clamp
      hostWall: host,
    });
    const frame = opening.params.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
    expect(next.offsetFromStart).toBeCloseTo(4000 - opening.params.width - frame, 0);
  });
});

// ─── Φ1G.5 Slice 2b/2c — resolveOpeningAltMove (slide / re-host «Pick New Host») ──
describe('resolveOpeningAltMove', () => {
  const makeHWall = (): WallEntity =>
    unwrapWall(buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: 4000, y: 0 }), '0', 'straight'));
  const makeVWall = (): WallEntity =>
    unwrapWall(buildWallEntity(buildDefaultWallParams({ x: 2000, y: 0 }, { x: 2000, y: 4000 }), '0', 'straight'));
  const makeDoor = (host: WallEntity): OpeningEntity =>
    unwrapOpening(buildOpeningEntity(buildDefaultOpeningParams(host, { x: 1000, y: 0 }, { kind: 'door' }), host, '0'));

  it('same wall (nearest) → slides along it, wallId unchanged', () => {
    const h = makeHWall();
    const o = makeDoor(h);
    const r = resolveOpeningAltMove({
      originalParams: o.params,
      basePoint: { x: o.geometry.position.x, y: o.geometry.position.y },
      currentPos: { x: o.geometry.position.x + 500, y: 0 },
      currentHost: h,
      candidateWalls: [h],
      rehostToleranceWorld: 600,
    })!;
    expect(r.host.id).toBe(h.id);
    expect(r.params.wallId).toBe(h.id);
    expect(r.params.offsetFromStart).toBeCloseTo(o.params.offsetFromStart + 500, 0);
  });

  it('cursor near ANOTHER wall → re-hosts (wallId changes to that wall)', () => {
    const h = makeHWall();
    const v = makeVWall();
    const o = makeDoor(h);
    const r = resolveOpeningAltMove({
      originalParams: o.params,
      basePoint: { x: o.geometry.position.x, y: o.geometry.position.y },
      currentPos: { x: 2000, y: 1500 }, // on the vertical wall's axis
      currentHost: h,
      candidateWalls: [h, v],
      rehostToleranceWorld: 600,
    })!;
    expect(r.host.id).toBe(v.id);
    expect(r.params.wallId).toBe(v.id);
  });

  it('forcedHost overrides the proximity scan (3D cursor-picked wall)', () => {
    const h = makeHWall();
    const v = makeVWall();
    const o = makeDoor(h);
    const r = resolveOpeningAltMove({
      originalParams: o.params,
      basePoint: { x: o.geometry.position.x, y: o.geometry.position.y },
      currentPos: { x: 1200, y: 0 }, // still near the horizontal wall…
      currentHost: h,
      candidateWalls: [h, v],
      rehostToleranceWorld: 600,
      forcedHost: v, // …but the cursor-picked wall wins → re-host to v
    })!;
    expect(r.params.wallId).toBe(v.id);
  });
});
