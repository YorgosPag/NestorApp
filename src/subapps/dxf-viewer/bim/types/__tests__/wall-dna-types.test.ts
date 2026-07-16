/**
 * ADR-447 — Wall DNA seed catalog + exterior-insulation predicate tests.
 *
 * Covers the Revit-grade default wall types (brick core + Knauf + cement plaster +
 * optional EPS) and the `wallHasExteriorInsulation` dedup predicate that excludes
 * an already-insulated wall from the ADR-396 building envelope.
 */

import {
  WALL_TYPE_SEEDS,
  getDefaultDnaForCategory,
  wallHasExteriorInsulation,
  createExterior25EpsDna,
  computeTotalThickness,
  type WallDna,
} from '../wall-dna-types';
import {
  buildupBoundaryFractions,
  computeBuildupTotalThickness,
  type BuildupThicknessSource,
} from '../layered-buildup';

describe('ADR-584 — wall DNA κάθεται στο LayeredBuildup SSoT', () => {
  it('computeTotalThickness delegates to the generic — δεν ξαναγράφει την αριθμητική', () => {
    for (const seed of WALL_TYPE_SEEDS) {
      expect(computeTotalThickness(seed.dna.layers)).toBe(
        computeBuildupTotalThickness(seed.dna.layers),
      );
    }
  });

  it('WallDna ικανοποιεί δομικά το BuildupThicknessSource — οι generic helpers δουλεύουν', () => {
    const dna = getDefaultDnaForCategory('exterior');
    const src: BuildupThicknessSource = dna; // compile-time proof of the structural fit
    const fractions = buildupBoundaryFractions(src);

    expect(fractions).toHaveLength(dna.layers.length + 1);
    expect(fractions[0]).toBe(0);
    expect(fractions[fractions.length - 1]).toBeCloseTo(1);
  });
});

describe('ADR-447 — WALL_TYPE_SEEDS catalog', () => {
  it('exposes the 7 Revit wall types (3 exterior + interior/partition/parapet/fence)', () => {
    expect(WALL_TYPE_SEEDS.map((s) => s.key)).toEqual([
      'exterior', 'exterior-eps', 'exterior-20', 'interior', 'partition', 'parapet', 'fence',
    ]);
  });

  it('every seed total = sum of its layers (SSoT, no double-entry)', () => {
    for (const seed of WALL_TYPE_SEEDS) {
      expect(seed.dna.totalThickness).toBe(computeTotalThickness(seed.dna.layers));
    }
  });

  it('matches the agreed thicknesses (ADR-449 X4: ΜΟΝΟ δομικός πυρήνας + μόνωση, σοβάς=finish skin)', () => {
    const byKey = (k: string): WallDna => WALL_TYPE_SEEDS.find((s) => s.key === k)!.dna;
    expect(byKey('exterior').totalThickness).toBe(210);     // τούβλο 210 (σοβάς αφαιρέθηκε από DNA)
    expect(byKey('exterior-eps').totalThickness).toBe(310); // EPS 100 + τούβλο 210
    expect(byKey('exterior-20').totalThickness).toBe(160);  // τούβλο 160
    expect(byKey('interior').totalThickness).toBe(70);      // τούβλο 70
    expect(byKey('partition').totalThickness).toBe(75);     // τούβλο 75
  });

  it('all primary cores are RED brick masonry (Greek RC-frame infill)', () => {
    for (const key of ['exterior', 'exterior-eps', 'exterior-20', 'interior']) {
      const core = WALL_TYPE_SEEDS.find((s) => s.key === key)!.dna.layers.find((l) => l.side === 'core');
      expect(core?.materialId).toBe('mat-brick-masonry');
    }
  });

  it('the PRIMARY exterior seed equals getDefaultDnaForCategory (legacy id compat)', () => {
    const primary = WALL_TYPE_SEEDS.find((s) => s.key === 'exterior')!.dna;
    expect(primary).toEqual(getDefaultDnaForCategory('exterior'));
  });
});

describe('ADR-447 — wallHasExteriorInsulation', () => {
  it('true for the «με θερμοπρόσοψη» type (EPS on the exterior side)', () => {
    expect(wallHasExteriorInsulation(createExterior25EpsDna())).toBe(true);
  });

  it('false for the plain exterior / interior types (no insulation layer)', () => {
    expect(wallHasExteriorInsulation(getDefaultDnaForCategory('exterior'))).toBe(false);
    expect(wallHasExteriorInsulation(getDefaultDnaForCategory('interior'))).toBe(false);
  });

  it('false for undefined / null dna', () => {
    expect(wallHasExteriorInsulation(undefined)).toBe(false);
    expect(wallHasExteriorInsulation(null)).toBe(false);
  });

  it('ignores insulation on a NON-exterior side (core/interior)', () => {
    const dna: WallDna = {
      layers: [{ id: 'c', name: 'EPS core', thickness: 100, materialId: 'mat-eps', side: 'core' }],
      totalThickness: 100,
    };
    expect(wallHasExteriorInsulation(dna)).toBe(false);
  });
});
