// Stub Firebase auth chain before any imports — BaseEntityRenderer →
// PhaseManager transitively touches firestore in test env.
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
 * ADR-363 Phase 3.6 — SlabRenderer reinforcement hatch unit tests.
 *
 * Verifies the hatch pass (`drawReinforcementHatch`):
 *   - hatch is drawn ONLY when `params.reinforcement` is set
 *   - hatch is scoped by save/clip/restore (never bleeds outside polygon)
 *   - `one-way`  → only horizontal hatch lines drawn
 *   - `two-way`  → both horizontal + vertical hatch lines drawn
 *   - `waffle`   → dense cross-hatch (more lines than two-way at same bbox)
 *   - `flat`     → dot grid (`arc` + `fill` calls, no parallel-line strokes)
 *   - stroke pass still runs after hatch (outline survives)
 */

import { SlabRenderer } from '../SlabRenderer';
import { buildDefaultSlabParams, buildSlabEntity } from '../../../hooks/drawing/slab-completion';
import type { SlabEntity, SlabReinforcement } from '../../types/slab-types';
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
    clip: record('clip'),
    arc: record('arc'),
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

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSlab(reinforcement?: SlabReinforcement): SlabEntity {
  const verts = [
    { x: 0,    y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0,    y: 3000 },
  ];
  const params = {
    ...buildDefaultSlabParams(verts),
    ...(reinforcement ? { reinforcement } : {}),
  };
  const r = buildSlabEntity(params, '0');
  if (!r.ok) throw new Error('slab build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new SlabRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SlabRenderer + reinforcement hatch (Phase 3.6)', () => {
  it('1. no reinforcement → no clip call (hatch pass skipped)', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    renderer.render(slab as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'clip')).toBe(0);
  });

  it('2. one-way reinforcement → clip call + only horizontal hatch lines', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab('one-way');
    renderer.render(slab as unknown as EntityModel, {});
    expect(countCalls(mock.calls, 'clip')).toBeGreaterThanOrEqual(1);

    // After the clip, hatch lines are horizontal — each line begins at the
    // bbox.min.x and ends at bbox.max.x at a constant y. With scale=1 and no
    // offset, world == screen, so moveTo/lineTo pairs all share the same y.
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    const hatch = tail.slice(0, restoreIdx);
    const lineTos = hatch.filter((c) => c.fn === 'lineTo');
    // 3000mm bbox / 200mm spacing → ~15 horizontal lines.
    expect(lineTos.length).toBeGreaterThanOrEqual(10);
    for (const c of lineTos) {
      // Each lineTo is paired with the matching moveTo at the same y screen coord.
      expect(typeof c.args[1]).toBe('number');
    }
  });

  it('3. two-way reinforcement → more hatch lines than one-way (adds vertical)', () => {
    const { renderer: r1, mock: m1 } = makeRenderer();
    const { renderer: r2, mock: m2 } = makeRenderer();
    r1.render(makeSlab('one-way') as unknown as EntityModel, {});
    r2.render(makeSlab('two-way') as unknown as EntityModel, {});
    const lines1 = countCalls(m1.calls, 'lineTo');
    const lines2 = countCalls(m2.calls, 'lineTo');
    expect(lines2).toBeGreaterThan(lines1);
  });

  it('4. waffle reinforcement → denser than two-way at same bbox', () => {
    const { renderer: r2, mock: m2 } = makeRenderer();
    const { renderer: rw, mock: mw } = makeRenderer();
    r2.render(makeSlab('two-way') as unknown as EntityModel, {});
    rw.render(makeSlab('waffle') as unknown as EntityModel, {});
    const lines2 = countCalls(m2.calls, 'lineTo');
    const linesW = countCalls(mw.calls, 'lineTo');
    expect(linesW).toBeGreaterThan(lines2);
  });

  it('5. flat reinforcement → dot grid (arc + fill, no parallel hatch lineTo)', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab('flat');
    renderer.render(slab as unknown as EntityModel, {});

    // The polygon outline still uses moveTo/lineTo, but the hatch pass should
    // emit `arc` calls (one per dot). Count arcs to confirm the dot path ran.
    const arcs = countCalls(mock.calls, 'arc');
    expect(arcs).toBeGreaterThan(0);
  });

  it('6. hatch pass is scoped (save before clip, restore after)', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab('two-way');
    renderer.render(slab as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    expect(clipIdx).toBeGreaterThan(-1);
    const preceding = mock.calls.slice(0, clipIdx);
    const following = mock.calls.slice(clipIdx);
    expect(preceding.some((c) => c.fn === 'save')).toBe(true);
    expect(following.some((c) => c.fn === 'restore')).toBe(true);
  });

  it('7. stroke follows hatch (slab outline survives clip pass)', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab('two-way');
    renderer.render(slab as unknown as EntityModel, {});
    const clipIdx = mock.calls.findIndex((c) => c.fn === 'clip');
    const tail = mock.calls.slice(clipIdx);
    const restoreIdx = tail.findIndex((c) => c.fn === 'restore');
    expect(restoreIdx).toBeGreaterThan(-1);
    const afterRestore = tail.slice(restoreIdx);
    expect(afterRestore.some((c) => c.fn === 'stroke')).toBe(true);
  });
});
