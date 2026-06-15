/**
 * ADR-460 follow-up 6 — επικαλυπτόμενοι ορθογώνιοι συνδετήρες ανά σκέλος (Γ/Τ/Π/Ι):
 * decomposition σε ορθογώνια + multihoop layout + dispatcher routing.
 */

import { decomposeColumnSectionRects } from '../column-rect-decomposition';
import { buildMultiHoopLayout } from '../column-multihoop-layout';
import { distributeRectBarsBySpacing } from '../column-rebar-layout';
import { resolveColumnRebarLayout, resolveColumnCrossTies } from '../column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from '../column-section-outline';
import { MAX_RESTRAINED_BAR_SPACING_MM } from '../column-reinforcement-types';
import type { ColumnReinforcement } from '../column-reinforcement-types';
import type { ColumnParams } from '../../../types/column-types';

const reinf: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 12 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
  coverMm: 30,
};

function baseParams(over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width: 600, depth: 600, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...over,
  };
}

const outlineOf = (over: Partial<ColumnParams>): ReturnType<typeof resolveColumnReinforcementSection>['outlineMm'] =>
  resolveColumnReinforcementSection(baseParams(over)).outlineMm;

describe('decomposeColumnSectionRects', () => {
  it('Τ-shape → 2 επικαλυπτόμενα σκέλη (κορμός πλήρους βάθους + πέλμα)', () => {
    const rects = decomposeColumnSectionRects(outlineOf({ kind: 'T-shape' }));
    expect(rects.length).toBe(2);
    // Κορμός = κατακόρυφο σκέλος πλήρους βάθους (διαπερνά το πέλμα → επικάλυψη).
    const web = rects.find((r) => r.depth > r.width)!;
    const flange = rects.find((r) => r.width > r.depth)!;
    expect(web).toBeDefined();
    expect(flange).toBeDefined();
    expect(web.depth).toBeCloseTo(600, 0);
    expect(flange.width).toBeCloseTo(600, 0);
    // Επικάλυψη: το πέλμα (ψηλά) και ο κορμός μοιράζονται ζώνη y.
    const webTop = web.cy + web.depth / 2;
    const flangeBottom = flange.cy - flange.depth / 2;
    expect(webTop).toBeGreaterThan(flangeBottom);
  });

  it('Γ-shape → 2 σκέλη', () => {
    expect(decomposeColumnSectionRects(outlineOf({ kind: 'L-shape' })).length).toBe(2);
  });

  it('Ι-shape → κορμός που επικαλύπτει 2 πέλματα (≥3 σκέλη)', () => {
    const rects = decomposeColumnSectionRects(outlineOf({ kind: 'I-shape' }));
    expect(rects.length).toBeGreaterThanOrEqual(3);
    const web = rects.find((r) => r.depth > r.width);
    expect(web).toBeDefined();
    expect(web!.depth).toBeCloseTo(600, 0); // διαπερνά καθ' ύψος
  });

  it('Π (U-shape) → βάση + 2 πόδια (3 σκέλη)', () => {
    expect(decomposeColumnSectionRects(outlineOf({ kind: 'U-shape' })).length).toBe(3);
  });

  it('μη-rectilinear (circular/polygon) → [] (fallback σε perimeter)', () => {
    expect(decomposeColumnSectionRects(outlineOf({ kind: 'circular', width: 500 }))).toEqual([]);
    expect(decomposeColumnSectionRects(outlineOf({ kind: 'polygon', width: 500 }))).toEqual([]);
  });

  it('rectilinear cover: τα σκέλη καλύπτουν όλο το bbox (κανένα κενό)', () => {
    const rects = decomposeColumnSectionRects(outlineOf({ kind: 'T-shape' }));
    const minX = Math.min(...rects.map((r) => r.cx - r.width / 2));
    const maxX = Math.max(...rects.map((r) => r.cx + r.width / 2));
    expect(minX).toBeCloseTo(-300, 0);
    expect(maxX).toBeCloseTo(300, 0);
  });
});

describe('buildMultiHoopLayout — Τ-shape', () => {
  const rects = decomposeColumnSectionRects(outlineOf({ kind: 'T-shape' }));
  const layout = buildMultiHoopLayout(reinf, rects)!;

  it('παράγει κύριο στεφάνι + 1 επιπλέον (2 σκέλη → 2 κλειστά στεφάνια)', () => {
    expect(layout).not.toBeNull();
    expect(layout.stirrupPathMm.length).toBeGreaterThan(6);
    expect(layout.extraStirrupPathsMm?.length).toBe(1);
    expect(layout.stirrupCenterlineLengthMm).toBeGreaterThan(0);
  });

  it('κάθε άκρο cross-tie = ΠΡΑΓΜΑΤΙΚΗ διαμήκης ράβδος (ποτέ γάντζος στο κενό)', () => {
    const isBar = (p: { x: number; y: number }): boolean =>
      layout.longitudinalBarsMm.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 1e-6);
    for (const { a, b } of layout.crossTieAnchorsMm ?? []) {
      expect(isBar(a)).toBe(true);
      expect(isBar(b)).toBe(true);
    }
  });

  it('οι ράβδοι των σκελών είναι ενωμένες (≥ 8) χωρίς duplicate στη συμβολή', () => {
    expect(layout.longitudinalBarsMm.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < layout.longitudinalBarsMm.length; i++) {
      for (let j = i + 1; j < layout.longitudinalBarsMm.length; j++) {
        const a = layout.longitudinalBarsMm[i];
        const b = layout.longitudinalBarsMm[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1e-6);
      }
    }
  });
});

describe('distributeRectBarsBySpacing (code-driven count, Revit/Tekla)', () => {
  it('βήμα ≤ sMax σε κάθε παρειά (ψηλή παρειά → ενδιάμεσες ράβδοι)', () => {
    // Σκέλος 80×420 (μισά 40×210) με sMax=200 → η 420 παρειά θέλει ≥2 διαστήματα.
    const bars = distributeRectBarsBySpacing(40, 210, 200, 4);
    expect(bars.length).toBeGreaterThan(4); // όχι μόνο γωνίες
    // Μέγιστο κενό μεταξύ διαδοχικών ράβδων στην ίδια κατακόρυφη παρειά (x≈+40).
    const right = bars.filter((b) => Math.abs(b.x - 40) < 1e-6).map((b) => b.y).sort((a, b) => a - b);
    for (let i = 1; i < right.length; i++) expect(right[i] - right[i - 1]).toBeLessThanOrEqual(200 + 1e-6);
  });

  it('τιμώνται και τα δύο: όριο βήματος ΚΑΙ floor (minTotal)', () => {
    // Μικρό σκέλος που το spacing θα έδινε 4· floor=10 → ≥10 ράβδοι.
    const bars = distributeRectBarsBySpacing(50, 50, 200, 10);
    expect(bars.length).toBeGreaterThanOrEqual(10);
  });
});

describe('multihoop spacing-derived — ψηλός κορμός Τ παίρνει ενδιάμεσες', () => {
  it('count=6 αλλά κορμός 999×502 πυκνώνει ώστε βήμα ≤ όριο κανονισμού', () => {
    const reinf6: ColumnReinforcement = { ...reinf, longitudinal: { diameterMm: 16, count: 6 } };
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'T-shape', width: 999, depth: 502 }));
    const layout = resolveColumnRebarLayout(reinf6, section, MAX_RESTRAINED_BAR_SPACING_MM)!;
    // Spacing-derived → πολύ περισσότερες από 6 ράβδοι + cross-ties στις ενδιάμεσες.
    expect(layout.longitudinalBarsMm.length).toBeGreaterThan(6);
    expect(layout.crossTieAnchorsMm && layout.crossTieAnchorsMm.length).toBeGreaterThan(0);
  });
});

describe('dispatcher routing — Γ/Τ/Π/Ι → multihoop, μη-rectilinear → perimeter', () => {
  it('Τ-shape μέσω dispatcher → πολλαπλά στεφάνια', () => {
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'T-shape' }));
    const layout = resolveColumnRebarLayout(reinf, section)!;
    expect(layout.extraStirrupPathsMm && layout.extraStirrupPathsMm.length).toBeGreaterThanOrEqual(1);
    const ties = resolveColumnCrossTies(layout, section, reinf);
    expect(ties.length).toBe(layout.crossTieAnchorsMm?.length ?? 0);
  });

  it('polygon (N-gon) μέσω dispatcher → fallback perimeter (ΕΝΑ στεφάνι, χωρίς extra)', () => {
    const section = resolveColumnReinforcementSection(baseParams({ kind: 'polygon', width: 500 }));
    const layout = resolveColumnRebarLayout(reinf, section)!;
    expect(layout.extraStirrupPathsMm).toBeUndefined();
  });
});
