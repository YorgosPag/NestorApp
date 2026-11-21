/**
 * ADR-920 Β6.1 — test χαρακτηρισμού: η υψομετρική και η cut/fill κλίμακα του viewer δίνουν τα **ίδια** χρώματα
 * μετά τη μετακόμιση του αξιολογητή στο `@/lib/terrain/elevation-ramp`.
 *
 * Ο μάρτυρας είναι η **παλιά** υλοποίηση, αυτούσια: `THREE.Color.setHex` (sRGB → γραμμικό με το ColorManagement
 * ενεργό) και `lerp` στον γραμμικό χώρο. Αν ο πυρήνας παρεμβάλει σε sRGB, ή χάσει τη μετατροπή, κοκκινίζει εδώ.
 */

import * as THREE from 'three';

import { writeTerrainCutFillColor, writeTerrainRampColor } from '../terrain-elevation-ramp';

interface Stop {
  readonly t: number;
  readonly color: number;
}

const ELEVATION: readonly Stop[] = [
  { t: 0.0, color: 0x2f6b3c },
  { t: 0.28, color: 0x7fae53 },
  { t: 0.52, color: 0xd8cd7d },
  { t: 0.76, color: 0xa8744d },
  { t: 1.0, color: 0xf0ece4 },
];

const CUTFILL: readonly Stop[] = [
  { t: 0.0, color: 0x1d4e89 },
  { t: 0.3, color: 0x6ba3d6 },
  { t: 0.5, color: 0xf2efe6 },
  { t: 0.7, color: 0xe08a5c },
  { t: 1.0, color: 0x9e2b25 },
];

/** Η υλοποίηση πριν από το Β6.1, γραμμή προς γραμμή. */
function oracle(t: number, ramp: readonly Stop[]): [number, number, number] {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  let upperIndex = ramp.length - 1;
  for (let i = 1; i < ramp.length; i++) {
    if (clamped <= ramp[i]!.t) {
      upperIndex = i;
      break;
    }
  }
  const lower = ramp[upperIndex - 1]!;
  const upper = ramp[upperIndex]!;
  const span = upper.t - lower.t;
  const local = span > 0 ? (clamped - lower.t) / span : 0;
  const c = new THREE.Color().setHex(lower.color).lerp(new THREE.Color().setHex(upper.color), local);
  return [c.r, c.g, c.b];
}

const SAMPLES = [
  -0.5, 0, 0.01, 0.1, 0.27, 0.28, 0.29, 0.4, 0.5, 0.52, 0.6, 0.75, 0.76, 0.9, 0.99, 1, 1.5, Number.NaN,
  Number.POSITIVE_INFINITY,
];

function expectSame(write: (out: Float32Array, i: number, t: number) => void, ramp: readonly Stop[]): void {
  for (const t of SAMPLES) {
    const out = new Float32Array(6);
    write(out, 3, t);
    const [r, g, b] = oracle(t, ramp);
    expect([out[3], out[4], out[5]].map((v) => Number(v!.toFixed(5)))).toEqual(
      [Math.fround(r), Math.fround(g), Math.fround(b)].map((v) => Number(v.toFixed(5))),
    );
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 0]);
  }
}

describe('terrain elevation ramp — ίδια χρώματα πριν και μετά το Β6.1', () => {
  it('η υψομετρική κλίμακα ταυτίζεται με την παλιά υλοποίηση THREE.Color σε κάθε δείγμα', () => {
    expectSame(writeTerrainRampColor, ELEVATION);
  });

  it('η cut/fill κλίμακα ταυτίζεται με την παλιά υλοποίηση THREE.Color σε κάθε δείγμα', () => {
    expectSame(writeTerrainCutFillColor, CUTFILL);
  });
});
