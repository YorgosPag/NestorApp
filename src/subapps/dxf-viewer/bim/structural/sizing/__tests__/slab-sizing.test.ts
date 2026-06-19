/**
 * ADR-499 Slice B — slab-sizing (auto-size πάχους πλάκας-προβόλου).
 *
 * Το πάχος αυτο-μεγαλώνει ώστε `M_Ed ≤ M_Rd,lim` (φυσική πύλη) ΚΑΙ `L/d ≤ όριο` (βέλος).
 * Μόνο αναρτημένη πλάκα-πρόβολος· raft/simple = undefined (no-op, μηδέν regression).
 */

import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { suggestSlabThickness } from '../slab-sizing';
import type { SlabFoundationSectionContext } from '../../codes/structural-code-types';

function cantileverCtx(over: Partial<SlabFoundationSectionContext> = {}): SlabFoundationSectionContext {
  return {
    widthMm: 4000, lengthMm: 3000, thicknessMm: 200, grossAreaMm2: 12e6,
    kind: 'suspended', concreteGrade: 'C25/30',
    supportType: 'cantilever', cantileverSpanMm: 3000, designLoadKpa: 27,
    ...over,
  };
}

describe('suggestSlabThickness — ADR-499', () => {
  it('πρόβολος 3m: αυτο-μεγαλώνει το πάχος πολύ πάνω από 200mm (βέλος κυριαρχεί)', () => {
    const s = suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx());
    expect(s).toBeDefined();
    expect(s!.thicknessMm).toBeGreaterThan(300);
    expect(s!.governedBy).toBe('serviceability'); // L/d=8 → d=375 > capacity
  });

  it('μικρό άνοιγμα + τεράστιο φορτίο → η ΦΥΣΙΚΗ ΠΥΛΗ (capacity) κυριαρχεί', () => {
    const s = suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ cantileverSpanMm: 1000, designLoadKpa: 200 }));
    expect(s).toBeDefined();
    expect(s!.governedBy).toBe('capacity');
  });

  it('μονότονο: μεγαλύτερος πρόβολος → παχύτερη πλάκα', () => {
    const small = suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ cantileverSpanMm: 2000 }));
    const big = suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ cantileverSpanMm: 5000 }));
    expect(big!.thicknessMm).toBeGreaterThan(small!.thicknessMm);
  });

  it('αμφιέρειστη (μη-πρόβολος) → undefined (DEFER· ο cap Slice A προστατεύει)', () => {
    expect(suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ supportType: 'simple' }))).toBeUndefined();
  });

  it('εδαφόπλακα (kind foundation) → undefined (bearing-driven, όχι εδώ)', () => {
    expect(suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ kind: 'foundation' }))).toBeUndefined();
  });

  it('μηδενικό άνοιγμα → undefined', () => {
    expect(suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ cantileverSpanMm: 0 }))).toBeUndefined();
  });

  it('clamp στο πρακτικό μέγιστο (1200mm) σε ακραίο πρόβολο', () => {
    const s = suggestSlabThickness(EUROCODE_PROVIDER, cantileverCtx({ cantileverSpanMm: 20000 }));
    expect(s!.thicknessMm).toBeLessThanOrEqual(1200);
  });
});
