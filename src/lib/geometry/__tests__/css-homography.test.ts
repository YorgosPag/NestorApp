/**
 * ADR-884 Φ2στ-γ (§4.14) — τετράγωνο → τετράπλευρο. Η ομογραφία ΟΦΕΙΛΕΙ να πάει κάθε γωνία ακριβώς στον στόχο της· αλλιώς
 * το βελάκι του πατώματος «γλιστρά» έξω από το σημείο όπου η κάμερα το βλέπει.
 */

import { applyHomography, quadToMatrix3d, unitSquareToQuad, type Quad } from '../css-homography';

const UNIT_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;

function expectCorners(quad: Quad): void {
  const m = unitSquareToQuad(quad);
  expect(m).not.toBeNull();
  if (m === null) return;
  UNIT_CORNERS.forEach(([u, v], i) => {
    const p = applyHomography(m, u, v);
    expect(p.x).toBeCloseTo(quad[i]?.x ?? NaN, 9);
    expect(p.y).toBeCloseTo(quad[i]?.y ?? NaN, 9);
  });
}

/** Εφαρμογή της `matrix3d(...)` σε σημείο του στοιχείου, όπως το κάνει ο browser (στήλες, διαίρεση με w). */
function applyMatrix3d(css: string, x: number, y: number): { x: number; y: number } {
  const v = css.slice('matrix3d('.length, -1).split(',').map(Number);
  const at = (i: number) => v[i] ?? NaN;
  const w = at(3) * x + at(7) * y + at(15);
  return { x: (at(0) * x + at(4) * y + at(12)) / w, y: (at(1) * x + at(5) * y + at(13)) / w };
}

describe('unitSquareToQuad — κάθε γωνία στον στόχο της', () => {
  it('παραλληλόγραμμο (αφινικό — χωρίς προοπτική)', () => {
    expectCorners([{ x: 10, y: 20 }, { x: 110, y: 30 }, { x: 120, y: 90 }, { x: 20, y: 80 }]);
  });

  it('τραπέζιο με προοπτική (το μακρινό άκρο πιο στενό — όπως ένας δίσκος στο πάτωμα)', () => {
    expectCorners([{ x: 140, y: 100 }, { x: 260, y: 100 }, { x: 330, y: 180 }, { x: 70, y: 180 }]);
  });

  it('εκφυλισμένο (όλες οι γωνίες σε μία ευθεία) ⇒ null, ποτέ NaN', () => {
    expect(unitSquareToQuad([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }])).toBeNull();
  });
});

describe('quadToMatrix3d — ό,τι θα κάνει ο browser', () => {
  const quad: Quad = [{ x: 140, y: 100 }, { x: 260, y: 100 }, { x: 330, y: 180 }, { x: 70, y: 180 }];

  it('οι γωνίες του στοιχείου 100×100 πέφτουν ακριβώς στο τετράπλευρο', () => {
    const css = quadToMatrix3d(quad, 100);
    expect(css).not.toBeNull();
    if (css === null) return;
    [[0, 0], [100, 0], [100, 100], [0, 100]].forEach(([x, y], i) => {
      const p = applyMatrix3d(css, x ?? NaN, y ?? NaN);
      expect(p.x).toBeCloseTo(quad[i]?.x ?? NaN, 5);
      expect(p.y).toBeCloseTo(quad[i]?.y ?? NaN, 5);
    });
  });

  it('μηδενικό μέγεθος στοιχείου ⇒ null', () => {
    expect(quadToMatrix3d(quad, 0)).toBeNull();
  });
});
