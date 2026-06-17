/**
 * ADR-464 Slice 4 — entity-aware footing tributary takedown.
 *
 * Καλύπτει: per-footing φορτίο μέσω στηρίζουσας κολώνας (FK), self-weight, ο κανόνας
 * manual-not-overwritten, πέδιλο χωρίς κολώνα (skip), και αδρανές χωρίς area loads.
 */

import { computeFootingTakedownLoads } from '../footing-load-takedown';
import type { Entity } from '../../../../types/entities';
import type { AppliedMemberLoad } from '../../loads/structural-loads-types';
import { DEFAULT_BAY_SPAN_M } from '../../loads/load-takedown';

/** Rectangular κολώνα 600×600×3000 mm με footprint (canvas=mm) + προαιρετικό FK. */
function column(id: string, cx: number, cy: number, footingId?: string): Entity {
  const h = 300;
  return {
    id,
    type: 'column',
    kind: 'rectangular',
    params: {
      kind: 'rectangular', position: { x: cx, y: cy, z: 0 }, anchor: 'center',
      width: 600, depth: 600, height: 3000, rotation: 0, sceneUnits: 'mm',
      ...(footingId ? { footingId } : {}),
    },
    geometry: {
      area: 0.36,
      footprint: { vertices: [
        { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h },
        { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
      ] },
    },
  } as unknown as Entity;
}

/** Pad πέδιλο με προαιρετικό appliedLoad. */
function pad(id: string, appliedLoad?: AppliedMemberLoad): Entity {
  return {
    id, type: 'foundation', kind: 'pad',
    params: { kind: 'pad', width: 1500, length: 1500, thicknessMm: 500, ...(appliedLoad ? { appliedLoad } : {}) },
  } as unknown as Entity;
}

const SETTINGS = { storeyCount: 4, deadAreaLoadKpa: 6, liveAreaLoadKpa: 2 };
const COLUMN_SELF_WEIGHT_4 = 0.6 * 0.6 * 3 * 2400 * 9.81 / 1000 * 4; // ≈ 101.7 kN

describe('computeFootingTakedownLoads', () => {
  it('μεμονωμένη κολώνα+πέδιλο → tributary DEFAULT_BAY² × όροφοι × loads + self-weight', () => {
    const entities = [column('c1', 0, 0, 'f1'), pad('f1')];
    const loads = computeFootingTakedownLoads(entities, SETTINGS);
    expect(loads).toHaveLength(1);
    const a = loads[0].appliedLoad;
    expect(loads[0].footingId).toBe('f1');
    expect(a.source).toBe('takedown');
    const tribArea = DEFAULT_BAY_SPAN_M * DEFAULT_BAY_SPAN_M; // 25 m²
    expect(a.liveAxialKn).toBeCloseTo(tribArea * 4 * 2, 1); // 200
    expect(a.deadAxialKn).toBeCloseTo(tribArea * 4 * 6 + COLUMN_SELF_WEIGHT_4, 1); // 600 + self
  });

  it('χειροκίνητο φορτίο → ΔΕΝ αντικαθίσταται (skip)', () => {
    const manual: AppliedMemberLoad = { deadAxialKn: 900, liveAxialKn: 0, source: 'manual' };
    const entities = [column('c1', 0, 0, 'f1'), pad('f1', manual)];
    expect(computeFootingTakedownLoads(entities, SETTINGS)).toHaveLength(0);
  });

  it('takedown-derived φορτίο → ξανα-υπολογίζεται (idempotent refresh)', () => {
    const prior: AppliedMemberLoad = { deadAxialKn: 1, liveAxialKn: 1, source: 'takedown' };
    const entities = [column('c1', 0, 0, 'f1'), pad('f1', prior)];
    expect(computeFootingTakedownLoads(entities, SETTINGS)).toHaveLength(1);
  });

  it('πέδιλο χωρίς στηρίζουσα κολώνα → skip (καμία πηγή φορτίου)', () => {
    const entities = [column('c1', 0, 0), pad('f1')]; // η κολώνα δεν δείχνει στο f1
    expect(computeFootingTakedownLoads(entities, SETTINGS)).toHaveLength(0);
  });

  it('χωρίς area loads → κενό (αδρανές)', () => {
    const entities = [column('c1', 0, 0, 'f1'), pad('f1')];
    expect(computeFootingTakedownLoads(entities, { storeyCount: 4, deadAreaLoadKpa: 0, liveAreaLoadKpa: 0 })).toHaveLength(0);
  });
});
