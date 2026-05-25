/**
 * ADR-376 Phase B.1 — opening-renumber-service unit tests.
 *
 * Verifies `computeRenumberUpdates()` pure function across:
 *   - Empty rows
 *   - Single floor: no gaps, with gaps, idempotency
 *   - Per-kind isolation
 *   - Basement floor
 *   - Manual override preserve vs wipe
 *   - All-floors scope με floor-number lookup
 *   - Multi-floor + multi-kind ordering
 *   - Kind filter skip
 *   - Current-floor scope ignores rows outside
 */

import {
  computeRenumberUpdates,
  type RenumberOpeningRow,
  type RenumberComputeArgs,
} from '../opening-renumber-service';
import type { OpeningKind, OpeningParams } from '../../types/opening-types';

// ────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ────────────────────────────────────────────────────────────────────────────

const KIND_PREFIXES: Record<OpeningKind, string> = {
  door: 'Θ',
  'sliding-door': 'Σ',
  'french-door': 'ΔΘ',
  window: 'Π',
  fixed: 'ΣΥ',
};

const BASE_ARGS: Omit<RenumberComputeArgs, 'scope'> = {
  includeManual: false,
  kindPrefixes: KIND_PREFIXES,
  basementPrefix: 'Υ',
  floorNumberByFloorId: new Map(),
};

function row(args: {
  id: string;
  kind?: OpeningKind;
  floorId?: string;
  createdAt: number;
  mark?: string;
  markIsManual?: boolean;
}): RenumberOpeningRow {
  return {
    id: args.id,
    kind: args.kind ?? 'door',
    floorId: args.floorId,
    params: {
      kind: args.kind ?? 'door',
      wallId: 'w1',
      offsetFromStart: 0,
      width: 900,
      height: 2100,
      sillHeight: 0,
      mark: args.mark,
      markIsManual: args.markIsManual,
    } as OpeningParams,
    createdAtMillis: args.createdAt,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('computeRenumberUpdates — current-floor scope', () => {
  const SCOPE = { kind: 'current-floor' as const, floorId: 'fl_0', floorNumber: 0 };

  it('empty rows → empty result', () => {
    const result = computeRenumberUpdates([], { ...BASE_ARGS, scope: SCOPE });
    expect(result.updates).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('single floor, no gaps, chronological order', () => {
    const rows = [
      row({ id: 'o1', floorId: 'fl_0', createdAt: 100, mark: 'Θ.001' }),
      row({ id: 'o2', floorId: 'fl_0', createdAt: 200, mark: 'Θ.002' }),
      row({ id: 'o3', floorId: 'fl_0', createdAt: 300, mark: 'Θ.003' }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE });
    expect(result.updates).toEqual([
      { openingId: 'o1', oldMark: 'Θ.001', newMark: 'Θ.001', kind: 'door', floorNumber: 0 },
      { openingId: 'o2', oldMark: 'Θ.002', newMark: 'Θ.002', kind: 'door', floorNumber: 0 },
      { openingId: 'o3', oldMark: 'Θ.003', newMark: 'Θ.003', kind: 'door', floorNumber: 0 },
    ]);
  });

  it('single floor with gaps (1,2,4,7 → 1,2,3,4)', () => {
    const rows = [
      row({ id: 'o1', floorId: 'fl_0', createdAt: 100, mark: 'Θ.001' }),
      row({ id: 'o2', floorId: 'fl_0', createdAt: 200, mark: 'Θ.002' }),
      row({ id: 'o4', floorId: 'fl_0', createdAt: 400, mark: 'Θ.004' }),
      row({ id: 'o7', floorId: 'fl_0', createdAt: 700, mark: 'Θ.007' }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE });
    expect(result.updates.map((u) => u.newMark)).toEqual(['Θ.001', 'Θ.002', 'Θ.003', 'Θ.004']);
    expect(result.updates.map((u) => u.openingId)).toEqual(['o1', 'o2', 'o4', 'o7']);
  });

  it('per-kind isolation — Θ + Π independent counters', () => {
    const rows = [
      row({ id: 'd1', kind: 'door', floorId: 'fl_0', createdAt: 100 }),
      row({ id: 'w1', kind: 'window', floorId: 'fl_0', createdAt: 150 }),
      row({ id: 'd2', kind: 'door', floorId: 'fl_0', createdAt: 200 }),
      row({ id: 'w2', kind: 'window', floorId: 'fl_0', createdAt: 250 }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE });
    const marks = new Map(result.updates.map((u) => [u.openingId, u.newMark]));
    expect(marks.get('d1')).toBe('Θ.001');
    expect(marks.get('d2')).toBe('Θ.002');
    expect(marks.get('w1')).toBe('Π.001');
    expect(marks.get('w2')).toBe('Π.002');
  });

  it('basement floor -1 → Θ.Υ1.001..', () => {
    const basementScope = { kind: 'current-floor' as const, floorId: 'fl_b1', floorNumber: -1 };
    const rows = [
      row({ id: 'o1', floorId: 'fl_b1', createdAt: 100 }),
      row({ id: 'o2', floorId: 'fl_b1', createdAt: 200 }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: basementScope });
    expect(result.updates.map((u) => u.newMark)).toEqual(['Θ.Υ1.001', 'Θ.Υ1.002']);
  });

  it('manual preserve — skips markIsManual=true', () => {
    const rows = [
      row({ id: 'o1', floorId: 'fl_0', createdAt: 100, mark: 'Θ.001' }),
      row({ id: 'o2', floorId: 'fl_0', createdAt: 200, mark: 'ΧΣ', markIsManual: true }),
      row({ id: 'o3', floorId: 'fl_0', createdAt: 300, mark: 'Θ.003' }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE, includeManual: false });
    expect(result.updates.map((u) => u.openingId)).toEqual(['o1', 'o3']);
    expect(result.updates.map((u) => u.newMark)).toEqual(['Θ.001', 'Θ.002']);
    expect(result.skipped).toEqual([{ openingId: 'o2', reason: 'manual-preserved' }]);
  });

  it('manual wipe — includeManual=true renumbers all including manual', () => {
    const rows = [
      row({ id: 'o1', floorId: 'fl_0', createdAt: 100, mark: 'Θ.001' }),
      row({ id: 'o2', floorId: 'fl_0', createdAt: 200, mark: 'ΧΣ', markIsManual: true }),
      row({ id: 'o3', floorId: 'fl_0', createdAt: 300, mark: 'Θ.003' }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE, includeManual: true });
    expect(result.updates.map((u) => u.openingId)).toEqual(['o1', 'o2', 'o3']);
    expect(result.updates.map((u) => u.newMark)).toEqual(['Θ.001', 'Θ.002', 'Θ.003']);
  });

  it('idempotency — running compute twice produces identical updates', () => {
    const rows = [
      row({ id: 'o1', floorId: 'fl_0', createdAt: 100 }),
      row({ id: 'o4', floorId: 'fl_0', createdAt: 400 }),
      row({ id: 'o7', floorId: 'fl_0', createdAt: 700 }),
    ];
    const first = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE });
    const rerun = rows.map((r, i) => ({
      ...r,
      params: { ...r.params, mark: first.updates[i]!.newMark },
    }));
    const second = computeRenumberUpdates(rerun, { ...BASE_ARGS, scope: SCOPE });
    expect(second.updates.map((u) => u.newMark)).toEqual(first.updates.map((u) => u.newMark));
  });

  it('out-of-scope rows skipped when scope=current-floor', () => {
    const rows = [
      row({ id: 'inside', floorId: 'fl_0', createdAt: 100 }),
      row({ id: 'outside', floorId: 'fl_1', createdAt: 200 }),
    ];
    const result = computeRenumberUpdates(rows, { ...BASE_ARGS, scope: SCOPE });
    expect(result.updates.map((u) => u.openingId)).toEqual(['inside']);
    expect(result.skipped).toEqual([{ openingId: 'outside', reason: 'out-of-scope' }]);
  });

  it('kindFilter restricts to listed kinds', () => {
    const rows = [
      row({ id: 'd1', kind: 'door', floorId: 'fl_0', createdAt: 100 }),
      row({ id: 'w1', kind: 'window', floorId: 'fl_0', createdAt: 200 }),
    ];
    const result = computeRenumberUpdates(rows, {
      ...BASE_ARGS,
      scope: SCOPE,
      kindFilter: ['door'],
    });
    expect(result.updates.map((u) => u.openingId)).toEqual(['d1']);
    expect(result.skipped).toEqual([{ openingId: 'w1', reason: 'kind-filtered' }]);
  });
});

describe('computeRenumberUpdates — all-floors scope', () => {
  const SCOPE = { kind: 'all-floors' as const };

  it('multi-floor + multi-kind ordering', () => {
    const floorMap = new Map<string, number>([
      ['fl_0', 0],
      ['fl_1', 1],
    ]);
    const rows = [
      row({ id: 'g_d1', kind: 'door', floorId: 'fl_0', createdAt: 100 }),
      row({ id: 'g_w1', kind: 'window', floorId: 'fl_0', createdAt: 150 }),
      row({ id: '1_d1', kind: 'door', floorId: 'fl_1', createdAt: 200 }),
      row({ id: '1_d2', kind: 'door', floorId: 'fl_1', createdAt: 250 }),
    ];
    const result = computeRenumberUpdates(rows, {
      ...BASE_ARGS,
      scope: SCOPE,
      floorNumberByFloorId: floorMap,
    });
    const map = new Map(result.updates.map((u) => [u.openingId, u.newMark]));
    expect(map.get('g_d1')).toBe('Θ.001');
    expect(map.get('g_w1')).toBe('Π.001');
    expect(map.get('1_d1')).toBe('Θ.101');
    expect(map.get('1_d2')).toBe('Θ.102');
  });

  it('rows without floorId skipped as no-floor', () => {
    const rows = [
      row({ id: 'o1', floorId: 'fl_0', createdAt: 100 }),
      row({ id: 'orphan', createdAt: 200 }),
    ];
    const result = computeRenumberUpdates(rows, {
      ...BASE_ARGS,
      scope: SCOPE,
      floorNumberByFloorId: new Map([['fl_0', 0]]),
    });
    expect(result.updates.map((u) => u.openingId)).toEqual(['o1']);
    expect(result.skipped).toEqual([{ openingId: 'orphan', reason: 'no-floor' }]);
  });
});
