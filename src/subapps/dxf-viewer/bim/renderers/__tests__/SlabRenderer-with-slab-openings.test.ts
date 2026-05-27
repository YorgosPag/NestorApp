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
 * ADR-363 Phase 3.7 — SlabRenderer boolean-cutout unit tests (slab-openings).
 *
 * Mirror του WallRenderer-with-openings.test.ts:
 *   - opening outline path drawn + filled με destination-out μόνο όταν
 *     slab-openings είναι registered για το slab
 *   - composite mode scoped (save/restore brackets)
 *   - openings registered για ΑΛΛΑ slabs αγνοούνται
 *   - stroke pass follows cutout (slab outline survives)
 *   - multi-opening → cutout per opening
 */

import { SlabRenderer } from '../SlabRenderer';
import type { SlabOpeningsBySlab } from '../SlabRenderer';
import { computeSlabGeometry } from '../../geometry/slab-geometry';
import { computeSlabOpeningGeometry } from '../../geometry/slab-opening-geometry';
import type { SlabEntity, SlabParams } from '../../types/slab-types';
import type { SlabOpeningEntity, SlabOpeningParams } from '../../types/slab-opening-types';
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
    arc: record('arc'),
    clip: record('clip'),
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

function makeSlab(id = 'slab_test'): SlabEntity {
  const params: SlabParams = {
    kind: 'floor',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 10000, y: 0, z: 0 },
        { x: 10000, y: 10000, z: 0 },
        { x: 0, y: 10000, z: 0 },
      ],
    },
    levelElevation: 0,
    thickness: 200,
    geometryType: 'box',
  };
  return {
    id,
    type: 'slab',
    kind: 'floor',
    layerId: '0',
    params,
    geometry: computeSlabGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabEntity;
}

function makeShaft(slabId: string, cx: number, cy: number): SlabOpeningEntity {
  const params: SlabOpeningParams = {
    kind: 'shaft',
    slabId,
    outline: {
      vertices: [
        { x: cx - 750, y: cy - 750, z: 0 },
        { x: cx + 750, y: cy - 750, z: 0 },
        { x: cx + 750, y: cy + 750, z: 0 },
        { x: cx - 750, y: cy + 750, z: 0 },
      ],
    },
  };
  return {
    id: `slbopn_${cx}_${cy}`,
    type: 'slab-opening',
    kind: 'shaft',
    layerId: '0',
    params,
    geometry: computeSlabOpeningGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabOpeningEntity;
}

function makeRenderer() {
  const mock = createMockCtx();
  const renderer = new SlabRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SlabRenderer + slab-openings (Phase 3.7)', () => {
  it('1. no slab-openings registered → no destination-out composite op', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    renderer.render(slab as unknown as EntityModel, {});
    expect(compositeOpsAfter(mock.calls)).not.toContain('destination-out');
  });

  it('2. slab-opening registered → destination-out pass scoped by save/restore', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    const shaft = makeShaft(slab.id, 3000, 3000);
    const map: SlabOpeningsBySlab = new Map([[slab.id, [shaft]]]);
    renderer.setSlabOpeningsBySlab(map);
    renderer.render(slab as unknown as EntityModel, {});

    const ops = compositeOpsAfter(mock.calls);
    expect(ops).toContain('destination-out');

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    const preceding = mock.calls.slice(0, idxComp);
    const following = mock.calls.slice(idxComp);
    expect(preceding.some((c) => c.fn === 'save')).toBe(true);
    expect(following.some((c) => c.fn === 'restore')).toBe(true);
  });

  it('3. cutout fills the opening outline (≥3 lineTo + closePath + fill)', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    const shaft = makeShaft(slab.id, 3000, 3000);
    renderer.setSlabOpeningsBySlab(new Map([[slab.id, [shaft]]]));
    renderer.render(slab as unknown as EntityModel, {});

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    expect(idxComp).toBeGreaterThan(-1);
    const after = mock.calls.slice(idxComp);
    expect(countCalls(after, 'lineTo')).toBeGreaterThanOrEqual(3);
    expect(after.some((c) => c.fn === 'closePath')).toBe(true);
    expect(after.some((c) => c.fn === 'fill')).toBe(true);
  });

  it('4. openings registered for OTHER slabs do not trigger cutout', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    const shaft = makeShaft(slab.id, 3000, 3000);
    const map: SlabOpeningsBySlab = new Map([['slab_other', [shaft]]]);
    renderer.setSlabOpeningsBySlab(map);
    renderer.render(slab as unknown as EntityModel, {});
    expect(compositeOpsAfter(mock.calls)).not.toContain('destination-out');
  });

  it('5. stroke follows cutout (slab outline survives boolean op)', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    const shaft = makeShaft(slab.id, 3000, 3000);
    renderer.setSlabOpeningsBySlab(new Map([[slab.id, [shaft]]]));
    renderer.render(slab as unknown as EntityModel, {});

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    const idxRestoreAfter = mock.calls.findIndex((c, i) => i > idxComp && c.fn === 'restore');
    expect(idxRestoreAfter).toBeGreaterThan(idxComp);
    const tail = mock.calls.slice(idxRestoreAfter);
    expect(tail.some((c) => c.fn === 'stroke')).toBe(true);
  });

  it('6. multiple slab-openings on same slab → cutout per opening', () => {
    const { renderer, mock } = makeRenderer();
    const slab = makeSlab();
    const shaftA = makeShaft(slab.id, 2000, 2000);
    const shaftB = makeShaft(slab.id, 7000, 7000);
    renderer.setSlabOpeningsBySlab(new Map([[slab.id, [shaftA, shaftB]]]));
    renderer.render(slab as unknown as EntityModel, {});

    const idxComp = mock.calls.findIndex(
      (c) => c.fn === 'set:globalCompositeOperation' && c.args[0] === 'destination-out',
    );
    const idxRestoreAfter = mock.calls.findIndex((c, i) => i > idxComp && c.fn === 'restore');
    const cutoutPass = mock.calls.slice(idxComp, idxRestoreAfter);
    expect(countCalls(cutoutPass, 'beginPath')).toBeGreaterThanOrEqual(2);
    expect(countCalls(cutoutPass, 'fill')).toBeGreaterThanOrEqual(2);
  });
});
