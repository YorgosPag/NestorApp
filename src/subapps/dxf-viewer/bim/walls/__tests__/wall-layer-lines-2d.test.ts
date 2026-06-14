/**
 * ADR-413/447 · ADR-449 — wall per-layer boundary lines (2D plan) pure SSoT test.
 */

import { wallLayerBoundaryPolylines } from '../wall-layer-lines-2d';
import type { Point3D } from '../../types/bim-base';

const pt = (x: number, y: number): Point3D => ({ x, y, z: 0 });

// Straight wall κατά μήκος X, πάχος 1 (outer@y=0, inner@y=1).
const OUTER: Point3D[] = [pt(0, 0), pt(10, 0)];
const INNER: Point3D[] = [pt(0, 1), pt(10, 1)];

describe('wallLayerBoundaryPolylines', () => {
  it('3 στρώσεις (σοβάς|πυρήνας|σοβάς) → 2 εσωτερικές γραμμές στα σωστά βάθη', () => {
    const dna = { layers: [{ thickness: 0.25 }, { thickness: 0.5 }, { thickness: 0.25 }], totalThickness: 1 };
    const lines = wallLayerBoundaryPolylines(OUTER, INNER, dna);
    expect(lines).toHaveLength(2);
    // f1 = 0.25 → y=0.25· f2 = 0.75 → y=0.75 (παράλληλες στις παρειές, σε όλο το μήκος).
    expect(lines[0]).toEqual([pt(0, 0.25), pt(10, 0.25)]);
    expect(lines[1]).toEqual([pt(0, 0.75), pt(10, 0.75)]);
  });

  it('μονόστρωτος τοίχος → καμία εσωτερική γραμμή', () => {
    const dna = { layers: [{ thickness: 1 }], totalThickness: 1 };
    expect(wallLayerBoundaryPolylines(OUTER, INNER, dna)).toEqual([]);
  });

  it('σύνορο πάνω σε παρειά (μηδενική στρώση στην άκρη) → δεν διπλο-ζωγραφίζεται', () => {
    const dna = { layers: [{ thickness: 0 }, { thickness: 1 }], totalThickness: 1 };
    // fractions [0, 0, 1] → το εσωτερικό f=0 πέφτει στην outer παρειά → skip.
    expect(wallLayerBoundaryPolylines(OUTER, INNER, dna)).toEqual([]);
  });

  it('εκφυλισμένη παρειά (1 κορυφή) → []', () => {
    const dna = { layers: [{ thickness: 0.5 }, { thickness: 0.5 }], totalThickness: 1 };
    expect(wallLayerBoundaryPolylines([pt(0, 0)], INNER, dna)).toEqual([]);
  });

  it('πραγματικός εξωτ. τοίχος 25|210|15 (mm, total 250) → 2 γραμμές, ασύμμετρα βάθη', () => {
    const dna = {
      layers: [{ thickness: 25 }, { thickness: 210 }, { thickness: 15 }],
      totalThickness: 250,
    };
    const outer: Point3D[] = [pt(0, 0), pt(3.298, 0)];
    const inner: Point3D[] = [pt(0, 0.25), pt(3.298, 0.25)]; // 250mm = 0.25 canvas units
    const lines = wallLayerBoundaryPolylines(outer, inner, dna);
    expect(lines).toHaveLength(2);
    // 25/250=0.1 → y=0.025· 235/250=0.94 → y=0.235.
    expect(lines[0][0].y).toBeCloseTo(0.025, 6);
    expect(lines[1][0].y).toBeCloseTo(0.235, 6);
  });
});
