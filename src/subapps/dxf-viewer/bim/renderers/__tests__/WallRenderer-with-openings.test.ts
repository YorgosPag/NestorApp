// Stub Firebase auth chain before any imports — BaseEntityRenderer →
// PhaseManager → GripProvider transitively touches firestore in test env.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-363 Phase 2.5 — WallRenderer boolean-cutout unit tests.
 *
 * Verifies the punch-hosted-openings pass (`destination-out` composite mode):
 *   - opening outline path drawn + filled with destination-out only when
 *     openings are registered for this wall
 *   - composite mode is scoped (save/restore brackets the pass)
 *   - openings registered for OTHER walls are ignored
 *   - the stroke pass follows the cutout (outline survives)
 */

import { WallRenderer } from '../WallRenderer';
import type { OpeningsByWall } from '../WallRenderer';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { buildDefaultOpeningParams, buildOpeningEntity } from '../../../hooks/drawing/opening-completion';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { EntityModel } from '../../../rendering/types/Types';

// ─── Canvas mock ─────────────────────────────────────────────────────────────

interface MockCtxCall { fn: string; args: readonly unknown[] }

function createMockCtx(width = 800, height = 600) {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => {
    calls.push({ fn, args });
    return undefined;
  };
  const canvas = {
    width, height,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }),
  };
  const ctxStub = {
    canvas,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    stroke: record('stroke'),
    fill: record('fill'),
    setLineDash: record('setLineDash'),
    set globalCompositeOperation(v: string) { calls.push({ fn: 'set:globalCompositeOperation', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set lineJoin(v: string) { calls.push({ fn: 'set:lineJoin', args: [v] }); },
    set shadowBlur(v: number) { calls.push({ fn: 'set:shadowBlur', args: [v] }); },
    set shadowColor(v: string) { calls.push({ fn: 'set:shadowColor', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(calls: readonly MockCtxCall[], fn: string): number {
  return calls.filter((c) => c.fn === fn).length;
}

function compositeOpsAfter(calls: readonly MockCtxCall[]): readonly string[] {
  return calls
    .filter((c) => c.fn === 'set:globalCompositeOperation')
    .map((c) => String(c.args[0]));
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeWall(): WallEntity {
  const r = buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: 4000, y: 0 }), '0', 'straight');
  if (!r.ok) throw new Error('wall build failed');
  return r.entity;
}

function makeDoor(host: WallEntity, clickX: number): OpeningEntity {
  const params = buildDefaultOpeningParams(host, { x: clickX, y: 0 }, { kind: 'door' });
  const r = buildOpeningEntity(params, host, '0');
  if (!r.ok) throw new Error('opening build failed');
  return r.entity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new WallRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WallRenderer + openings (Phase 2.5)', () => {
  it('1. no openings registered → no destination-out composite op', () => {
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    renderer.render(wall as unknown as EntityModel, {});
    expect(compositeOpsAfter(mock.calls)).not.toContain('destination-out');
  });

  it('2. opening registered for this wall → destination-out pass scoped by save/restore', () => {
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    const door = makeDoor(wall, 2000);
    const map: OpeningsByWall = new Map([[wall.id, [door]]]);
    renderer.setOpeningsByWall(map);
    renderer.render(wall as unknown as EntityModel, {});

    const ops = compositeOpsAfter(mock.calls);
    expect(ops).toContain('destination-out');

    // Locate the destination-out boundary; ensure a save call precedes it and
    // a restore call follows somewhere later (scoped pass).
    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    const preceding = mock.calls.slice(0, idxComp);
    const following = mock.calls.slice(idxComp);
    expect(preceding.some((c) => c.fn === 'save')).toBe(true);
    expect(following.some((c) => c.fn === 'restore')).toBe(true);
  });

  it('3. cutout fills the opening outline (4 lineTo + closePath + fill)', () => {
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    const door = makeDoor(wall, 2000);
    renderer.setOpeningsByWall(new Map([[wall.id, [door]]]));
    const before = mock.calls.length;
    renderer.render(wall as unknown as EntityModel, {});

    // Cutout pass starts after the wall fill — count lineTo since composite
    // mode was switched.
    const idxComp = mock.calls.findIndex(
      (c, i) => i >= before && c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    expect(idxComp).toBeGreaterThan(-1);
    const after = mock.calls.slice(idxComp);
    const lineTos = countCalls(after, 'lineTo');
    // The opening rectangle has 4 vertices → moveTo + 3 lineTo (rest of the
    // calls live on the closePath path). Allow ≥3 to be forward-compatible.
    expect(lineTos).toBeGreaterThanOrEqual(3);
    expect(after.some((c) => c.fn === 'closePath')).toBe(true);
    expect(after.some((c) => c.fn === 'fill')).toBe(true);
  });

  it('4. openings registered for OTHER walls do not trigger cutout', () => {
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    const door = makeDoor(wall, 2000);
    // Register the door under a foreign wall id — current wall has no entry.
    const map: OpeningsByWall = new Map([['wall_other', [door]]]);
    renderer.setOpeningsByWall(map);
    renderer.render(wall as unknown as EntityModel, {});
    expect(compositeOpsAfter(mock.calls)).not.toContain('destination-out');
  });

  it('5. stroke follows cutout (wall outline survives boolean op)', () => {
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    const door = makeDoor(wall, 2000);
    renderer.setOpeningsByWall(new Map([[wall.id, [door]]]));
    renderer.render(wall as unknown as EntityModel, {});

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    // Find the matching restore that closes the cutout pass.
    const idxRestoreAfter = mock.calls.findIndex((c, i) => i > idxComp && c.fn === 'restore');
    expect(idxRestoreAfter).toBeGreaterThan(idxComp);
    // A stroke call must appear after the restore (the wall outline pass).
    const tail = mock.calls.slice(idxRestoreAfter);
    expect(tail.some((c) => c.fn === 'stroke')).toBe(true);
  });

  it('5b. ADR-396 — wall ring re-traced (beginPath+moveTo) AFTER cutout, BEFORE stroke', () => {
    // Bug regression: punchHostedOpenings issues beginPath per opening, leaving
    // the current path = last opening rect. Without a re-trace, the final stroke
    // would draw the opening rect instead of the wall outline → miters + outline
    // vanish when an opening is hosted.
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    const door = makeDoor(wall, 2000);
    renderer.setOpeningsByWall(new Map([[wall.id, [door]]]));
    renderer.render(wall as unknown as EntityModel, {});

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    const idxRestoreAfter = mock.calls.findIndex((c, i) => i > idxComp && c.fn === 'restore');
    const tail = mock.calls.slice(idxRestoreAfter);
    const idxStroke = tail.findIndex((c) => c.fn === 'stroke');
    expect(idxStroke).toBeGreaterThan(-1);
    // Between restore and that stroke there MUST be a beginPath followed by moveTo
    // (the re-traced wall ring), else the stroke draws the dangling opening path.
    const beforeStroke = tail.slice(0, idxStroke);
    const idxBegin = beforeStroke.findIndex((c) => c.fn === 'beginPath');
    expect(idxBegin).toBeGreaterThan(-1);
    expect(beforeStroke.slice(idxBegin).some((c) => c.fn === 'moveTo')).toBe(true);
  });

  it('6. multiple openings on same wall → cutout per opening', () => {
    const { renderer, mock } = makeRenderer();
    const wall = makeWall();
    const door = makeDoor(wall, 1000);
    const window = makeDoor(wall, 3000);
    renderer.setOpeningsByWall(new Map([[wall.id, [door, window]]]));
    renderer.render(wall as unknown as EntityModel, {});

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    const idxRestoreAfter = mock.calls.findIndex((c, i) => i > idxComp && c.fn === 'restore');
    const cutoutPass = mock.calls.slice(idxComp, idxRestoreAfter);
    // Two openings → two beginPath cycles inside the cutout pass.
    expect(countCalls(cutoutPass, 'beginPath')).toBeGreaterThanOrEqual(2);
    expect(countCalls(cutoutPass, 'fill')).toBeGreaterThanOrEqual(2);
  });
});
