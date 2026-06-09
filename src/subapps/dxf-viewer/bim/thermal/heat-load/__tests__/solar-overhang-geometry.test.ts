/**
 * ADR-422 L7.3 Slice B — tests για τη geometry-derived σκίαση προβόλου (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει: το βάθος προβόλου `d_ov` μέσω ray-cast (`computeOverhangProjection`),
 * τη γωνία `β = atan(d_ov/h_top)` (`computeOverhangAngleDeg`) και το end-to-end
 * `F_ov` (`resolveWindowOverhangFactor`) — incl. zero-regression (κανένας πρόβολος
 * / ευθυγραμμισμένος όροφος / set-back / παράθυρο στην παρειά → no shading).
 */

import {
  computeOverhangAngleDeg,
  computeOverhangProjection,
  resolveWindowOverhangFactor,
  type OverhangOutline,
} from '../solar-overhang-geometry';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** Τετράγωνο outline [minX,maxX]×[minY,maxY] (world XY, scene units = m). */
function rect(minX: number, maxX: number, minY: number, maxY: number): OverhangOutline {
  return {
    polygonXY: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  };
}

const EAST_NORMAL = { x: 1, y: 0 }; // outward normal προς +X (azimuth 90°)

// ─── computeOverhangProjection (ray-cast βάθους προβόλου) ───────────────────────

describe('computeOverhangProjection (d_ov μέσω ray-cast από το facade)', () => {
  const facade = { x: 0, y: 0 };

  it('μπαλκόνι που προεξέχει 1.5 m → d_ov ≈ 1.5 (απόσταση εξόδου)', () => {
    const balcony = rect(-1, 1.5, -2, 2); // δεξιά ακμή στο x=1.5
    const d = computeOverhangProjection({ facadePoint: facade, outwardNormal: EAST_NORMAL, outlines: [balcony] });
    expect(d).toBeCloseTo(1.5);
  });

  it('ευθυγραμμισμένος όροφος (slab edge στο facade) → d_ov ≈ 0 (zero-regression)', () => {
    const aligned = rect(-1, 0, -2, 2); // δεξιά ακμή ακριβώς στο x=0
    const d = computeOverhangProjection({ facadePoint: facade, outwardNormal: EAST_NORMAL, outlines: [aligned] });
    expect(d).toBeCloseTo(0);
  });

  it('set-back όροφος (slab πίσω από το facade) → d_ov = 0 (η ακτίνα δεν τον τέμνει)', () => {
    const setback = rect(-2, -0.5, -2, 2); // ολόκληρος σε x<0
    const d = computeOverhangProjection({ facadePoint: facade, outwardNormal: EAST_NORMAL, outlines: [setback] });
    expect(d).toBe(0);
  });

  it('χωρίς outlines → 0', () => {
    expect(computeOverhangProjection({ facadePoint: facade, outwardNormal: EAST_NORMAL, outlines: [] })).toBe(0);
  });

  it('degenerate normal (0,0) → 0', () => {
    const balcony = rect(-1, 1.5, -2, 2);
    expect(computeOverhangProjection({ facadePoint: facade, outwardNormal: { x: 0, y: 0 }, outlines: [balcony] })).toBe(0);
  });

  it('κρατά τη ΜΕΓΙΣΤΗ έξοδο από πολλαπλά outlines', () => {
    const shallow = rect(-1, 0.8, -2, 2);
    const deep = rect(-1, 2.2, -2, 2);
    const d = computeOverhangProjection({ facadePoint: facade, outwardNormal: EAST_NORMAL, outlines: [shallow, deep] });
    expect(d).toBeCloseTo(2.2);
  });

  it('αγνοεί outline με <3 κορυφές (degenerate)', () => {
    const degenerate: OverhangOutline = { polygonXY: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };
    expect(computeOverhangProjection({ facadePoint: facade, outwardNormal: EAST_NORMAL, outlines: [degenerate] })).toBe(0);
  });
});

// ─── computeOverhangAngleDeg (β = atan(d_ov/h_top)) ────────────────────────────

describe('computeOverhangAngleDeg', () => {
  it('d_ov = 0 → β = 0 (κανένας πρόβολος)', () => {
    expect(computeOverhangAngleDeg({ projectionDist: 0, height: 1 })).toBe(0);
  });

  it('h_top ≤ 0 → β = 0 (παράθυρο στην παρειά του προβόλου)', () => {
    expect(computeOverhangAngleDeg({ projectionDist: 1, height: 0 })).toBe(0);
    expect(computeOverhangAngleDeg({ projectionDist: 1, height: -0.5 })).toBe(0);
  });

  it('ίσο βάθος/ύψος → 45°', () => {
    expect(computeOverhangAngleDeg({ projectionDist: 1, height: 1 })).toBeCloseTo(45);
  });

  it('d_ov / h_top = 1/√3 → 30°', () => {
    expect(computeOverhangAngleDeg({ projectionDist: 1, height: Math.sqrt(3) })).toBeCloseTo(30);
  });

  it('μεγαλύτερο βάθος (ίδιο ύψος) → μεγαλύτερη γωνία (μονοτονία)', () => {
    const shallow = computeOverhangAngleDeg({ projectionDist: 0.5, height: 1 });
    const deep = computeOverhangAngleDeg({ projectionDist: 2, height: 1 });
    expect(deep).toBeGreaterThan(shallow);
  });
});

// ─── resolveWindowOverhangFactor (end-to-end F_ov) ─────────────────────────────

describe('resolveWindowOverhangFactor (end-to-end F_ov)', () => {
  const base = {
    openingPos: { x: 0, y: 0 },
    azimuthDeg: 90, // ανατολικό → outward normal +X, orientation E
    sillHeightMm: 900,
    openingHeightMm: 1400, // head 2300mm
    ceilingHeightMm: 2800, // h_top = 0.5 m
    wallThicknessMm: 0, // facade = openingPos
    sceneToM: 1,
  };

  it('χωρίς outlines → undefined (zero-regression — πεδίο absent)', () => {
    expect(resolveWindowOverhangFactor({ ...base, outlines: [] })).toBeUndefined();
  });

  it('ευθυγραμμισμένος slab (d_ov≈0) → undefined (zero-regression)', () => {
    const aligned = rect(-1, 0, -2, 2);
    expect(resolveWindowOverhangFactor({ ...base, outlines: [aligned] })).toBeUndefined();
  });

  it('πρόβολος → συντελεστής < 1 (σκίαση)', () => {
    const balcony = rect(-1, 1.0, -2, 2); // d_ov = 1 m, h_top 0.5 → β = atan(2) ≈ 63° → clamp E
    const f = resolveWindowOverhangFactor({ ...base, outlines: [balcony] });
    expect(f).toBeDefined();
    expect(f as number).toBeGreaterThan(0);
    expect(f as number).toBeLessThan(1);
  });

  it('βαθύτερος πρόβολος → μικρότερος συντελεστής (περισσότερη σκίαση)', () => {
    const shallow = resolveWindowOverhangFactor({ ...base, outlines: [rect(-1, 0.5, -2, 2)] });
    const deep = resolveWindowOverhangFactor({ ...base, outlines: [rect(-1, 2.0, -2, 2)] });
    expect(shallow).toBeDefined();
    expect(deep).toBeDefined();
    expect(deep as number).toBeLessThan(shallow as number);
  });

  it('παράθυρο στην παρειά (h_top ≤ 0) → undefined (β=0)', () => {
    const balcony = rect(-1, 1.0, -2, 2);
    const f = resolveWindowOverhangFactor({ ...base, ceilingHeightMm: 2000, outlines: [balcony] }); // head 2300 > 2000
    expect(f).toBeUndefined();
  });

  it('πάχος τοίχου μετατοπίζει το facade προς τα έξω (mm → scene units)', () => {
    // wallThickness 300mm → facade στο x=0.3· slab δεξιά ακμή στο x=0.3 → d_ov≈0 → undefined.
    const flush = rect(-1, 0.3, -2, 2);
    expect(resolveWindowOverhangFactor({ ...base, wallThicknessMm: 300, outlines: [flush] })).toBeUndefined();
  });
});
