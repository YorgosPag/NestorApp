/**
 * @fileoverview **ΤΟ ΘΟΛΩΜΑ ΠΑΝΩ ΣΤΟ EQUIRECT** (ADR-884 Φ2ζ · §4.15) — η κλειστή μορφή ανά γραμμή απέναντι στην ωμή σάρωση.
 *
 * - **Ω** — ωμή ισοδυναμία: για κάθε περιοχή, τα pixel που επισκέπτεται = ακριβώς όσα έχουν βάρος > 0 σε σάρωση ΟΛΗΣ της εικόνας.
 * - **Ρ** — ραφή ±π: η περιοχή πάνω στη ραφή πιάνει και τις δύο άκρες, κανένα pixel δύο φορές.
 * - **Π** — πόλος: περιοχή που τον καλύπτει πιάνει ολόκληρες γραμμές.
 * - **Β** — βάρος: πλήρες μέσα στην ακτίνα, ομαλό **έξω** από αυτήν, ποτέ λιγότερο από τη δηλωμένη.
 * - **Α** — ανάμειξη: βάρος 1 ⇒ το θολωμένο pixel· έξω ⇒ ανέπαφο.
 */

import type { TourRedactionRegion } from '@/types/spatial-tour';

import {
  applyRedactions,
  forEachRedactedPixel,
  redactionAlpha,
  redactionProxyWidth,
  TOUR_REDACTION_FEATHER,
} from '../tour-redaction-mask';

const W = 96;
const H = 48;

/** Η ίδια σύμβαση με τον θεατή/ψήστη: κέντρο pixel ⇒ yaw/pitch. */
const yawOf = (x: number) => ((x + 0.5) / W - 0.5) * 2 * Math.PI;
const pitchOf = (y: number) => (0.5 - (y + 0.5) / H) * Math.PI;

function bruteForce(region: TourRedactionRegion): Map<number, number> {
  const out = new Map<number, number>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [yaw, pitch] = [yawOf(x), pitchOf(y)];
      const cos = Math.sin(pitch) * Math.sin(region.pitchRad) + Math.cos(pitch) * Math.cos(region.pitchRad) * Math.cos(yaw - region.yawRad);
      const alpha = redactionAlpha(Math.acos(Math.min(1, Math.max(-1, cos))), region.radiusRad);
      if (alpha > 0) out.set(y * W + x, alpha);
    }
  }
  return out;
}

function visited(region: TourRedactionRegion): { readonly map: Map<number, number>; readonly visits: number } {
  const map = new Map<number, number>();
  let visits = 0;
  forEachRedactedPixel(W, H, region, (pixel, alpha) => {
    map.set(pixel, alpha);
    visits++;
  });
  return { map, visits };
}

const REGIONS: readonly TourRedactionRegion[] = [
  { yawRad: 0, pitchRad: 0, radiusRad: 0.3 },
  { yawRad: 1.2, pitchRad: 0.5, radiusRad: 0.2 },
  { yawRad: -2.4, pitchRad: -0.9, radiusRad: 0.35 },
  { yawRad: Math.PI, pitchRad: 0.1, radiusRad: 0.25 },
  { yawRad: 0.7, pitchRad: 1.45, radiusRad: 0.3 },
  { yawRad: -0.3, pitchRad: -1.5, radiusRad: 0.15 },
  // Μεγάλη ακτίνα: η ομαλή άκρη (0,2·r ≈ 9°) πιάνει ≥ 2 γραμμές ⇒ φαίνεται αν η ζώνη ξεχάσει την άκρη.
  { yawRad: 0.2, pitchRad: 0.2, radiusRad: 0.75 },
];

describe('Ω — ωμή ισοδυναμία', () => {
  it.each(REGIONS.map((r) => [r]))('%o: ίδια pixel, ίδια βάρη με τη σάρωση όλης της εικόνας', (region) => {
    const expected = bruteForce(region);
    const { map, visits } = visited(region);
    expect(expected.size).toBeGreaterThan(0);
    expect(visits).toBe(map.size);
    expect([...map.keys()].sort((a, b) => a - b)).toEqual([...expected.keys()].sort((a, b) => a - b));
    for (const [pixel, alpha] of expected) expect(map.get(pixel)).toBeCloseTo(alpha, 12);
  });

  it.each(REGIONS.map((r) => [r]))('%o: κάθε pixel ΜΕΣΑ στη δηλωμένη ακτίνα έχει βάρος ΑΚΡΙΒΩΣ 1 (ανεξάρτητο κριτήριο)', (region) => {
    const { map } = visited(region);
    let inside = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [yaw, pitch] = [yawOf(x), pitchOf(y)];
        const [a, b] = [[Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)], [Math.cos(region.pitchRad) * Math.sin(region.yawRad), Math.sin(region.pitchRad), Math.cos(region.pitchRad) * Math.cos(region.yawRad)]];
        const d = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
        if (d < region.radiusRad - 1e-9) { inside++; expect(map.get(y * W + x)).toBe(1); }
      }
    }
    expect(inside).toBeGreaterThan(0);
  });
});

describe('Ρ — ραφή ±π', () => {
  it('περιοχή πάνω στη ραφή πιάνει και την πρώτη και την τελευταία στήλη', () => {
    const { map } = visited({ yawRad: Math.PI, pitchRad: 0, radiusRad: 0.2 });
    const columns = new Set([...map.keys()].map((pixel) => pixel % W));
    expect(columns.has(0)).toBe(true);
    expect(columns.has(W - 1)).toBe(true);
    expect(columns.has(W / 2)).toBe(false);
  });
});

describe('Π — πόλος', () => {
  it('περιοχή που καλύπτει τον βόρειο πόλο πιάνει ΟΛΗ την πρώτη γραμμή', () => {
    const { map } = visited({ yawRad: 0.4, pitchRad: Math.PI / 2 - 0.05, radiusRad: 0.2 });
    for (let x = 0; x < W; x++) expect(map.get(x)).toBe(1);
  });
});

describe('Β — βάρος', () => {
  it('πλήρες μέσα στην ακτίνα, ομαλό ως την εξωτερική άκρη, μηδέν πέρα', () => {
    const r = 0.3;
    expect(redactionAlpha(0, r)).toBe(1);
    expect(redactionAlpha(r, r)).toBe(1);
    expect(redactionAlpha(r * (1 + TOUR_REDACTION_FEATHER / 2), r)).toBeCloseTo(0.5, 12);
    expect(redactionAlpha(r * (1 + TOUR_REDACTION_FEATHER), r)).toBe(0);
    expect(redactionAlpha(r * 2, r)).toBe(0);
  });

  it('το σμικρυμένο αντίγραφο έχει ≥ 8 κελιά και μικραίνει με την εικόνα', () => {
    expect(redactionProxyWidth(8192)).toBe(171);
    expect(redactionProxyWidth(100)).toBe(8);
  });
});

describe('Α — ανάμειξη', () => {
  it('μέσα ⇒ το θολωμένο· έξω ⇒ ανέπαφο· επιστρέφει πόσα άγγιξε', () => {
    const channels = 3;
    const target = new Uint8Array(W * H * channels).fill(200);
    const blurred = new Uint8Array(W * H * channels).fill(40);
    const region = { yawRad: 0, pitchRad: 0, radiusRad: 0.3 };
    const touched = applyRedactions(target, blurred, { width: W, height: H, channels }, [region]);
    expect(touched).toBe(bruteForce(region).size);
    const centre = (H / 2) * W + W / 2;
    expect(Array.from(target.subarray(centre * channels, centre * channels + channels))).toEqual([40, 40, 40]);
    expect(Array.from(target.subarray(0, channels))).toEqual([200, 200, 200]);
  });

  it('στην ομαλή άκρη ⇒ ενδιάμεση τιμή ανάλογη του βάρους', () => {
    const channels = 3;
    const region = { yawRad: 0, pitchRad: 0, radiusRad: 0.75 };
    const feather: Array<[number, number]> = [];
    forEachRedactedPixel(W, H, region, (pixel, alpha) => { if (alpha > 0.2 && alpha < 0.8) feather.push([pixel, alpha]); });
    expect(feather.length).toBeGreaterThan(0);
    const target = new Uint8Array(W * H * channels).fill(200);
    applyRedactions(target, new Uint8Array(W * H * channels).fill(40), { width: W, height: H, channels }, [region]);
    for (const [pixel, alpha] of feather) expect(target[pixel * channels]).toBe(Math.round(200 + (40 - 200) * alpha));
  });

  it('χωρίς περιοχές ⇒ τίποτα', () => {
    const target = new Uint8Array(W * H * 3).fill(7);
    expect(applyRedactions(target, new Uint8Array(W * H * 3), { width: W, height: H, channels: 3 }, [])).toBe(0);
    expect(target.every((value) => value === 7)).toBe(true);
  });
});
