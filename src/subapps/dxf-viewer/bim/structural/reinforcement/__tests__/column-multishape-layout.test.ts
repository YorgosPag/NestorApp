/**
 * ADR-460 Slice 2 — generalized rebar layout (perimeter / circular / wall) + dispatcher.
 */

import { computeColumnRebarLayout } from '../column-rebar-layout';
import { buildPerimeterLayoutFromOutline, insetOutlineMm } from '../column-perimeter-layout';
import { buildCircularLayout } from '../column-circular-layout';
import { buildWallLayout } from '../column-wall-reinforcement';
import {
  resolveColumnRebarLayout,
  resolveColumnRebarLayoutForParams,
  resolveColumnCrossTies,
} from '../column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from '../column-section-outline';
import type { ColumnReinforcement } from '../column-reinforcement-types';
import type { ColumnParams } from '../../../types/column-types';

const reinf: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 8 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
  coverMm: 30,
};

function baseParams(over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width: 400, depth: 400, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...over,
  };
}

describe('insetOutlineMm', () => {
  it('insets a square inward (area shrinks)', () => {
    const sq = [{ x: -200, y: -200 }, { x: 200, y: -200 }, { x: 200, y: 200 }, { x: -200, y: 200 }];
    const inner = insetOutlineMm(sq, 30);
    expect(inner).not.toBeNull();
    // inset 30 → ~340×340 → max |x| ≈ 170
    expect(Math.max(...inner!.map((p) => Math.abs(p.x)))).toBeCloseTo(170, 0);
  });
});

describe('buildPerimeterLayoutFromOutline — L-shape', () => {
  const section = resolveColumnReinforcementSection(baseParams({ kind: 'L-shape', width: 600, depth: 600 }));
  const layout = buildPerimeterLayoutFromOutline(reinf, section.outlineMm);

  it('produces a layout with bars and a closed stirrup path', () => {
    expect(layout).not.toBeNull();
    expect(layout!.longitudinalBarsMm.length).toBe(8);
    expect(layout!.stirrupPathMm.length).toBeGreaterThan(6);
    expect(layout!.stirrupCenterlineLengthMm).toBeGreaterThan(0);
  });
});

describe('buildCircularLayout', () => {
  const layout = buildCircularLayout(reinf, 500);

  it('places bars on a circle and uses an exact ring perimeter', () => {
    expect(layout).not.toBeNull();
    expect(layout!.longitudinalBarsMm.length).toBe(8);
    const ringRadius = 250 - 30 - 4; // r - cover - dbw/2
    expect(layout!.stirrupCenterlineLengthMm).toBeCloseTo(2 * Math.PI * ringRadius, 3);
    // all bars equidistant from centre
    const barRadius = 250 - 30 - 8 - 8;
    for (const b of layout!.longitudinalBarsMm) {
      expect(Math.hypot(b.x, b.y)).toBeCloseTo(barRadius, 3);
    }
  });
});

describe('buildWallLayout — shear-wall', () => {
  const section = resolveColumnReinforcementSection(baseParams({ kind: 'shear-wall', width: 2000, depth: 250 }));
  const layout = buildWallLayout(reinf, section);

  it('produces boundary hoops + web bars', () => {
    expect(layout).not.toBeNull();
    expect(layout!.extraStirrupPathsMm?.length).toBe(2); // δύο κρυφοκολώνες
    expect(layout!.longitudinalBarsMm.length).toBeGreaterThan(8); // boundary + web
    expect(layout!.stirrupCenterlineLengthMm).toBeGreaterThan(0);
  });
});

describe('dispatcher — zero regression for rectangular', () => {
  it('rectangular routes through rect fast-path (identical to computeColumnRebarLayout)', () => {
    const params = baseParams({ width: 400, depth: 600 });
    const viaDispatch = resolveColumnRebarLayoutForParams(reinf, params);
    const direct = computeColumnRebarLayout(reinf, 400, 600);
    expect(viaDispatch).toEqual(direct);
  });

  it('routes circular / wall by mode', () => {
    const circ = resolveColumnRebarLayout(reinf, resolveColumnReinforcementSection(baseParams({ kind: 'circular', width: 500 })));
    expect(circ!.stirrupCornerRadiusMm).toBe(0); // circular sentinel
    const wall = resolveColumnRebarLayout(reinf, resolveColumnReinforcementSection(baseParams({ kind: 'shear-wall', width: 2000, depth: 250 })));
    expect(wall!.extraStirrupPathsMm?.length).toBe(2);
  });
});

describe('resolveColumnCrossTies — per mode', () => {
  it('wall → S-ties from web anchors', () => {
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'shear-wall', width: 2000, depth: 250 }));
    const layout = resolveColumnRebarLayout(reinf, section)!;
    const ties = resolveColumnCrossTies(layout, section, reinf);
    expect(ties.length).toBe(layout.crossTieAnchorsMm!.length);
    expect(ties.length).toBeGreaterThan(0);
  });

  it('circular → no cross-ties', () => {
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'circular', width: 500 }));
    const layout = resolveColumnRebarLayout(reinf, section)!;
    expect(resolveColumnCrossTies(layout, section, reinf)).toEqual([]);
  });

  it('rectangular → diamond/grid (8 bars = 1 diamond)', () => {
    const section = resolveColumnReinforcementSection(baseParams({ width: 400, depth: 400 }));
    const layout = resolveColumnRebarLayout(reinf, section)!;
    expect(resolveColumnCrossTies(layout, section, reinf).length).toBeGreaterThan(0);
  });

  it('rectangular layout does NOT carry crossTieAnchorsMm (rect fast-path, zero regression)', () => {
    const section = resolveColumnReinforcementSection(baseParams({ width: 400, depth: 600 }));
    const layout = resolveColumnRebarLayout(reinf, section)!;
    expect(layout.crossTieAnchorsMm).toBeUndefined();
  });

  it('perimeter Γ (L-shape) με ενδιάμεσες → grid cross-ties (anchors → S-ties)', () => {
    // count 12 σε L (6 κορυφές) → 6 ενδιάμεσες ράβδοι που θέλουν cross-tie.
    const reinf12: ColumnReinforcement = { ...reinf, longitudinal: { diameterMm: 16, count: 12 } };
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'L-shape', width: 600, depth: 600 }));
    const layout = resolveColumnRebarLayout(reinf12, section)!;
    expect(layout.crossTieAnchorsMm && layout.crossTieAnchorsMm.length).toBeGreaterThan(0);
    const ties = resolveColumnCrossTies(layout, section, reinf12);
    expect(ties.length).toBe(layout.crossTieAnchorsMm!.length);
  });

  it('reentrant (κοίλη) γωνία Γ → παίρνει cross-tie (EC8 κρίσιμη συγκράτηση)', () => {
    // L outline (CCW) με κοίλη γωνία στο (250,250).
    const lOutline = [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 250 },
      { x: 250, y: 250 }, { x: 250, y: 600 }, { x: 0, y: 600 },
    ];
    const reinf16: ColumnReinforcement = { ...reinf, longitudinal: { diameterMm: 16, count: 16 } };
    const layout = buildPerimeterLayoutFromOutline(reinf16, lOutline)!;
    expect(layout.crossTieAnchorsMm && layout.crossTieAnchorsMm.length).toBeGreaterThan(0);
    const nearReentrant = layout.crossTieAnchorsMm!.some(
      ({ a }) => Math.hypot(a.x - 250, a.y - 250) < 100,
    );
    expect(nearReentrant).toBe(true);
  });

  it('κάθε άκρο cross-tie = ΠΡΑΓΜΑΤΙΚΗ διαμήκης ράβδος (ποτέ γάντζος στο κενό)', () => {
    const reinf12: ColumnReinforcement = { ...reinf, longitudinal: { diameterMm: 16, count: 12 } };
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'L-shape', width: 600, depth: 600 }));
    const layout = resolveColumnRebarLayout(reinf12, section)!;
    const isBar = (p: { x: number; y: number }): boolean =>
      layout.longitudinalBarsMm.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 1e-6);
    for (const { a, b } of layout.crossTieAnchorsMm!) {
      expect(isBar(a)).toBe(true);
      expect(isBar(b)).toBe(true);
    }
  });

  it('perimeter cross-ties διασχίζουν το ΠΑΧΟΣ, όχι κατά μήκος (μηδέν ζιγκ-ζαγκ)', () => {
    // Regression guard: κάθε tie πρέπει να είναι κάθετο (κοντό), όχι διαγώνιο κατά μήκος.
    const reinf12: ColumnReinforcement = { ...reinf, longitudinal: { diameterMm: 16, count: 12 } };
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'L-shape', width: 600, depth: 600 }));
    const layout = resolveColumnRebarLayout(reinf12, section)!;
    const maxSpan = section.maxDimensionMm * 0.8; // διασχίζει πάχος (≤45°) << μέγιστη διάσταση
    for (const { a, b } of layout.crossTieAnchorsMm!) {
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(maxSpan);
    }
  });

  it('perimeter Γ χωρίς ενδιάμεσες (count = κορυφές) → καθόλου cross-ties', () => {
    const reinf6: ColumnReinforcement = { ...reinf, longitudinal: { diameterMm: 16, count: 6 } };
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'L-shape', width: 600, depth: 600 }));
    const layout = resolveColumnRebarLayout(reinf6, section)!;
    expect(layout.crossTieAnchorsMm).toBeUndefined();
    expect(resolveColumnCrossTies(layout, section, reinf6)).toEqual([]);
  });
});
