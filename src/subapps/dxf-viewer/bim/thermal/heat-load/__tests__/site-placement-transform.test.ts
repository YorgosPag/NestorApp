/**
 * ADR-369 — tests για το multi-building site placement transform (pure). jest globals
 * (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει: identity (defaults ⇒ zero-regression), καθαρή μετατόπιση (siteOrigin),
 * unit conversion (mm-building → m-building), περιστροφή (CCW), round-trip A→B→A, και
 * διατήρηση winding πολυγώνου.
 */

import {
  transformPointToActiveFrame,
  transformPolygonToActiveFrame,
  type BuildingPlacement,
} from '../site-placement-transform';

const M_SCENE: BuildingPlacement = { sceneToM: 1 };

describe('transformPointToActiveFrame', () => {
  it('defaults (μηδέν placement, ίδια κλίμακα) → identity (zero-regression)', () => {
    const p = transformPointToActiveFrame({ x: 3, y: -4 }, M_SCENE, M_SCENE);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(-4);
  });

  it('καθαρή μετατόπιση: source siteOrigin {10,5} m → +{10,5} στο ενεργό frame', () => {
    const source: BuildingPlacement = { sceneToM: 1, siteOrigin: { x: 10, y: 5 } };
    const p = transformPointToActiveFrame({ x: 0, y: 0 }, source, M_SCENE);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(5);
  });

  it('unit conversion: source mm-scene (1000mm) → 1 μονάδα σε m-scene ενεργό', () => {
    const source: BuildingPlacement = { sceneToM: 0.001 }; // mm scene
    const p = transformPointToActiveFrame({ x: 1000, y: 2000 }, source, M_SCENE);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(2);
  });

  it('περιστροφή source 90° CCW: {1,0} → {0,1}', () => {
    const source: BuildingPlacement = { sceneToM: 1, rotationDeg: 90 };
    const p = transformPointToActiveFrame({ x: 1, y: 0 }, source, M_SCENE);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('round-trip A→B→A επιστρέφει το αρχικό (rotation + offset + units)', () => {
    const a: BuildingPlacement = { sceneToM: 0.001, siteOrigin: { x: -3, y: 7 }, rotationDeg: 35 };
    const b: BuildingPlacement = { sceneToM: 1, siteOrigin: { x: 12, y: -2 }, rotationDeg: -20 };
    const orig = { x: 4200, y: -1500 };
    const inB = transformPointToActiveFrame(orig, a, b);
    const back = transformPointToActiveFrame(inB, b, a);
    expect(back.x).toBeCloseTo(orig.x, 3);
    expect(back.y).toBeCloseTo(orig.y, 3);
  });
});

describe('transformPolygonToActiveFrame', () => {
  it('διατηρεί τον αριθμό κορυφών & τη σειρά (winding)', () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const out = transformPolygonToActiveFrame(poly, { sceneToM: 1, siteOrigin: { x: 5, y: 5 } }, M_SCENE);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({ x: 5, y: 5 });
    expect(out[2].x).toBeCloseTo(7);
    expect(out[2].y).toBeCloseTo(7);
  });
});
