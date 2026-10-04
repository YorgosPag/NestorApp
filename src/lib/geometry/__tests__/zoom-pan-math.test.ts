/**
 * ADR-884 Φ2στ-γ Γ2 · ADR-187 — τα μαθηματικά του ζουμ, ΕΝΑ σπίτι για `useZoomPan` (CSS transform) και κάτοψη (`viewBox`).
 */

import {
  clampZoom, confinePan, midpoint, pointDistance, quarterTurnExtent, scaleAbout, stepZoom, unitToZoom, viewTransformOf,
  wheelZoom, zoomToUnit,
} from '../zoom-pan-math';

const LIMITS = { min: 1, max: 5 };

describe('zoom-pan-math', () => {
  it('clampZoom — μέσα στα όρια', () => {
    expect(clampZoom(0.2, LIMITS)).toBe(1);
    expect(clampZoom(9, LIMITS)).toBe(5);
    expect(clampZoom(2.5, LIMITS)).toBe(2.5);
  });

  it('stepZoom — πολλαπλασιαστικό με factor, προσθετικό αλλιώς, πάντα κομμένο', () => {
    expect(stepZoom(2, LIMITS, 1, { factor: 1.5 })).toBe(3);
    expect(stepZoom(3, LIMITS, -1, { factor: 1.5 })).toBe(2);
    expect(stepZoom(4, LIMITS, 1, { factor: 1.5 })).toBe(5);
    expect(stepZoom(2, LIMITS, 1, { step: 0.25 })).toBe(2.25);
    expect(stepZoom(1, LIMITS, -1, { step: 0.25 })).toBe(1);
  });

  it('scaleAbout — η άγκυρα μένει ακίνητη, τα υπόλοιπα κλιμακώνονται ως προς αυτήν', () => {
    expect(scaleAbout({ x: 10, y: 10 }, { x: 10, y: 10 }, 3)).toEqual({ x: 10, y: 10 });
    expect(scaleAbout({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
    // ο τύπος του παλιού χειριστή τροχού: mouse·(1−r) + pan·r
    const mouse = { x: 40, y: -30 };
    const pan = { x: 7, y: 3 };
    const r = 1.2;
    expect(scaleAbout(pan, mouse, r).x).toBeCloseTo(mouse.x * (1 - r) + pan.x * r);
    expect(scaleAbout(pan, mouse, r).y).toBeCloseTo(mouse.y * (1 - r) + pan.y * r);
  });

  it('wheelZoom — τροχός προς τα πάνω (deltaY < 0) μεγεθύνει, πολλαπλασιαστικά', () => {
    expect(wheelZoom(2, -100, 0.001, LIMITS)).toBeCloseTo(2.2);
    expect(wheelZoom(2, 100, 0.001, LIMITS)).toBeCloseTo(1.8);
    expect(wheelZoom(1, 100, 0.01, LIMITS)).toBe(1);
  });

  it('λογαριθμική ράγα — άκρα, μέση = γεωμετρικός μέσος, αντιστρεψιμότητα', () => {
    expect(zoomToUnit(1, LIMITS)).toBe(0);
    expect(zoomToUnit(5, LIMITS)).toBeCloseTo(1);
    expect(unitToZoom(0.5, LIMITS)).toBeCloseTo(Math.sqrt(5));
    for (const z of [1, 1.3, 2, 3.7, 5]) expect(unitToZoom(zoomToUnit(z, LIMITS), LIMITS)).toBeCloseTo(z);
    expect(unitToZoom(-1, LIMITS)).toBe(1);
    expect(unitToZoom(2, LIMITS)).toBeCloseTo(5);
    expect(zoomToUnit(3, { min: 2, max: 2 })).toBe(0);
  });

  it('pointDistance — Ευκλείδεια', () => {
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  // ADR-899 §9 θέμα 3 — ό,τι χρειάστηκε για να γίνει το `useZoomPan` ο ΕΝΑΣ θεατής εικόνας
  it('🔴 confinePan — όσο χωρά, ακριβώς 0· αλλιώς η άκρη δεν μπαίνει στο κουτί', () => {
    const box = { width: 400, height: 300 };
    expect(confinePan({ x: 50, y: -20 }, { width: 400, height: 300 }, box)).toEqual({ x: 0, y: 0 });
    expect(confinePan({ x: -50, y: 20 }, { width: 200, height: 100 }, box)).toEqual({ x: 0, y: 0 });
    // 800×300 σε 400×300 ⇒ περιθώριο x = 200, y = 0
    expect(confinePan({ x: 500, y: 40 }, { width: 800, height: 300 }, box)).toEqual({ x: 200, y: 0 });
    expect(confinePan({ x: -120, y: 0 }, { width: 800, height: 300 }, box)).toEqual({ x: -120, y: 0 });
  });

  it('midpoint · quarterTurnExtent · viewTransformOf', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 60, y: 80 })).toEqual({ x: 30, y: 40 });
    const e = { width: 4, height: 3 };
    expect(quarterTurnExtent(e, 0)).toEqual(e);
    expect(quarterTurnExtent(e, 90)).toEqual({ width: 3, height: 4 });
    expect(quarterTurnExtent(e, 180)).toEqual(e);
    expect(quarterTurnExtent(e, 270)).toEqual({ width: 3, height: 4 });
    expect(quarterTurnExtent(e, -90)).toEqual({ width: 3, height: 4 });
    expect(viewTransformOf({ pan: { x: 5, y: -2 }, scale: 1.5, rotation: 90 }))
      .toBe('translate(5px, -2px) scale(1.5) rotate(90deg)');
  });
});
