/**
 * ADR-929 Φ1 — η ομογραφία ως SSoT: αντιστροφή, σύνθεση, τετράπλευρο → τετράπλευρο. Η ευθυγράμμιση κάτοψης στηρίζεται
 * εδώ για να γυρίζει κάθε εύρημα στα **αρχικά** pixel, άρα το λάθος εδώ μετατοπίζει τοίχους στη σκηνή.
 */

import { describe, expect, it } from '@jest/globals';

import {
  applyHomography,
  composeHomography,
  homographyFromAffine,
  IDENTITY_HOMOGRAPHY,
  invertHomography,
  quadToQuad,
  rectQuad,
  type Homography,
  type Quad,
} from '../homography';
import { applyAffine } from '../affine-2x3';

const PHOTO: Quad = [{ x: 103, y: 41 }, { x: 905, y: 88 }, { x: 951, y: 713 }, { x: 62, y: 690 }];

function seeded(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('homography', () => {
  it('quadToQuad στέλνει κάθε γωνία ακριβώς στον στόχο της', () => {
    const m = quadToQuad(rectQuad(800, 600), PHOTO);
    expect(m).not.toBeNull();
    if (m === null) return;
    rectQuad(800, 600).forEach((p, i) => {
      const q = applyHomography(m, p.x, p.y);
      expect(q.x).toBeCloseTo(PHOTO[i].x, 7);
      expect(q.y).toBeCloseTo(PHOTO[i].y, 7);
    });
  });

  it('invert ∘ m = ταυτότητα σε τυχαία σημεία (προοπτική με g, h ≠ 0)', () => {
    const m = quadToQuad(rectQuad(800, 600), PHOTO) as Homography;
    const inv = invertHomography(m);
    expect(inv).not.toBeNull();
    const rnd = seeded(3);
    for (let k = 0; k < 50; k++) {
      const p = { x: rnd() * 800, y: rnd() * 600 };
      const q = applyHomography(m, p.x, p.y);
      const back = applyHomography(inv as Homography, q.x, q.y);
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
  });

  it('compose(m2, m1) = πρώτα m1 μετά m2 (σύμβαση του composeAffine)', () => {
    const m1 = quadToQuad(rectQuad(10, 10), PHOTO) as Homography;
    const m2: Homography = { a: 2, b: 0, c: 5, d: 0, e: 3, f: -7, g: 0, h: 0 };
    const both = composeHomography(m2, m1) as Homography;
    const p = applyHomography(m1, 4, 6);
    const expected = applyHomography(m2, p.x, p.y);
    const got = applyHomography(both, 4, 6);
    expect(got.x).toBeCloseTo(expected.x, 7);
    expect(got.y).toBeCloseTo(expected.y, 7);
  });

  it('από αφινικό: ίδιο αποτέλεσμα με το applyAffine (σημασιολογία ctx.transform)', () => {
    const affine = { a: 0.8, b: 0.6, c: -0.6, d: 0.8, e: 12, f: -4 };
    const m = homographyFromAffine(affine);
    const p = applyHomography(m, 7, 3);
    const q = applyAffine(affine, { x: 7, y: 3 });
    expect(p.x).toBeCloseTo(q.x, 12);
    expect(p.y).toBeCloseTo(q.y, 12);
  });

  it('εκφυλισμός ⇒ null, ποτέ NaN', () => {
    const line: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    expect(quadToQuad(rectQuad(1, 1), line)).toBeNull();
    expect(invertHomography({ ...IDENTITY_HOMOGRAPHY, a: 0, b: 0 })).toBeNull();
  });
});
