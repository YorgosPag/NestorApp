/**
 * ADR-531 Φ5b.1+ — tests για τη γεωμετρία τοίχου-με-κομμένα-ανοίγματα + σύμβολο παραθύρου.
 */

import {
  openingAxisInterval, buildWallCutoutSegments, buildWindowSymbolSegments,
} from '../tek-window-symbol';
import type { TekXMatrix, TekOpeningRecord } from '../tek-import-types';

const mat = (x00: number, x11: number, x20: number, x21: number): TekXMatrix =>
  ({ x00, x01: 0, x10: 0, x11, x20, x21 });

const opening = (x00: number, x20: number): TekOpeningRecord => ({
  matrix: mat(x00, -1, x20, 0.73),
  elevationM: 1, topM: 2.2, style: 1, side: 3,
  frameWidthM: 0.15, frameThicknessM: 0.03, jambWidthM: 0.05, jambThicknessM: 0.05,
  ledgeHeightM: 0.03, color: '50A490',
});

const WALL = mat(5.03, 0.25, -8.25, 0.58);
const OP1 = opening(1.4, -7.86);
const OP2 = opening(-1.4, -4.16);

describe('openingAxisInterval (ADR-531)', () => {
  it('προβάλλει το άνοιγμα σε [tmin,tmax] κατά μήκος του άξονα', () => {
    const [tmin, tmax] = openingAxisInterval(OP1, WALL);
    expect(tmin).toBeCloseTo(0.0775, 2);
    expect(tmax).toBeCloseTo(0.356, 2);
    expect(tmin).toBeLessThan(tmax);
  });
});

describe('buildWallCutoutSegments (ADR-531)', () => {
  it('χωρίς ανοίγματα → κλειστό ορθογώνιο (4 γραμμές)', () => {
    expect(buildWallCutoutSegments(WALL, [])).toHaveLength(4);
  });

  it('με 2 ανοίγματα → σπασμένες παρειές (3+3) + 2 caps + 4 jamb returns = 12', () => {
    const segs = buildWallCutoutSegments(WALL, [OP1, OP2]);
    expect(segs).toHaveLength(12);
  });

  it('καμία παρειά δεν διασχίζει ολόκληρο το άνοιγμα (πραγματικό κενό)', () => {
    const segs = buildWallCutoutSegments(WALL, [OP1]);
    // Το near edge (y≈0.58) σπάει: κανένα τμήμα δεν εκτείνεται x από -8.25 ώς -3.22 αδιάσπαστα.
    const fullSpan = segs.some((s) =>
      Math.abs(s.a.x - WALL.x20) < 0.01 && Math.abs(s.b.x - (WALL.x20 + WALL.x00)) < 0.01);
    expect(fullSpan).toBe(false);
  });
});

describe('buildWindowSymbolSegments (ADR-531 Φ5b.1++)', () => {
  it('παράγει πλαίσιο (4) + 2 υαλοπίνακες + 1 μπινί = 7', () => {
    expect(buildWindowSymbolSegments(OP1, WALL)).toHaveLength(7);
  });

  it('το σύμβολο εκτείνεται κατά το πάχος γύρω από το κέντρο (f=0.5)', () => {
    const segs = buildWindowSymbolSegments(OP1, WALL);
    const ys = segs.flatMap((s) => [s.a.y, s.b.y]);
    const mid = 0.58 + 0.25 * 0.5; // wall y + half thickness
    expect(Math.min(...ys)).toBeLessThan(mid);
    expect(Math.max(...ys)).toBeGreaterThan(mid);
  });

  it('το μπινί (τελευταίο seg) είναι κάθετο στον άξονα στο μέσο του ανοίγματος', () => {
    const segs = buildWindowSymbolSegments(OP1, WALL);
    const mullion = segs[segs.length - 1];
    // Κάθετο στον οριζόντιο άξονα → ίδιο x, διαφορετικό y.
    expect(Math.abs(mullion.b.x - mullion.a.x)).toBeCloseTo(0, 6);
    expect(Math.abs(mullion.b.y - mullion.a.y)).toBeGreaterThan(0);
  });
});
