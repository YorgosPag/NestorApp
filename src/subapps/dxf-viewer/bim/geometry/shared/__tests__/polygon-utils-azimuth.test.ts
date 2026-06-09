/**
 * ADR-422 L7.2 — tests για τους compass-azimuth helpers του `polygon-utils` (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Σύμβαση: 0°=+Y ("Βορράς"), clockwise προς +X ("Ανατολή"): +Y→0, +X→90,
 * −Y→180, −X→270. Το `nearestEdgeOutwardAzimuthDeg` βρίσκει το αζιμούθιο του
 * **εξωτερικού** normal (μακριά από το εσωτερικό του πολυγώνου, winding-based →
 * robust και για κοίλα) της ακμής που είναι πλησιέστερη σε ένα σημείο.
 */

import type { Point3D } from '../../../types/bim-base';
import {
  directionAzimuthDeg,
  nearestEdgeOutwardAzimuthDeg,
} from '../polygon-azimuth-utils';

/** CCW μοναδιαίο τετράγωνο [0,4]² — εσωτερικό στο κέντρο (2,2). */
const SQUARE_CCW: readonly Point3D[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

describe('directionAzimuthDeg (0°=+Y, clockwise)', () => {
  it('αντιστοιχίζει τους κύριους άξονες', () => {
    expect(directionAzimuthDeg(0, 1)).toBeCloseTo(0); // +Y → Βορράς
    expect(directionAzimuthDeg(1, 0)).toBeCloseTo(90); // +X → Ανατολή
    expect(directionAzimuthDeg(0, -1)).toBeCloseTo(180); // −Y → Νότος
    expect(directionAzimuthDeg(-1, 0)).toBeCloseTo(270); // −X → Δύση
  });

  it('αντιστοιχίζει τις διαγωνίους (45° βήματα)', () => {
    expect(directionAzimuthDeg(1, 1)).toBeCloseTo(45); // ΒΑ
    expect(directionAzimuthDeg(1, -1)).toBeCloseTo(135); // ΝΑ
    expect(directionAzimuthDeg(-1, -1)).toBeCloseTo(225); // ΝΔ
    expect(directionAzimuthDeg(-1, 1)).toBeCloseTo(315); // ΒΔ
  });

  it('επιστρέφει [0,360) (κανονικοποίηση) και null για μηδενικό διάνυσμα', () => {
    const az = directionAzimuthDeg(-1, 0.0001);
    expect(az).toBeGreaterThanOrEqual(0);
    expect(az).toBeLessThan(360);
    expect(directionAzimuthDeg(0, 0)).toBeNull();
  });
});

describe('nearestEdgeOutwardAzimuthDeg (CCW τετράγωνο)', () => {
  it('νότια ακμή → 180 (το normal δείχνει μακριά από το εσωτερικό)', () => {
    expect(nearestEdgeOutwardAzimuthDeg(SQUARE_CCW, { x: 2, y: 0 })).toBeCloseTo(180);
  });

  it('ανατολική ακμή → 90', () => {
    expect(nearestEdgeOutwardAzimuthDeg(SQUARE_CCW, { x: 4, y: 2 })).toBeCloseTo(90);
  });

  it('βόρεια ακμή → 0· δυτική ακμή → 270', () => {
    expect(nearestEdgeOutwardAzimuthDeg(SQUARE_CCW, { x: 2, y: 4 })).toBeCloseTo(0);
    expect(nearestEdgeOutwardAzimuthDeg(SQUARE_CCW, { x: 0, y: 2 })).toBeCloseTo(270);
  });

  it('είναι ανεξάρτητο της φοράς (CW πολύγωνο → ίδιο εξωτερικό αζιμούθιο)', () => {
    const cw = [...SQUARE_CCW].reverse();
    expect(nearestEdgeOutwardAzimuthDeg(cw, { x: 2, y: 0 })).toBeCloseTo(180);
    expect(nearestEdgeOutwardAzimuthDeg(cw, { x: 4, y: 2 })).toBeCloseTo(90);
  });

  it('επιστρέφει null για εκφυλισμένο πολύγωνο (<3 κορυφές)', () => {
    expect(nearestEdgeOutwardAzimuthDeg([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0 })).toBeNull();
  });
});
