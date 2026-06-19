/**
 * ADR-499 Slice B2 — column-sizing (`suggestColumnSection`): auto-μεγέθυνση διατομής
 * ορθογώνιας κολώνας ώστε As,req≤ρ_max·A_c + λυγηρότητα. Pure (provider arg).
 */

import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import {
  suggestColumnSection,
  isColumnSectionAdequate,
  MAX_PRACTICAL_COLUMN_DIMENSION_MM,
} from '../column-sizing';
import type { ColumnParams } from '../../../types/column-types';

function makeParams(over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    sceneUnits: 'mm',
    ...over,
  } as ColumnParams;
}

describe('suggestColumnSection', () => {
  it('μη-ορθογώνια (circular) → undefined (no-op, DEFER shape-grow)', () => {
    expect(suggestColumnSection(EUROCODE_PROVIDER, makeParams({ kind: 'circular' }), 2000)).toBeUndefined();
  });

  it('τετράγωνη 400×400 χωρίς φορτίο/ροπή → ΜΙΚΡΑΙΝΕΙ στο ελάχιστο 250×250 (two-way, no waste)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams())!;
    expect(s.widthMm).toBe(250); // EC8 MIN_COLUMN_DIMENSION· καμία ζήτηση → ελάχιστο
    expect(s.depthMm).toBe(250);
    expect(s.governedBy).toBe('minimum');
  });

  it('μεγάλη FEM ροπή προβόλου → η διατομή αυτο-μεγαλώνει (governedBy reinforcement)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams(), 2000)!;
    expect(s.widthMm).toBeGreaterThan(400);
    expect(s.depthMm).toBeGreaterThan(400);
    expect(s.governedBy).toBe('reinforcement');
  });

  it('μεγαλύτερη ροπή → μεγαλύτερη (ή ίση) απαιτούμενη διατομή (μονοτονία)', () => {
    const a = suggestColumnSection(EUROCODE_PROVIDER, makeParams(), 1500)!;
    const b = suggestColumnSection(EUROCODE_PROVIDER, makeParams(), 3000)!;
    expect(b.widthMm).toBeGreaterThanOrEqual(a.widthMm);
  });

  it('λυγηρή κολώνα (ψηλή/λεπτή) → μεγαλώνει για λυγηρότητα (governedBy slenderness)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams({ width: 250, depth: 250, height: 9000 }))!;
    expect(s.widthMm).toBeGreaterThan(250); // height/30 = 300 > 250
    expect(s.governedBy).toBe('slenderness');
  });

  it('μη-τετράγωνη (700×500) → grow-only (διατηρεί aspect ratio, δεν μικραίνει· two-way DEFER)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams({ width: 700, depth: 500 }))!;
    expect(s.widthMm).toBeGreaterThanOrEqual(700);
    expect(s.depthMm).toBeGreaterThanOrEqual(500);
  });

  it('module 50mm: η διάσταση είναι πολλαπλάσιο του 50', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams(), 2000)!;
    expect(s.widthMm % 50).toBe(0);
  });

  it('φυσικά-ανέφικτη ροπή → clamp στο πρακτικό μέγιστο (→ Slice D escalation)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams(), 1e8)!;
    expect(s.widthMm).toBe(MAX_PRACTICAL_COLUMN_DIMENSION_MM);
    expect(s.governedBy).toBe('reinforcement');
  });
});

describe('suggestColumnSection — ADR-503 two-way + ν-floor (EC8)', () => {
  // appliedLoad του live μοντέλου (Firestore proj_12788b6a): dead=430.09, live=105.65 kN
  // → ULS ≈ 1.35·430.09 + 1.5·105.65 = 739 kN.
  const LIVE_LOAD = { deadAxialKn: 430.09, liveAxialKn: 105.65, source: 'takedown' as const };

  it('live 400×400 με φορτίο προβόλου → ΜΙΚΡΑΙΝΕΙ σε 300×300 (ν-governed, ΟΧΙ 250)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams({ appliedLoad: LIVE_LOAD }))!;
    // 250×250 → ν≈0.71 > 0.65 (EC8 παραβίαση)· 300×300 → ν≈0.49 ✓ → το ελάχιστο επαρκές.
    expect(s.widthMm).toBe(300);
    expect(s.depthMm).toBe(300);
  });

  it('ν-floor: μεγαλύτερο αξονικό → μεγαλύτερη ελάχιστη διατομή (monotonic)', () => {
    const light = suggestColumnSection(
      EUROCODE_PROVIDER, makeParams({ appliedLoad: { deadAxialKn: 150, liveAxialKn: 40, source: 'takedown' } }),
    )!;
    const heavy = suggestColumnSection(
      EUROCODE_PROVIDER, makeParams({ appliedLoad: { deadAxialKn: 1400, liveAxialKn: 350, source: 'takedown' } }),
    )!;
    expect(heavy.widthMm).toBeGreaterThan(light.widthMm);
  });

  it('idempotent: η προτεινόμενη διατομή είναι ήδη επαρκής (μηδέν αλλαγή σε 2ο pass → convergence)', () => {
    const first = suggestColumnSection(EUROCODE_PROVIDER, makeParams({ appliedLoad: LIVE_LOAD }))!;
    const second = suggestColumnSection(
      EUROCODE_PROVIDER, makeParams({ width: first.widthMm, depth: first.depthMm, appliedLoad: LIVE_LOAD }),
    )!;
    expect(second.widthMm).toBe(first.widthMm);
    expect(second.depthMm).toBe(first.depthMm);
  });
});

describe('isColumnSectionAdequate — ADR-503 Slice 2 (safety-gated lock)', () => {
  const LIVE_LOAD = { deadAxialKn: 430.09, liveAxialKn: 105.65, source: 'takedown' as const };

  it('χειροκίνητη 200×200 (κάτω από EC8 MIN 250) → ΑΝΕΠΑΡΚΗΣ, min=ελάχιστο επαρκές', () => {
    const r = isColumnSectionAdequate(EUROCODE_PROVIDER, makeParams({ width: 200, depth: 200, appliedLoad: LIVE_LOAD }));
    expect(r.adequate).toBe(false);
    expect(r.minWidthMm).toBe(300);
    expect(r.minDepthMm).toBe(300);
  });

  it('χειροκίνητη 250×250 με φορτίο → ΑΝΕΠΑΡΚΗΣ (ν≈0.71 > 0.65, EC8)', () => {
    const r = isColumnSectionAdequate(EUROCODE_PROVIDER, makeParams({ width: 250, depth: 250, appliedLoad: LIVE_LOAD }));
    expect(r.adequate).toBe(false);
    expect(r.minWidthMm).toBe(300);
  });

  it('χειροκίνητη 300×300 (το ελάχιστο επαρκές) → ΕΠΑΡΚΗΣ (ν≈0.49 ✓)', () => {
    const r = isColumnSectionAdequate(EUROCODE_PROVIDER, makeParams({ width: 300, depth: 300, appliedLoad: LIVE_LOAD }));
    expect(r.adequate).toBe(true);
  });

  it('χειροκίνητη 500×500 (υπερδιαστασιολογημένη) → ΕΠΑΡΚΗΣ (lock OK· min=300 για διάγνωση)', () => {
    const r = isColumnSectionAdequate(EUROCODE_PROVIDER, makeParams({ width: 500, depth: 500, appliedLoad: LIVE_LOAD }));
    expect(r.adequate).toBe(true);
    expect(r.minWidthMm).toBe(300);
  });

  it('μη-ορθογώνια (circular) → adequate:true (no-op· shape-grow DEFER)', () => {
    const r = isColumnSectionAdequate(EUROCODE_PROVIDER, makeParams({ kind: 'circular', width: 200, depth: 200 }));
    expect(r.adequate).toBe(true);
  });
});
