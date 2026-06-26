/**
 * ADR-499 Slice B — slab-sizing (auto-size πάχους πλάκας-προβόλου).
 *
 * Το πάχος αυτο-μεγαλώνει ώστε `M_Ed ≤ M_Rd,lim` (φυσική πύλη) ΚΑΙ `L/d ≤ όριο` (βέλος).
 * Μόνο αναρτημένη πλάκα-πρόβολος· raft/simple = undefined (no-op, μηδέν regression).
 */

import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { suggestSlabThickness, suggestSupportedSlabThickness } from '../slab-sizing';
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

// ─── ADR-534 Φ2 — supported (αμφιέρειστη/συνεχής) πλάκα οροφής ──────────────────
function supportedCtx(over: Partial<SlabFoundationSectionContext> = {}): SlabFoundationSectionContext {
  return {
    widthMm: 4000, lengthMm: 4000, thicknessMm: 0, grossAreaMm2: 16e6,
    kind: 'suspended', maxFreeSpanMm: 4000, supportType: 'simple',
    ...over,
  };
}

describe('suggestSupportedSlabThickness — ADR-534 Φ2', () => {
  it('αμφιέρειστη 4m χωρίς φορτίο → 230mm (serviceability l/d=20)', () => {
    const s = suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx());
    expect(s).toBeDefined();
    expect(s!.thicknessMm).toBe(230); // 4000/20 + 25 cover = 225 → module 10 → 230
    expect(s!.governedBy).toBe('serviceability');
  });

  it('συνεχής (continuous, K=1.5) → λεπτότερη από αμφιέρειστη (l/d=30)', () => {
    const simple = suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx({ supportType: 'simple' }));
    const cont = suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx({ supportType: 'continuous' }));
    expect(cont!.thicknessMm).toBeLessThan(simple!.thicknessMm);
  });

  it('μονότονο: μεγαλύτερο άνοιγμα → παχύτερη πλάκα', () => {
    const small = suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx({ maxFreeSpanMm: 3000 }));
    const big = suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx({ maxFreeSpanMm: 7000 }));
    expect(big!.thicknessMm).toBeGreaterThan(small!.thicknessMm);
  });

  it('πρόβολος → undefined (περνά από το suggestSlabThickness)', () => {
    const s = suggestSupportedSlabThickness(
      EUROCODE_PROVIDER, supportedCtx({ supportType: 'cantilever', cantileverSpanMm: 3000 }),
    );
    expect(s).toBeUndefined();
  });

  it('μηδέν άνοιγμα / εδαφόπλακα → undefined', () => {
    expect(suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx({ maxFreeSpanMm: 0 }))).toBeUndefined();
    expect(suggestSupportedSlabThickness(EUROCODE_PROVIDER, supportedCtx({ kind: 'foundation' }))).toBeUndefined();
  });

  it('REGRESSION: suggestSlabThickness(simple ΜΕ maxFreeSpan) ΑΚΟΜΗ undefined — proactive auto-sizer άθικτος', () => {
    // Ο πραγματικός ctx των floor slabs έχει maxFreeSpanMm > 0· ο proactive sizer ΔΕΝ τις πειράζει.
    expect(suggestSlabThickness(EUROCODE_PROVIDER, supportedCtx({ supportType: 'simple' }))).toBeUndefined();
  });
});
