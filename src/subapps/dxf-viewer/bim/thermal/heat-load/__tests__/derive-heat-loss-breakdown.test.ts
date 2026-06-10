/**
 * ADR-422 L1.8 — tests για τον read-model ανάλυσης απωλειών (derive-heat-loss-breakdown).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Επιβεβαιώνει: group-by-kind fabric (αθροιστικά ίδιου kind)· επιφανειοποίηση του split
 * (infiltration/designed)· **Σ invariant** (Σ fabric + ventilationW(max) + reheat === totalW)·
 * building totals (άθροισμα γραμμών)· κενό/μονό χώρο· ταξινόμηση spaceId.
 */

import { deriveHeatLossBreakdown } from '../derive-heat-loss-breakdown';
import type {
  BoundaryHeatLoss,
  SpaceHeatLoadResult,
  HeatLoadBoundaryKind,
} from '../heat-load-types';

function boundary(kind: HeatLoadBoundaryKind, lossW: number): BoundaryHeatLoss {
  return { kind, condition: 'external-air', uValue: 0.4, area: 10, factor: 1, lossW, thermalBridgeW: 0 };
}

function result(over: Partial<SpaceHeatLoadResult> & { spaceId: string }): SpaceHeatLoadResult {
  return {
    deltaTC: 25,
    transmissionW: 0,
    ventilationW: 0,
    infiltrationW: 0,
    designedVentilationW: 0,
    thermalBridgeW: 0,
    reheatW: 0,
    totalW: 0,
    specificLoadWperM2: 0,
    boundaries: [],
    ...over,
  };
}

/** Χώρος: τοίχος 200+100 (2 boundaries) + κούφωμα 150 + δάπεδο 125 + στέγη 200 + οροφή 50. */
function richSpace(spaceId: string): SpaceHeatLoadResult {
  const boundaries: BoundaryHeatLoss[] = [
    boundary('wall', 200),
    boundary('wall', 100),
    boundary('window', 150),
    boundary('floor', 125),
    boundary('roof', 200),
    boundary('ceiling', 50),
  ];
  const transmissionW = 825; // 300 + 150 + 125 + 200 + 50
  return result({
    spaceId,
    transmissionW,
    boundaries,
    infiltrationW: 100,
    designedVentilationW: 382.5,
    ventilationW: 382.5, // max(100, 382.5)
    reheatW: 0,
    totalW: transmissionW + 382.5, // 1207.5
  });
}

function resultsOf(...rs: SpaceHeatLoadResult[]): Map<string, SpaceHeatLoadResult> {
  return new Map(rs.map((r) => [r.spaceId, r]));
}

describe('deriveHeatLossBreakdown — fabric group-by-kind', () => {
  it('αθροίζει boundaries ίδιου kind (2 τοίχοι → 300)', () => {
    const { rows } = deriveHeatLossBreakdown(resultsOf(richSpace('sp-1')));
    expect(rows).toHaveLength(1);
    const f = rows[0].fabricByKind;
    expect(f.wall).toBe(300);
    expect(f.window).toBe(150);
    expect(f.floor).toBe(125);
    expect(f.roof).toBe(200);
    expect(f.ceiling).toBe(50);
    expect(f.door).toBeUndefined(); // απών kind δεν εμφανίζεται
  });

  it('fabricTotalW === Σ fabricByKind === transmissionW', () => {
    const { rows } = deriveHeatLossBreakdown(resultsOf(richSpace('sp-1')));
    const sum = Object.values(rows[0].fabricByKind).reduce((s, w) => s + w, 0);
    expect(rows[0].fabricTotalW).toBe(825);
    expect(sum).toBe(825);
  });
});

describe('deriveHeatLossBreakdown — split επιφανειοποίηση + Σ invariant', () => {
  it('περνά τα 2 σκέλη (infiltration/designed) + ventilationW=max', () => {
    const { rows } = deriveHeatLossBreakdown(resultsOf(richSpace('sp-1')));
    expect(rows[0].infiltrationW).toBe(100);
    expect(rows[0].designedVentilationW).toBe(382.5);
    expect(rows[0].ventilationW).toBe(382.5);
  });

  it('Σ fabric + ventilationW (max) + reheatW === totalW', () => {
    const { rows } = deriveHeatLossBreakdown(resultsOf(richSpace('sp-1')));
    const r = rows[0];
    expect(r.fabricTotalW + r.ventilationW + r.reheatW).toBeCloseTo(r.totalW, 5);
  });

  it('διείσδυση-κυρίαρχος χώρος (very-leaky): ventilationW = infiltrationW (max)', () => {
    // infiltration 306 > designed 255 → ventilationW = 306.
    const leaky = result({
      spaceId: 'sp-leaky',
      transmissionW: 325,
      boundaries: [boundary('floor', 125), boundary('roof', 200)],
      infiltrationW: 306,
      designedVentilationW: 255,
      ventilationW: 306,
      totalW: 325 + 306,
    });
    const { rows } = deriveHeatLossBreakdown(resultsOf(leaky));
    expect(rows[0].ventilationW).toBe(306);
    expect(rows[0].fabricTotalW + rows[0].ventilationW + rows[0].reheatW).toBeCloseTo(631, 5);
  });
});

describe('deriveHeatLossBreakdown — building totals + aggregation', () => {
  it('totals = άθροισμα γραμμών ανά σκέλος', () => {
    const { totals } = deriveHeatLossBreakdown(resultsOf(richSpace('sp-1'), richSpace('sp-2')));
    expect(totals.fabricByKind.wall).toBe(600); // 300 × 2
    expect(totals.fabricByKind.roof).toBe(400);
    expect(totals.fabricTotalW).toBe(1650);
    expect(totals.infiltrationW).toBe(200);
    expect(totals.designedVentilationW).toBe(765);
    expect(totals.ventilationW).toBe(765);
    expect(totals.totalW).toBeCloseTo(2415, 5);
  });

  it('ταξινομεί τις γραμμές κατά spaceId', () => {
    const { rows } = deriveHeatLossBreakdown(resultsOf(richSpace('sp-2'), richSpace('sp-1')));
    expect(rows.map((r) => r.spaceId)).toEqual(['sp-1', 'sp-2']);
  });

  it('κενό map → κενές γραμμές + μηδενικά totals', () => {
    const { rows, totals } = deriveHeatLossBreakdown(new Map());
    expect(rows).toHaveLength(0);
    expect(totals.fabricTotalW).toBe(0);
    expect(totals.totalW).toBe(0);
    expect(totals.ventilationW).toBe(0);
    expect(Object.keys(totals.fabricByKind)).toHaveLength(0);
  });

  it('χώρος χωρίς boundaries → fabricByKind κενό, fabricTotalW 0', () => {
    const bare = result({ spaceId: 'sp-1', ventilationW: 100, designedVentilationW: 100, totalW: 100 });
    const { rows } = deriveHeatLossBreakdown(resultsOf(bare));
    expect(Object.keys(rows[0].fabricByKind)).toHaveLength(0);
    expect(rows[0].fabricTotalW).toBe(0);
    expect(rows[0].totalW).toBe(100);
  });
});
