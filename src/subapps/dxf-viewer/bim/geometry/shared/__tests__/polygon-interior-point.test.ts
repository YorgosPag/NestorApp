/**
 * `interiorAnchorPoint` — αντιπροσωπευτικό εσωτερικό σημείο (ADR-363/449 rotation anchor).
 * Κρίσιμο για κοίλα σχήματα (Γ/Τ/Π): το bbox-κέντρο πέφτει στο κενό· το σημείο πρέπει να είναι
 * ΜΕΣΑ στο υλικό.
 */

import { interiorAnchorPoint } from '../polygon-interior-point';
import { pointInPolygon } from '../polygon-utils';

const toPoly3 = (v: { x: number; y: number }[]) => v.map((p) => ({ x: p.x, y: p.y, z: 0 }));

describe('interiorAnchorPoint', () => {
  it('τετράγωνο → σημείο μέσα (≈ κέντρο)', () => {
    const sq = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const p = interiorAnchorPoint(sq);
    expect(pointInPolygon(p, toPoly3(sq))).toBe(true);
  });

  it('Γ (L-shape, κοίλο) → σημείο ΜΕΣΑ στο υλικό, ΟΧΙ στην εγκοπή (bbox-κέντρο)', () => {
    // L με bbox 400×400, εγκοπή στο πάνω-δεξιά τεταρτημόριο.
    const L = [
      { x: -200, y: -200 }, { x: 200, y: -200 }, { x: 200, y: -67 },
      { x: -67, y: -67 }, { x: -67, y: 200 }, { x: -200, y: 200 },
    ];
    const p = interiorAnchorPoint(L);
    // Είναι μέσα στο πολύγωνο…
    expect(pointInPolygon(p, toPoly3(L))).toBe(true);
    // …και ΟΧΙ το bbox-κέντρο (0,0), που εδώ είναι στην εγκοπή (κενό).
    expect(pointInPolygon({ x: 0, y: 0 }, toPoly3(L))).toBe(false);
    expect(Math.hypot(p.x, p.y)).toBeGreaterThan(1);
  });

  it('< 3 κορυφές → centroid (no-op)', () => {
    const p = interiorAnchorPoint([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(p).toEqual({ x: 5, y: 0 });
  });
});
