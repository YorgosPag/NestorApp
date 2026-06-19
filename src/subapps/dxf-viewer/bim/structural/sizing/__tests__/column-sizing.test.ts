/**
 * ADR-499 Slice B2 — column-sizing (`suggestColumnSection`): auto-μεγέθυνση διατομής
 * ορθογώνιας κολώνας ώστε As,req≤ρ_max·A_c + λυγηρότητα. Pure (provider arg).
 */

import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import {
  suggestColumnSection,
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

  it('400×400 χωρίς φορτίο/ροπή → δεν μεγαλώνει (governedBy minimum)', () => {
    const s = suggestColumnSection(EUROCODE_PROVIDER, makeParams())!;
    expect(s.widthMm).toBe(400);
    expect(s.depthMm).toBe(400);
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

  it('διατήρηση διαστάσεων upward-only (δεν μικραίνει ποτέ)', () => {
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
