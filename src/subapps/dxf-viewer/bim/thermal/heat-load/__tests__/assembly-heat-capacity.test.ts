/**
 * ADR-422 L7.9-B — tests για την geometry-derived επιφανειακή θερμοχωρητικότητα `κ_m`
 * (EN ISO 13790 §12.3.1.1 effective-thickness). jest globals — ΟΧΙ vitest import.
 *
 * Φυσική: `κ_m = Σ_layer ρ·c·d_eff` (J/m²K), interior→inward, σωρευτικό clamp στο
 * `d_eff,max=0.10 m`, διακοπή στην 1η μονωτική στρώση (`λ ≤ 0.10`). Όλες οι αναμενόμενες
 * τιμές ΠΑΡΑΓΟΝΤΑΙ από τον τύπο (ΟΧΙ hardcoded magic).
 */

import {
  THERMAL_MASS_EFFECTIVE_THICKNESS_MAX_M,
  computeArealHeatCapacity,
  computeSlabArealHeatCapacity,
  computeWallArealHeatCapacity,
  slabDnaToHeatCapacityLayers,
  wallDnaToHeatCapacityLayers,
  type HeatCapacityLayer,
} from '../assembly-heat-capacity';
import {
  createDefaultExteriorDna,
  type WallDna,
  type WallDnaLayer,
} from '../../../types/wall-dna-types';
import {
  createDefaultFloorBuildup,
  createDefaultRoofBuildup,
  type SlabDna,
} from '../../../types/slab-dna-types';

// ─── computeArealHeatCapacity (raw layers) ──────────────────────────────────────

describe('computeArealHeatCapacity', () => {
  it('μονό στρώμα μπετόν: κ = ρ·c·d (ρ=2400, c=840, d=0.10)', () => {
    const layers: HeatCapacityLayer[] = [{ thickness_m: 0.1, density: 2400, specificHeat: 840 }];
    expect(computeArealHeatCapacity(layers)).toBeCloseTo(2400 * 840 * 0.1); // 201600
  });

  it('clamp effective-thickness: στρώμα 0.30 m μετράει μόνο έως d_eff,max (0.10 m)', () => {
    const layers: HeatCapacityLayer[] = [{ thickness_m: 0.3, density: 2400, specificHeat: 840 }];
    expect(computeArealHeatCapacity(layers)).toBeCloseTo(2400 * 840 * 0.1); // 201600 (όχι ×0.30)
    expect(THERMAL_MASS_EFFECTIVE_THICKNESS_MAX_M).toBe(0.1);
  });

  it('πολλαπλά στρώματα: αθροίζει interior→inward έως το clamp', () => {
    // plaster-int 0.02 (1200·1000) + concrete clamp 0.08 (2400·840) — Σd=0.10.
    const layers: HeatCapacityLayer[] = [
      { thickness_m: 0.02, density: 1200, specificHeat: 1000, lambda: 0.7 },
      { thickness_m: 0.21, density: 2400, specificHeat: 840, lambda: 2.0 },
    ];
    const expected = 1200 * 1000 * 0.02 + 2400 * 840 * 0.08; // 24000 + 161280 = 185280
    expect(computeArealHeatCapacity(layers)).toBeCloseTo(expected);
  });

  it('insulation-stop: η μάζα πέρα από την 1η μονωτική στρώση (λ≤0.10) αποσυνδέεται', () => {
    // plaster-int (μη-μόνωση) → eps (λ=0.035, μόνωση → stop) → concrete (αγνοείται).
    const layers: HeatCapacityLayer[] = [
      { thickness_m: 0.02, density: 1200, specificHeat: 1000, lambda: 0.7 },
      { thickness_m: 0.08, density: 15, specificHeat: 1500, lambda: 0.035 },
      { thickness_m: 0.1, density: 2400, specificHeat: 840, lambda: 2.0 },
    ];
    expect(computeArealHeatCapacity(layers)).toBeCloseTo(1200 * 1000 * 0.02); // 24000 (μόνο ο σοβάς)
  });

  it('παραλείπει degenerate στρώσεις (μηδενικό/μη-πεπερασμένο ρ ή c ή πάχος)', () => {
    const layers: HeatCapacityLayer[] = [
      { thickness_m: 0.05, density: 0, specificHeat: 1000 }, // ρ=0 → skip
      { thickness_m: 0.05, density: 2000, specificHeat: 900 }, // 2000·900·0.05 = 90000
    ];
    expect(computeArealHeatCapacity(layers)).toBeCloseTo(2000 * 900 * 0.05);
  });

  it('μονοτονία: πυκνότερο/πιο θερμοχωρητικό στρώμα → μεγαλύτερο κ (ίδιο πάχος)', () => {
    const gypsum: HeatCapacityLayer[] = [{ thickness_m: 0.05, density: 900, specificHeat: 1090 }];
    const concrete: HeatCapacityLayer[] = [{ thickness_m: 0.05, density: 2400, specificHeat: 840 }];
    expect(computeArealHeatCapacity(concrete)).toBeGreaterThan(computeArealHeatCapacity(gypsum));
  });

  it('κενές στρώσεις → κ = 0', () => {
    expect(computeArealHeatCapacity([])).toBe(0);
  });

  it('overridable d_eff,max: μεγαλύτερο όριο → περισσότερη μάζα μετράει', () => {
    const layers: HeatCapacityLayer[] = [{ thickness_m: 0.2, density: 2400, specificHeat: 840 }];
    const def = computeArealHeatCapacity(layers); // clamp 0.10
    const wider = computeArealHeatCapacity(layers, { dEffMaxM: 0.2 }); // clamp 0.20
    expect(wider).toBeCloseTo(def * 2);
  });
});

// ─── wallDnaToHeatCapacityLayers + computeWallArealHeatCapacity ──────────────────

describe('wallDnaToHeatCapacityLayers', () => {
  it('αντιστρέφει σε interior-first σειρά (DNA = exterior→interior)', () => {
    const dna = createDefaultExteriorDna(); // [plaster-ext, concrete-c25, plaster-int]
    const layers = wallDnaToHeatCapacityLayers(dna);
    expect(layers).toHaveLength(3);
    // out[0] = η ΕΣΩΤΕΡΙΚΗ στρώση (plaster-int: ρ=1200), out[1] = πυρήνας (concrete: ρ=2400).
    expect(layers[0].density).toBe(1200);
    expect(layers[0].thickness_m).toBeCloseTo(0.02);
    expect(layers[1].density).toBe(2400);
    expect(layers[2].density).toBe(1800); // plaster-ext
  });

  it('παραλείπει στρώσεις χωρίς γνωστό ρ/c (custom/άγνωστα υλικά)', () => {
    const layers: readonly WallDnaLayer[] = [
      { id: 'a', name: 'Custom', thickness: 50, materialId: 'custom-unknown', side: 'core' },
      { id: 'b', name: 'Concrete', thickness: 100, materialId: 'mat-concrete-c25', side: 'core' },
    ];
    const dna: WallDna = { layers, totalThickness: 150 };
    const out = wallDnaToHeatCapacityLayers(dna);
    expect(out).toHaveLength(1); // μόνο το μπετόν
    expect(out[0].density).toBe(2400);
  });
});

describe('computeWallArealHeatCapacity', () => {
  it('default exterior DNA (μπετόν) → κ_m από worked example (185280 J/m²K)', () => {
    const dna = createDefaultExteriorDna();
    // plaster-int 0.02 (1200·1000) + concrete clamp 0.08 (2400·840) = 185280.
    expect(computeWallArealHeatCapacity(dna)).toBeCloseTo(1200 * 1000 * 0.02 + 2400 * 840 * 0.08);
  });

  it('DNA με μόνο custom/άγνωστα υλικά → 0 (fallback κατηγορία)', () => {
    const layers: readonly WallDnaLayer[] = [
      { id: 'a', name: 'Custom', thickness: 100, materialId: 'custom-foo', side: 'core' },
    ];
    const dna: WallDna = { layers, totalThickness: 100 };
    expect(computeWallArealHeatCapacity(dna)).toBe(0);
  });
});

// ─── L7.9-C — slabDnaToHeatCapacityLayers + computeSlabArealHeatCapacity ──────────

describe('slabDnaToHeatCapacityLayers (interior-first ανά kind)', () => {
  it('floor: forward (top-first) — εσωτ. επιφάνεια προς τα πάνω (finish side)', () => {
    const dna = createDefaultFloorBuildup(); // top→bottom: tile, screed, insulation, concrete, plaster
    const layers = slabDnaToHeatCapacityLayers(dna, 'floor');
    expect(layers[0].density).toBe(2000); // tile (πάνω = πρώτο)
    expect(layers[0].thickness_m).toBeCloseTo(0.01);
    expect(layers[1].density).toBe(2000); // screed
    expect(layers[2].lambda).toBeCloseTo(0.035); // acoustic insulation
  });

  it('ceiling: reverse (bottom-first) — εσωτ. επιφάνεια προς τα κάτω (soffit side)', () => {
    const dna = createDefaultFloorBuildup();
    const layers = slabDnaToHeatCapacityLayers(dna, 'ceiling');
    expect(layers[0].density).toBe(1200); // plaster soffit (κάτω = πρώτο)
    expect(layers[0].thickness_m).toBeCloseTo(0.015);
    expect(layers[1].density).toBe(2400); // concrete core
  });
});

describe('computeSlabArealHeatCapacity (worked example από τον τύπο)', () => {
  it('default FLOOR (top-first): tile + screed, μετά insulation-stop → 136800 J/m²K', () => {
    const dna = createDefaultFloorBuildup();
    // tile 0.010·2000·840 + screed 0.060·2000·1000 = 16800 + 120000 (acoustic insul λ=0.035 → stop).
    const expected = 0.01 * 2000 * 840 + 0.06 * 2000 * 1000; // 136800
    expect(computeSlabArealHeatCapacity(dna, 'floor')).toBeCloseTo(expected);
  });

  it('ΙΔΙΟ DNA ως ceiling (bottom-first): soffit + concrete clamp → 189360 J/m²K (≠ floor)', () => {
    const dna = createDefaultFloorBuildup();
    // plaster 0.015·1200·1000 + concrete clamp 0.085·2400·840 = 18000 + 171360.
    const expected = 0.015 * 1200 * 1000 + 0.085 * 2400 * 840; // 189360
    const ceiling = computeSlabArealHeatCapacity(dna, 'ceiling');
    expect(ceiling).toBeCloseTo(expected);
    // §5.2: το interior-first ordering κάνει το ΙΔΙΟ DNA διαφορετικό floor↔ceiling.
    expect(ceiling).not.toBeCloseTo(computeSlabArealHeatCapacity(dna, 'floor'));
  });

  it('default ROOF (bottom-first): soffit + concrete clamp → 189360 (βαριά στέγη)', () => {
    const dna = createDefaultRoofBuildup(); // RC core 200 + soffit 15 (κάτω)
    const expected = 0.015 * 1200 * 1000 + 0.085 * 2400 * 840; // 189360
    expect(computeSlabArealHeatCapacity(dna, 'roof')).toBeCloseTo(expected);
  });

  it('κ_m οροφής (RC core) σε ίδια τάξη με concrete τοίχο L7.9-B (~185000)', () => {
    const roof = computeSlabArealHeatCapacity(createDefaultRoofBuildup(), 'roof');
    expect(roof).toBeGreaterThan(150_000);
    expect(roof).toBeLessThan(220_000);
  });

  it('DNA με μόνο άγνωστα υλικά → 0 (fallback κατηγορία, zero-regression)', () => {
    const dna: SlabDna = {
      layers: [{ id: 'x', name: 'Custom', thickness: 200, materialId: 'custom-foo', zone: 'core' }],
      totalThickness: 200,
    };
    expect(computeSlabArealHeatCapacity(dna, 'floor')).toBe(0);
  });
});
