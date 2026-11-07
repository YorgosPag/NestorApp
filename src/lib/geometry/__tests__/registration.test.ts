/**
 * ADR-929 §6.9 — καταγραφή CAD → μελάνι: προσαρμογή σημείου-προς-γραμμή (Baarda) και ICP με chamfer.
 * Συνθετικά: τμήματα σχεδίου ραστεροποιούνται με ΓΝΩΣΤΟ affine και πάχος πινελιάς, και ο πυρήνας πρέπει να τον ξαναβρεί.
 */

import { describe, it, expect } from '@jest/globals';
import { applyAffine, type Affine2x3, type AffinePoint } from '../affine-2x3';
import { fitTransform } from '../registration/fit-transform';
import { pickByChamfer, probeStrokeCentre, registerToInk } from '../registration/chamfer-register';
import {
  DEFAULT_FIT,
  DEFAULT_REGISTER,
  type InkMask,
  type LineCorrespondence,
  type RegistrationSegment,
} from '../registration/registration-types';

const W = 420;
const H = 340;

/** Κάτοψη: εξωτερικό περίγραμμα με διπλή γραμμή, εσωτερικοί τοίχοι, μία λοξή — αρκετή για να ορίζεται το affine. */
function planSegments(origin: AffinePoint = { x: 0, y: 0 }): RegistrationSegment[] {
  const s = (ax: number, ay: number, bx: number, by: number): RegistrationSegment => ({
    a: { x: origin.x + ax, y: origin.y + ay },
    b: { x: origin.x + bx, y: origin.y + by },
  });
  return [
    s(0, 0, 150, 0), s(150, 0, 150, 110), s(150, 110, 0, 110), s(0, 110, 0, 0),
    s(6, 6, 144, 6), s(144, 6, 144, 104), s(144, 104, 6, 104), s(6, 104, 6, 6),
    s(70, 6, 70, 104), s(6, 55, 70, 55), s(100, 104, 144, 60),
  ];
}

function rasterize(segments: readonly RegistrationSegment[], t: Affine2x3, widthPx: number): InkMask {
  const mask = new Uint8Array(W * H);
  for (const seg of segments) {
    const a = applyAffine(t, seg.a);
    const b = applyAffine(t, seg.b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const k = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
        if (Math.hypot(px - (a.x + k * dx), py - (a.y + k * dy)) <= widthPx / 2) mask[y * W + x] = 1;
      }
    }
  }
  return { mask, width: W, height: H };
}

/** Μέγιστη απόκλιση (px) δύο μετασχηματισμών στα σημεία ελέγχου. */
function maxDeviation(p: Affine2x3, q: Affine2x3, points: readonly AffinePoint[]): number {
  return Math.max(...points.map((pt) => {
    const u = applyAffine(p, pt);
    const v = applyAffine(q, pt);
    return Math.hypot(u.x - v.x, u.y - v.y);
  }));
}

const TRUTH: Affine2x3 = { a: 2.4, b: 0.05, c: -0.03, d: 2.35, e: 30, f: 25 };
const CORNERS: AffinePoint[] = [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 110 }, { x: 0, y: 110 }];
const PERTURBED: Affine2x3 = { a: 2.45, b: 0.03, c: -0.01, d: 2.4, e: 35, f: 20 };

describe('fitTransform', () => {
  const corr = (p: AffinePoint, n: AffinePoint, t: Affine2x3, bias = 0): LineCorrespondence => {
    const q = applyAffine(t, p);
    return { drawing: p, normal: n, offset: n.x * q.x + n.y * q.y + bias };
  };
  const grid = (): LineCorrespondence[] => {
    const out: LineCorrespondence[] = [];
    for (let i = 0; i < 12; i++) {
      out.push(corr({ x: i * 12, y: 0 }, { x: 0, y: 1 }, TRUTH), corr({ x: i * 12, y: 110 }, { x: 0, y: 1 }, TRUTH));
      out.push(corr({ x: 0, y: i * 9 }, { x: 1, y: 0 }, TRUTH), corr({ x: 150, y: i * 9 }, { x: 1, y: 0 }, TRUTH));
    }
    return out;
  };

  it('ξαναβρίσκει ακριβώς το affine από τέλειες αντιστοιχίες', () => {
    const fit = fitTransform(grid(), DEFAULT_FIT);
    if (fit.kind !== 'fitted') throw new Error('expected fitted');
    expect(maxDeviation(fit.transform, TRUTH, CORNERS)).toBeLessThan(1e-6);
    expect(fit.rejected).toBe(0);
  });

  it('απορρίπτει με Baarda ένα χονδροειδές σφάλμα 20 px, και μόνο αυτό', () => {
    const obs = grid();
    obs[5] = corr(obs[5].drawing, obs[5].normal, TRUTH, 20);
    const fit = fitTransform(obs, { ...DEFAULT_FIT, sigmaPx: 0.1 });
    if (fit.kind !== 'fitted') throw new Error('expected fitted');
    expect(fit.rejected).toBe(1);
    expect(fit.perObservation[5]).toBeNull();
    expect(maxDeviation(fit.transform, TRUTH, CORNERS)).toBeLessThan(1e-6);
  });

  it('μένει ακριβές με συντεταγμένες CAD ~10⁵ (κανονικοποίηση Hartley)', () => {
    const far = { x: 412_345, y: 4_512_678 };
    const shift: Affine2x3 = { ...TRUTH, e: TRUTH.e - TRUTH.a * far.x - TRUTH.c * far.y, f: TRUTH.f - TRUTH.b * far.x - TRUTH.d * far.y };
    const obs = grid().map((c) => {
      const p = { x: c.drawing.x + far.x, y: c.drawing.y + far.y };
      return corr(p, c.normal, shift);
    });
    const fit = fitTransform(obs, DEFAULT_FIT);
    if (fit.kind !== 'fitted') throw new Error('expected fitted');
    expect(maxDeviation(fit.transform, shift, CORNERS.map((p) => ({ x: p.x + far.x, y: p.y + far.y })))).toBeLessThan(1e-4);
  });

  it('λιγότερες παρατηρήσεις από αγνώστους ⇒ singular, όχι NaN', () => {
    expect(fitTransform(grid().slice(0, 3), DEFAULT_FIT).kind).toBe('singular');
  });
});

describe('probeStrokeCentre', () => {
  const ink = rasterize([{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }], { a: 400, b: 0, c: 0, d: 1, e: 10, f: 52 }, 3);

  it('δίνει το ΚΕΝΤΡΟ της πινελιάς, όχι την άκρη της', () => {
    const along = probeStrokeCentre(ink, { x: 200, y: 50 }, { x: 0, y: 1 }, 8);
    expect(along).not.toBeNull();
    expect(Math.abs((along ?? 0) - 2)).toBeLessThanOrEqual(0.5);
  });

  it('γεμάτη επιφάνεια (μακρύτερη από την ακτίνα) ⇒ καμία αντιστοιχία', () => {
    const full: InkMask = { mask: new Uint8Array(W * H).fill(1), width: W, height: H };
    expect(probeStrokeCentre(full, { x: 200, y: 50 }, { x: 0, y: 1 }, 8)).toBeNull();
  });
});

describe('registerToInk', () => {
  const segments = planSegments();
  const ink = rasterize(segments, TRUTH, 3);

  it('ξαναβρίσκει το affine με σφάλμα < 0,5 px από διαταραγμένη αρχή', () => {
    const r = registerToInk(segments, ink, PERTURBED, DEFAULT_REGISTER);
    if (r.kind !== 'registered') throw new Error(`expected registered, got ${r.reason}`);
    expect(maxDeviation(r.fit.transform, TRUTH, CORNERS)).toBeLessThan(0.5);
    expect(r.fit.residuals.p95Px).toBeLessThan(1);
    expect(r.coverage).toBeGreaterThan(0.8);
  });

  it('γραμμή του CAD που λείπει από την εικόνα δεν χαλά τη λύση', () => {
    const extra = [...segments, { a: { x: 20, y: 30 }, b: { x: 60, y: 30 } }];
    const r = registerToInk(extra, ink, PERTURBED, DEFAULT_REGISTER);
    if (r.kind !== 'registered') throw new Error(`expected registered, got ${r.reason}`);
    expect(maxDeviation(r.fit.transform, TRUTH, CORNERS)).toBeLessThan(0.5);
  });

  it('κενή εικόνα ⇒ not-converged με λόγο, ποτέ σιωπηλό αποτέλεσμα', () => {
    const empty: InkMask = { mask: new Uint8Array(W * H), width: W, height: H };
    const r = registerToInk(segments, empty, PERTURBED, DEFAULT_REGISTER);
    expect(r).toEqual({ kind: 'not-converged', reason: 'too-few-correspondences', round: 0 });
  });

  it('το chamfer διαλέγει τον σωστό υποψήφιο αρχικό μετασχηματισμό', () => {
    const wrong: Affine2x3 = { ...TRUTH, e: TRUTH.e + 60 };
    const best = pickByChamfer(segments, ink, [wrong, PERTURBED], DEFAULT_REGISTER);
    expect(best?.transform).toBe(PERTURBED);
  });
});
