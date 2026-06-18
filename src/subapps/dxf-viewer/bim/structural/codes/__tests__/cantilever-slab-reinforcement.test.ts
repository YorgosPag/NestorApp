/**
 * ADR-498 — cantilever-aware slab reinforcement: ο πρόβολος (hogging q·L²/2) βάζει τη
 * strength σχάρα **ΕΠΑΝΩ** (όχι κάτω), και απαιτεί περισσότερο χάλυβα από το αμφιέρειστο
 * (q·L²/8) για το ίδιο άνοιγμα/φορτίο. Αμφιέρειστο: strength ΚΑΤΩ (μηδέν regression).
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import type { SlabFoundationSectionContext } from '../structural-code-types';
import type { RebarMesh } from '../../reinforcement/slab-foundation-reinforcement-types';

/** As ανά μέτρο (mm²/m) μιας σχάρας. */
function asPerM(m: RebarMesh): number {
  return (Math.PI / 4) * m.diameterMm ** 2 * (1000 / m.spacingMm);
}

function suspendedCtx(over: Partial<SlabFoundationSectionContext>): SlabFoundationSectionContext {
  return {
    widthMm: 5000, lengthMm: 3000, thicknessMm: 300, grossAreaMm2: 15e6,
    kind: 'suspended', concreteGrade: 'C25/30', designLoadKpa: 20,
    ...over,
  };
}

describe('suggestSlabFoundationReinforcement — ADR-498 cantilever', () => {
  it('αμφιέρειστη: strength σχάρα ΚΑΤΩ (sagging)', () => {
    const r = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(
      suspendedCtx({ supportType: 'simple', maxFreeSpanMm: 5000 }),
    );
    expect(asPerM(r.bottomMeshX)).toBeGreaterThan(asPerM(r.topMeshX)); // κάτω = strength
  });

  it('πρόβολος: strength σχάρα ΕΠΑΝΩ (hogging)', () => {
    const r = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(
      suspendedCtx({ supportType: 'cantilever', cantileverSpanMm: 5000 }),
    );
    expect(asPerM(r.topMeshX)).toBeGreaterThan(asPerM(r.bottomMeshX)); // άνω = strength
  });

  it('πρόβολος ÷2 > αμφιέρειστη ÷8 (4× ροπή ίδιο άνοιγμα) → περισσότερος χάλυβας', () => {
    const simple = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(
      suspendedCtx({ supportType: 'simple', maxFreeSpanMm: 5000 }),
    );
    const canti = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(
      suspendedCtx({ supportType: 'cantilever', cantileverSpanMm: 5000 }),
    );
    // strength layer: κάτω (αμφιέρειστο) vs άνω (πρόβολος)
    expect(asPerM(canti.topMeshX)).toBeGreaterThan(asPerM(simple.bottomMeshX));
  });

  it('χωρίς override (absent supportType) → συμπεριφορά αμφιέρειστης (μηδέν regression)', () => {
    const r = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(
      suspendedCtx({ maxFreeSpanMm: 5000 }),
    );
    expect(asPerM(r.bottomMeshX)).toBeGreaterThan(asPerM(r.topMeshX));
  });
});
