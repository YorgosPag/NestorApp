/**
 * ADR-422 L7.3 Slice D — tests για τη geometry-derived σκίαση πλευρικού πτερυγίου
 * (pure). jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει το end-to-end `F_fin` (`resolveWindowFinFactor`): zero-regression (κανένα
 * outline / recessed / ευθυγραμμισμένο πτερύγιο → undefined), βάθος → μικρότερος
 * συντελεστής, και orientation (ανατολικό κόβεται περισσότερο από νότιο στο ίδιο β_fin).
 */

import { resolveWindowFinFactor } from '../solar-fin-geometry';
import { getFinGeometryShadingFactor } from '../annual-gains-config';
import type { OverhangOutline } from '../solar-overhang-geometry';

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

/**
 * Ανατολικό παράθυρο: outward normal +X (az=90°), εφαπτομένη όψης κατά −Y → τα πλευρικά
 * άκρα πέφτουν στο y=±0.75 (openingWidth 1.5 m). Το facade = openingPos (thickness 0).
 */
const eastBase = {
  openingPos: { x: 0, y: 0 },
  azimuthDeg: 90,
  openingWidthMm: 1500, // halfWidth 0.75 m
  wallThicknessMm: 0,
  sceneToM: 1,
};

// ─── resolveWindowFinFactor (end-to-end F_fin) ─────────────────────────────────

describe('resolveWindowFinFactor (end-to-end F_fin)', () => {
  it('χωρίς outlines → undefined (zero-regression — fallback Slice C)', () => {
    expect(resolveWindowFinFactor({ ...eastBase, outlines: [] })).toBeUndefined();
  });

  it('recessed πτερύγιο (όλο σε x<0, η ακτίνα δεν το τέμνει) → undefined', () => {
    const recessed = rect(-1, -0.2, 0.7, 0.9); // δίπλα στο πάνω άκρο αλλά πίσω από το facade
    expect(resolveWindowFinFactor({ ...eastBase, outlines: [recessed] })).toBeUndefined();
  });

  it('ευθυγραμμισμένο πτερύγιο (ακμή ακριβώς στο facade, d≈0) → undefined', () => {
    const aligned = rect(-1, 0, 0.7, 0.9);
    expect(resolveWindowFinFactor({ ...eastBase, outlines: [aligned] })).toBeUndefined();
  });

  it('κάθετος τοίχος στο πλάι που προεξέχει → συντελεστής < 1 (σκίαση)', () => {
    // fin στο πάνω άκρο (y∈[0.7,0.9] περιέχει το edge y=0.75), προεξέχει ως x=0.6 → d_fin=0.6.
    const fin = rect(-1, 0.6, 0.7, 0.9);
    const f = resolveWindowFinFactor({ ...eastBase, outlines: [fin] });
    expect(f).toBeDefined();
    expect(f as number).toBeGreaterThan(0);
    expect(f as number).toBeLessThan(1);
  });

  it('βαθμονόμηση: d_fin=0.6 / w=1.5 → β=21.8° → F_fin = πίνακας(β, E)', () => {
    const fin = rect(-1, 0.6, 0.7, 0.9); // d_fin = 0.6 m
    const f = resolveWindowFinFactor({ ...eastBase, outlines: [fin] });
    const betaDeg = (Math.atan(0.6 / 1.5) * 180) / Math.PI;
    expect(f as number).toBeCloseTo(getFinGeometryShadingFactor(betaDeg, 'E'));
  });

  it('βαθύτερο πτερύγιο → μικρότερος συντελεστής (περισσότερη σκίαση)', () => {
    const shallow = resolveWindowFinFactor({ ...eastBase, outlines: [rect(-1, 0.3, 0.7, 0.9)] });
    const deep = resolveWindowFinFactor({ ...eastBase, outlines: [rect(-1, 1.2, 0.7, 0.9)] });
    expect(shallow).toBeDefined();
    expect(deep).toBeDefined();
    expect(deep as number).toBeLessThan(shallow as number);
  });

  it('κρατά τη ΜΕΓΙΣΤΗ προβολή από αριστερή/δεξιά πλευρά', () => {
    // ρηχό fin πάνω (d=0.3) + βαθύ fin κάτω (y∈[-0.9,-0.7] περιέχει edge y=-0.75, d=1.0).
    const shallowTop = rect(-1, 0.3, 0.7, 0.9);
    const deepBottom = rect(-1, 1.0, -0.9, -0.7);
    const f = resolveWindowFinFactor({ ...eastBase, outlines: [shallowTop, deepBottom] });
    const betaDeep = (Math.atan(1.0 / 1.5) * 180) / Math.PI; // από το βαθύ (max)
    expect(f as number).toBeCloseTo(getFinGeometryShadingFactor(betaDeep, 'E'));
  });

  it('ανατολικό κόβεται ΠΕΡΙΣΣΟΤΕΡΟ από νότιο στο ίδιο β_fin (πλάγιος ήλιος)', () => {
    // East: n=+X, edges y=±0.75 → fin rect(-1,0.6,0.7,0.9) → d=0.6.
    const east = resolveWindowFinFactor({ ...eastBase, outlines: [rect(-1, 0.6, 0.7, 0.9)] });
    // South: az=180 → n=(0,−1), edges x=±0.75 → fin rect(0.7,0.9,-0.6,1) → d=0.6 (ίδιο β).
    const south = resolveWindowFinFactor({
      openingPos: { x: 0, y: 0 },
      azimuthDeg: 180,
      openingWidthMm: 1500,
      wallThicknessMm: 0,
      sceneToM: 1,
      outlines: [rect(0.7, 0.9, -0.6, 1)],
    });
    expect(east).toBeDefined();
    expect(south).toBeDefined();
    expect(east as number).toBeLessThan(south as number);
  });

  it('πάχος τοίχου μετατοπίζει το facade προς τα έξω (mm → scene units)', () => {
    // wallThickness 700mm → facade στο x=0.7· fin ακμή στο x=0.3 < 0.7 → d≈0 → undefined.
    const flush = rect(-1, 0.3, 0.7, 0.9);
    expect(
      resolveWindowFinFactor({ ...eastBase, wallThicknessMm: 700, outlines: [flush] }),
    ).toBeUndefined();
  });
});
