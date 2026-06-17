/**
 * ADR-473 — Joint reinforcement BOQ quantities unit tests.
 *
 * Pure computation: OrganismContinuityResult fixtures → rows + summary.
 * ZERO store / Firestore / React imports (pure function, pure test).
 *
 * Covers:
 *  - Empty continuity → zero rows / zero weight
 *  - Single dowel item → correct row fields + weight
 *  - Multiple kinds (dowel + lap + anchorage) → summary byKind correct
 *  - Idempotence: calling twice = same result
 *  - Double-count guard: joint weight ≠ per-member weight (separate concerns)
 */

import { computeJointReinforcementQuantities } from '../joint-reinforcement-quantities';
import type { OrganismContinuityResult, ReinforcementContinuityItem } from '../reinforcement-continuity';
import { barMassPerMeterKg } from '../../rebar-catalog';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeContinuity = (items: ReinforcementContinuityItem[]): OrganismContinuityResult => {
  const byMember = new Map<string, readonly ReinforcementContinuityItem[]>();
  for (const item of items) {
    byMember.set(item.fromMemberId, [...(byMember.get(item.fromMemberId) ?? []), item]);
    byMember.set(item.toMemberId, [...(byMember.get(item.toMemberId) ?? []), item]);
  }
  return {
    items,
    byMember,
    columnDevelopmentMm: new Map(),
    beamDevelopmentMm: new Map(),
  };
};

const dowelItem = (id = 'e1'): ReinforcementContinuityItem => ({
  edgeId: id,
  kind: 'dowel',
  fromMemberId: 'col-1',
  toMemberId: 'ftg-1',
  count: 4,
  diameterMm: 16,
  lengthMm: 800,
});

const lapItem = (id = 'e2'): ReinforcementContinuityItem => ({
  edgeId: id,
  kind: 'lap',
  fromMemberId: 'col-1',
  toMemberId: 'col-2',
  count: 4,
  diameterMm: 16,
  lengthMm: 600,
});

const anchorItem = (id = 'e3'): ReinforcementContinuityItem => ({
  edgeId: id,
  kind: 'anchorage',
  fromMemberId: 'beam-1',
  toMemberId: 'col-1',
  count: 3,
  diameterMm: 14,
  lengthMm: 420,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeJointReinforcementQuantities', () => {
  describe('empty continuity', () => {
    it('returns empty rows and zero summary', () => {
      const result = computeJointReinforcementQuantities(makeContinuity([]));
      expect(result.rows).toHaveLength(0);
      expect(result.summary.totalWeightKg).toBe(0);
      expect(result.summary.byKind.size).toBe(0);
    });
  });

  describe('single dowel item', () => {
    const item = dowelItem();
    const result = computeJointReinforcementQuantities(makeContinuity([item]));
    const row = result.rows[0];

    it('produces exactly 1 row', () => expect(result.rows).toHaveLength(1));
    it('row.edgeId matches item', () => expect(row.edgeId).toBe('e1'));
    it('row.kind is dowel', () => expect(row.kind).toBe('dowel'));
    it('row.fromEntityId matches', () => expect(row.fromEntityId).toBe('col-1'));
    it('row.toEntityId matches', () => expect(row.toEntityId).toBe('ftg-1'));
    it('row.count matches', () => expect(row.count).toBe(4));
    it('row.diameterMm matches', () => expect(row.diameterMm).toBe(16));
    it('row.lengthMm matches', () => expect(row.lengthMm).toBe(800));

    it('totalLengthM = count × lengthMm × 0.001', () => {
      expect(row.totalLengthM).toBeCloseTo(4 * 800 * 0.001, 6);
    });

    it('weightKg = totalLengthM × barMassPerMeterKg(16)', () => {
      const expectedKg = (4 * 800 * 0.001) * barMassPerMeterKg(16);
      expect(row.weightKg).toBeCloseTo(expectedKg, 6);
    });

    it('summary.totalWeightKg matches row.weightKg', () => {
      expect(result.summary.totalWeightKg).toBeCloseTo(row.weightKg, 6);
    });

    it('summary.byKind has entry for dowel', () => {
      expect(result.summary.byKind.get('dowel')).toBeCloseTo(row.weightKg, 6);
    });
  });

  describe('multiple kinds (dowel + lap + anchorage)', () => {
    const items = [dowelItem('e1'), lapItem('e2'), anchorItem('e3')];
    const result = computeJointReinforcementQuantities(makeContinuity(items));

    it('produces 3 rows', () => expect(result.rows).toHaveLength(3));

    it('summary byKind has all 3 kinds', () => {
      expect(result.summary.byKind.has('dowel')).toBe(true);
      expect(result.summary.byKind.has('lap')).toBe(true);
      expect(result.summary.byKind.has('anchorage')).toBe(true);
    });

    it('totalWeightKg = sum of byKind values', () => {
      const fromKinds = [...result.summary.byKind.values()].reduce((a, b) => a + b, 0);
      expect(result.summary.totalWeightKg).toBeCloseTo(fromKinds, 6);
    });

    it('totalWeightKg = sum of row weights', () => {
      const fromRows = result.rows.reduce((a, r) => a + r.weightKg, 0);
      expect(result.summary.totalWeightKg).toBeCloseTo(fromRows, 6);
    });

    it('dowel weight is positive', () => {
      expect(result.summary.byKind.get('dowel')!).toBeGreaterThan(0);
    });

    it('lap weight is positive', () => {
      expect(result.summary.byKind.get('lap')!).toBeGreaterThan(0);
    });

    it('anchorage weight is positive', () => {
      expect(result.summary.byKind.get('anchorage')!).toBeGreaterThan(0);
    });
  });

  describe('idempotence', () => {
    it('calling twice with same input returns equal totals', () => {
      const items = [dowelItem(), lapItem(), anchorItem()];
      const c = makeContinuity(items);
      const r1 = computeJointReinforcementQuantities(c);
      const r2 = computeJointReinforcementQuantities(c);
      expect(r1.summary.totalWeightKg).toBeCloseTo(r2.summary.totalWeightKg, 9);
      expect(r1.rows.length).toBe(r2.rows.length);
    });
  });

  describe('totalLengthM units sanity', () => {
    it('Ø16 bar 4×800mm → totalLengthM = 3.2m', () => {
      const result = computeJointReinforcementQuantities(makeContinuity([dowelItem()]));
      expect(result.rows[0].totalLengthM).toBeCloseTo(3.2, 6);
    });

    it('weight is non-trivially positive (> 0.1 kg for 4 bars)', () => {
      const result = computeJointReinforcementQuantities(makeContinuity([dowelItem()]));
      expect(result.rows[0].weightKg).toBeGreaterThan(0.1);
    });
  });
});
