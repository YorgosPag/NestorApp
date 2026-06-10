/**
 * ADR-422 L7.3 Slice E — tests για τη geometry-derived σκίαση ορίζοντα (pure). jest
 * globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει το end-to-end `F_hor` (`resolveWindowHorizonFactor`): zero-regression (καμία
 * μάζα / μάζα κάτω από το άνοιγμα / πίσω από το facade → undefined), worked example
 * (h=10,d=10 → α=45° → πίνακας), μονοτονία (ψηλότερη/κοντινότερη → μικρότερο F_hor),
 * max-angle σε πολλές μάζες, και τον πίνακα `HORIZON_GEOMETRY_SHADING_FACTOR`.
 */

import {
  resolveWindowHorizonFactor,
  type HorizonObstacle,
} from '../solar-horizon-geometry';
import {
  getHorizonGeometryShadingFactor,
  SOLAR_ORIENTATIONS,
  type SolarOrientation,
} from '../annual-gains-config';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** Μάζα-εμπόδιο: τετράγωνο footprint [minX,maxX]×[minY,maxY] (scene units=m) + ύψος κορυφής. */
function mass(minX: number, maxX: number, minY: number, maxY: number, topElevationM: number): HorizonObstacle {
  return {
    polygonXY: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    topElevationM,
  };
}

/** Νότιο παράθυρο: az=180 → outward normal (0,−1)· facade στο openingPos (thickness 0). */
const southBase = {
  openingPos: { x: 0, y: 0 },
  azimuthDeg: 180,
  wallThicknessMm: 0,
  sceneToM: 1,
  apertureElevationM: 0,
};

// ─── resolveWindowHorizonFactor (end-to-end F_hor) ─────────────────────────────

describe('resolveWindowHorizonFactor (end-to-end F_hor)', () => {
  it('καμία μάζα → undefined (zero-regression — fallback Slice C)', () => {
    expect(resolveWindowHorizonFactor({ ...southBase, obstacles: [] })).toBeUndefined();
  });

  it('μάζα κάτω από το άνοιγμα (top ≤ aperture) → undefined', () => {
    const low = mass(-1, 1, -20, -10, 0); // top 0 = aperture 0 → h≤0
    expect(
      resolveWindowHorizonFactor({ ...southBase, apertureElevationM: 5, obstacles: [low] }),
    ).toBeUndefined();
  });

  it('μάζα πίσω από το facade (βόρεια, y>0 για νότιο παράθυρο) → undefined', () => {
    const behind = mass(-1, 1, 10, 20, 30);
    expect(resolveWindowHorizonFactor({ ...southBase, obstacles: [behind] })).toBeUndefined();
  });

  it('worked example: h=10, d=10 → α=45° → F_hor(45°, S) = 0.65', () => {
    // top 10, aperture 0 → h=10· κοντινή παρειά στο y=−10 → d=10.
    const m = mass(-1, 1, -20, -10, 10);
    const f = resolveWindowHorizonFactor({ ...southBase, obstacles: [m] });
    expect(f).toBeDefined();
    expect(f as number).toBeCloseTo(getHorizonGeometryShadingFactor(45, 'S'));
    expect(f as number).toBeCloseTo(0.65);
  });

  it('χρησιμοποιεί την ΚΟΝΤΙΝΗ παρειά (silhouette), όχι την μακρινή', () => {
    // βαθιά μάζα y∈[−30,−10]: κοντινή παρειά d=10 (όχι 30) → α=atan(10/10)=45°.
    const deep = mass(-1, 1, -30, -10, 10);
    const f = resolveWindowHorizonFactor({ ...southBase, obstacles: [deep] });
    expect(f as number).toBeCloseTo(getHorizonGeometryShadingFactor(45, 'S'));
  });

  it('ψηλότερη μάζα → μικρότερο F_hor (μεγαλύτερη γωνία)', () => {
    const lower = resolveWindowHorizonFactor({ ...southBase, obstacles: [mass(-1, 1, -20, -10, 10)] });
    const higher = resolveWindowHorizonFactor({ ...southBase, obstacles: [mass(-1, 1, -20, -10, 20)] });
    expect(higher as number).toBeLessThan(lower as number);
  });

  it('μακρινότερη μάζα → μεγαλύτερο F_hor (λιγότερη σκίαση)', () => {
    const near = resolveWindowHorizonFactor({ ...southBase, obstacles: [mass(-1, 1, -20, -10, 10)] });
    const far = resolveWindowHorizonFactor({ ...southBase, obstacles: [mass(-1, 1, -40, -20, 10)] });
    expect(far as number).toBeGreaterThan(near as number);
  });

  it('κρατά τη ΜΕΓΙΣΤΗ γωνία ανύψωσης σε πολλές μάζες', () => {
    const weak = mass(-1, 1, -40, -20, 10); // d=20, h=10 → μικρή γωνία
    const strong = mass(-1, 1, -20, -10, 20); // d=10, h=20 → μεγάλη γωνία (clamp 60°)
    const both = resolveWindowHorizonFactor({ ...southBase, obstacles: [weak, strong] });
    const onlyStrong = resolveWindowHorizonFactor({ ...southBase, obstacles: [strong] });
    expect(both as number).toBeCloseTo(onlyStrong as number);
  });

  it('αποτέλεσμα πάντα ∈ (0,1]', () => {
    const extreme = mass(-1, 1, -2, -1, 100); // πολύ ψηλή, πολύ κοντά
    const f = resolveWindowHorizonFactor({ ...southBase, obstacles: [extreme] });
    expect(f as number).toBeGreaterThan(0);
    expect(f as number).toBeLessThanOrEqual(1);
  });
});

// ─── HORIZON_GEOMETRY_SHADING_FACTOR (πίνακας) ─────────────────────────────────

describe('getHorizonGeometryShadingFactor (πίνακας)', () => {
  it('α ≤ 0 → 1.0 παντού (κανένα εμπόδιο, zero-regression)', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      expect(getHorizonGeometryShadingFactor(0, o)).toBe(1);
      expect(getHorizonGeometryShadingFactor(-10, o)).toBe(1);
    }
  });

  it('μονοτονία: μεγαλύτερη γωνία → μικρότερο (ή ίσο) F_hor, όλα ∈ (0,1]', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      let prev = 1.0001;
      for (const a of [0, 15, 30, 45, 60, 90]) {
        const f = getHorizonGeometryShadingFactor(a, o);
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThanOrEqual(1);
        expect(f).toBeLessThanOrEqual(prev + 1e-9);
        prev = f;
      }
    }
  });

  it('Νότος κόβεται ΠΕΡΙΣΣΟΤΕΡΟ από Βορρά στην ίδια γωνία (χαμηλός χειμ. ήλιος)', () => {
    expect(getHorizonGeometryShadingFactor(45, 'S')).toBeLessThan(getHorizonGeometryShadingFactor(45, 'N'));
  });

  it('συμμετρικό Α↔Δ & ΝΑ↔ΝΔ', () => {
    for (const a of [15, 30, 45, 60]) {
      expect(getHorizonGeometryShadingFactor(a, 'E')).toBeCloseTo(getHorizonGeometryShadingFactor(a, 'W'));
      expect(getHorizonGeometryShadingFactor(a, 'SE')).toBeCloseTo(getHorizonGeometryShadingFactor(a, 'SW'));
    }
  });

  it('γραμμική interpolation μεταξύ γωνιών (45° = μέσος 30°/60° μόνο αν γραμμικός)', () => {
    // smoke: 22.5° βρίσκεται μεταξύ των τιμών 15° και 30° (S column)
    const f = getHorizonGeometryShadingFactor(22.5, 'S' as SolarOrientation);
    expect(f).toBeLessThan(getHorizonGeometryShadingFactor(15, 'S'));
    expect(f).toBeGreaterThan(getHorizonGeometryShadingFactor(30, 'S'));
  });

  it('γωνία πέρα από 60° → clamp στον τελευταίο συντελεστή', () => {
    expect(getHorizonGeometryShadingFactor(120, 'S')).toBeCloseTo(getHorizonGeometryShadingFactor(60, 'S'));
  });
});
