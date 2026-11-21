/**
 * ADR-920 Β6.1 — η μία υψομετρική κλίμακα: το hex της κάτοψης είναι το **ίδιο** χρώμα με το 3Δ.
 */

import { linearToSrgbUnit } from '@/lib/color/srgb-transfer';

import {
  TERRAIN_ELEVATION_RAMP,
  terrainElevationHex,
  writeTerrainElevationColor,
} from '../elevation-ramp';

const hexOf = (color: number): string => `#${color.toString(16).padStart(6, '0').toUpperCase()}`;

describe('terrainElevationHex', () => {
  it('κάθε στάση δίνει ακριβώς το δικό της χρώμα (sRGB → γραμμικό → sRGB χωρίς απώλεια)', () => {
    for (const stop of TERRAIN_ELEVATION_RAMP) {
      expect(terrainElevationHex(stop.t)).toBe(hexOf(stop.color));
    }
  });

  it('εκτός εύρους περιορίζεται· μη πεπερασμένο = τόνος κοιλάδας', () => {
    expect(terrainElevationHex(-3)).toBe(hexOf(0x2f6b3c));
    expect(terrainElevationHex(7)).toBe(hexOf(0xf0ece4));
    expect(terrainElevationHex(Number.NaN)).toBe(hexOf(0x2f6b3c));
  });

  it('το hex είναι το γραμμικό χρώμα του 3Δ, κωδικοποιημένο σε sRGB (όχι δεύτερη παρεμβολή σε sRGB)', () => {
    for (const t of [0.1, 0.4, 0.64, 0.9]) {
      const linear = [0, 0, 0];
      writeTerrainElevationColor(linear, 0, t);
      const expected = linear.map((v) => Math.round(linearToSrgbUnit(v) * 255));
      const hex = terrainElevationHex(t);
      const actual = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
      expect(actual).toEqual(expected);
    }
  });

  it('η παρεμβολή γίνεται σε γραμμικό χώρο: το μέσο δύο στάσεων είναι φωτεινότερο από το μέσο τους σε sRGB', () => {
    // Μέσο πράσινου (0x2f6b3c) και χορταριού (0x7fae53): σε γραμμικό χώρο κάθε κανάλι βγαίνει ≥ του sRGB μέσου.
    const hex = terrainElevationHex(0.14);
    const actual = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const srgbMid = [(0x2f + 0x7f) / 2, (0x6b + 0xae) / 2, (0x3c + 0x53) / 2];
    actual.forEach((channel, k) => expect(channel).toBeGreaterThanOrEqual(Math.floor(srgbMid[k]!)));
    expect(actual.some((channel, k) => channel > Math.ceil(srgbMid[k]!))).toBe(true);
  });
});
