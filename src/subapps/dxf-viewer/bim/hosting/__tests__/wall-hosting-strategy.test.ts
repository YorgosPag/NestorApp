/**
 * ADR-441 Slice WALL — wall hosting strategy + host-on-snap resolver tests.
 *
 * Γραμμικό hosting τοίχου: start/end x/y bindings → τα άκρα ακολουθούν τους άξονες. Καλύπτει:
 * reconcile re-derive (start/end + geometry), only-changed null, outline ring, και τον
 * resolver (axis-aligned guard + Finish-Face extend).
 */

import { wallHostingStrategy } from '../wall-hosting-strategy';
import type { GuideOffsetLookup } from '../derive-slots';
import type { GuideBinding } from '../guide-binding-types';
import {
  buildDefaultWallParams,
  buildWallEntity,
  resolveWallGridBindings,
} from '../../../hooks/drawing/wall-completion';
import { computeWallGeometry } from '../../geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';

const lookup = (offsets: Record<string, number>): GuideOffsetLookup => (id) => offsets[id];

const bindings: GuideBinding[] = [
  { guideId: 'gx', slot: 'start-x' },
  { guideId: 'gx', slot: 'end-x' },
];

// Κάθετος τοίχος (centered axis) στο x=0, y 0→4000.
const hostedWall = (): WallEntity => {
  const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 0, y: 4000 }, {}, 'mm');
  const built = buildWallEntity(params, '0', 'straight', 'mm');
  if (!built.ok) throw new Error('wall build failed');
  return { ...built.entity, guideBindings: bindings };
};

describe('wallHostingStrategy', () => {
  it('reconcile → τα bound άκρα (x) ακολουθούν τον άξονα', () => {
    const update = wallHostingStrategy.reconcile(hostedWall(), lookup({ gx: 2500 }));
    expect(update).not.toBeNull();
    const nextParams = update!.nextParams as WallParams;
    expect(nextParams.start.x).toBe(2500);
    expect(nextParams.end.x).toBe(2500);
    expect(nextParams.start.y).toBe(0); // y ελεύθερο (κανένα y-binding)
    expect(update!.type).toBe('wall');
    expect(update!.nextGeometry).toEqual(computeWallGeometry(nextParams, 'straight'));
  });

  it('only-changed: null όταν ο άξονας ταυτίζεται με το x', () => {
    expect(wallHostingStrategy.reconcile(hostedWall(), lookup({ gx: 0 }))).toBeNull();
  });

  it('outline → κλειστό ring (outer + inner)', () => {
    const update = wallHostingStrategy.reconcile(hostedWall(), lookup({ gx: 2500 }))!;
    const ring = wallHostingStrategy.outline(update.nextGeometry);
    expect(ring.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Host-on-snap resolver ───────────────────────────────────────────────────

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({ id, axis, offset, visible: true } as Guide);

const reader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});

describe('resolveWallGridBindings', () => {
  it('κάθετος τοίχος με Finish-Face → start-x/end-x με extend (παρειά στον άξονα)', () => {
    // Παρειά (click) στο x=1000· άξονας τοίχου μετατοπισμένος κατά +100 (mm) → x=1100.
    const r = reader([guide('gx', 'X', 1000)]);
    const bindings = resolveWallGridBindings(
      { x: 1000, y: 0 },
      { x: 1000, y: 4000 },
      { start: { x: 1100, y: 0 }, end: { x: 1100, y: 4000 } },
      r,
      1,
      'mm',
    );
    const startX = bindings.find((b) => b.slot === 'start-x');
    expect(startX?.guideId).toBe('gx');
    expect(startX?.extend).toBeCloseTo(100, 6);
    expect(bindings.some((b) => b.slot === 'end-x')).toBe(true);
  });

  it('διαγώνιος τοίχος → κανένα binding (μη axis-aligned)', () => {
    const r = reader([guide('gx', 'X', 0), guide('gy', 'Y', 0)]);
    const bindings = resolveWallGridBindings(
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { start: { x: 0, y: 0 }, end: { x: 1000, y: 1000 } },
      r,
      1,
      'mm',
    );
    expect(bindings).toEqual([]);
  });

  it('κάθετος τοίχος με άκρα σε οριζόντιους άξονες → start-y/end-y bindings', () => {
    const r = reader([guide('gx', 'X', 0), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)]);
    const bindings = resolveWallGridBindings(
      { x: 0, y: 0 },
      { x: 0, y: 4000 },
      { start: { x: 0, y: 0 }, end: { x: 0, y: 4000 } },
      r,
      1,
      'mm',
    );
    expect(bindings.find((b) => b.slot === 'start-y')?.guideId).toBe('y0');
    expect(bindings.find((b) => b.slot === 'end-y')?.guideId).toBe('y1');
  });
});
