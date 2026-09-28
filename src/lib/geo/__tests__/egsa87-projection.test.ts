/**
 * ADR-656 M12 — ΕΓΣΑ87 projection + meridian convergence tests.
 *
 * Validated via self-consistent invariants (no external control-point table needed):
 *  - forward↔inverse round-trip to sub-millimetre / sub-µdegree,
 *  - E = 500 000 exactly on the central meridian (λ = 24°),
 *  - convergence γ = 0 on the central meridian, positive to the east, ~Δλ·sinφ in magnitude.
 */

import {
  geographicToGrid,
  gridToGeographic,
  meridianConvergenceDeg,
} from '../egsa87-projection';

describe('ΕΓΣΑ87 forward projection (geographicToGrid)', () => {
  it('places the central meridian (λ=24°) exactly at E = 500 000', () => {
    for (const lat of [35, 38, 41]) {
      expect(geographicToGrid(lat, 24).E).toBeCloseTo(500_000, 3);
    }
  });
});

describe('ΕΓΣΑ87 round-trip (forward → inverse ≈ identity)', () => {
  // A spread of realistic Greek points (Crete → Macedonia, west → east).
  const samples = [
    { lat: 35.34, lon: 25.14 }, // Heraklion
    { lat: 37.98, lon: 23.73 }, // Athens
    { lat: 40.64, lon: 22.94 }, // Thessaloniki
    { lat: 39.07, lon: 26.55 }, // Lesvos (far east)
    { lat: 39.62, lon: 19.92 }, // Corfu (far west)
  ];

  it('recovers the input latitude/longitude to < 1e-6°', () => {
    for (const s of samples) {
      const { E, N } = geographicToGrid(s.lat, s.lon);
      const back = gridToGeographic(E, N);
      expect(back.lat).toBeCloseTo(s.lat, 6);
      expect(back.lon).toBeCloseTo(s.lon, 6);
    }
  });
});

describe('meridian convergence γ', () => {
  it('is zero on the central meridian (any northing)', () => {
    for (const lat of [35, 38, 41]) {
      const { E, N } = geographicToGrid(lat, 24);
      expect(meridianConvergenceDeg(E, N)).toBeCloseTo(0, 6);
    }
  });

  it('is positive east of the central meridian, negative west', () => {
    const east = geographicToGrid(38, 26);
    const west = geographicToGrid(38, 22);
    expect(meridianConvergenceDeg(east.E, east.N)).toBeGreaterThan(0);
    expect(meridianConvergenceDeg(west.E, west.N)).toBeLessThan(0);
  });

  it('matches ~Δλ·sinφ in magnitude (2° east at φ=38° → ~1.23°)', () => {
    const { E, N } = geographicToGrid(38, 26);
    const expected = 2 * Math.sin(38 * Math.PI / 180); // ≈ 1.2314°
    expect(meridianConvergenceDeg(E, N)).toBeCloseTo(expected, 2);
  });
});
