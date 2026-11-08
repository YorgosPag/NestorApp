/**
 * ADR-929 §6.9 — καταγραφή CAD → μελάνι: προσαρμογή σημείου-προς-γραμμή (Baarda) και ICP με chamfer.
 * Συνθετικά: τμήματα σχεδίου ραστεροποιούνται με ΓΝΩΣΤΟ affine και πάχος πινελιάς, και ο πυρήνας πρέπει να τον ξαναβρεί.
 */

import { describe, it, expect } from '@jest/globals';
import { applyAffine, type Affine2x3, type AffinePoint } from '../affine-2x3';
import { fitTransform } from '../registration/fit-transform';
import { estimateStrokeWidthPx, pickByChamfer, probeStrokeCentre, registerToInk } from '../registration/chamfer-register';
import {
  DEFAULT_FIT,
  DEFAULT_REGISTER,
  type InkMask,
  type LineCorrespondence,
} from '../registration/registration-types';
import { CORNERS, H, maxDeviation, PERTURBED, planSegments, rasterize, TRUTH, W } from './registration-fixtures';

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

  it('🔴 §6.9 #13/#15: πινελιά 5 px με ακτίνα 3 ⇒ null χωρίς πάχος, ΚΕΝΤΡΟ με πάχος 6 (ακτίνα ≠ πάχος)', () => {
    const thick = rasterize([{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }], { a: 400, b: 0, c: 0, d: 1, e: 10, f: 50 }, 5);
    expect(probeStrokeCentre(thick, { x: 200, y: 50 }, { x: 0, y: 1 }, 3)).toBeNull();
    const along = probeStrokeCentre(thick, { x: 200, y: 50 }, { x: 0, y: 1 }, 3, 6);
    expect(along).not.toBeNull();
    expect(Math.abs(along ?? 99)).toBeLessThanOrEqual(0.5);
  });

  it('κέντρο πινελιάς έξω από την ακτίνα ⇒ null, όσο φαρδύ κι αν είναι το παράθυρο', () => {
    // Πινελιά 3 px με κέντρο 5 px μακριά: μέσα στο παράθυρο ±(3+6), αλλά |κέντρο| > r = 3.
    expect(probeStrokeCentre(ink, { x: 200, y: 47 }, { x: 0, y: 1 }, 3, 6)).toBeNull();
  });
});

describe('estimateStrokeWidthPx (§6.9 #15)', () => {
  const segments = planSegments();

  it('μετρά το πάχος ΤΗΣ πινελιάς στο αποτύπωμα: 3 px ⇒ ≈ 3 · 7 px ⇒ ≈ 7 (± 1 px ψηφιοποίησης)', () => {
    const w3 = estimateStrokeWidthPx(segments, rasterize(segments, TRUTH, 3), PERTURBED, DEFAULT_REGISTER);
    const w7 = estimateStrokeWidthPx(segments, rasterize(segments, TRUTH, 7), PERTURBED, DEFAULT_REGISTER);
    expect(w3).toBeGreaterThanOrEqual(2.5);
    expect(w3).toBeLessThanOrEqual(4.5);
    expect(w7).toBeGreaterThanOrEqual(6.5);
    expect(w7).toBeLessThanOrEqual(8.5);
  });

  it('κενή εικόνα ⇒ η τελευταία ακτίνα (η συμπεριφορά χωρίς μέτρηση), ποτέ NaN', () => {
    const empty: InkMask = { mask: new Uint8Array(W * H), width: W, height: H };
    expect(estimateStrokeWidthPx(segments, empty, PERTURBED, DEFAULT_REGISTER)).toBe(3);
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
    // §6.9 #15: η αβεβαιότητα θέσης είναι πεπερασμένη και μικρότερη από το πραγματικό σφάλμα ανοχής του test.
    expect(r.fit.positionSigmaPx).toBeGreaterThan(0);
    expect(r.fit.positionSigmaPx).toBeLessThan(0.5);
  });

  it('🔴 §6.9 #13/#15: πινελιά 7 px (υψηλά dpi) ⇒ το ICP συγκλίνει με κάλυψη, γιατί το πάχος μετριέται', () => {
    const thick = rasterize(segments, TRUTH, 7);
    const r = registerToInk(segments, thick, PERTURBED, DEFAULT_REGISTER);
    if (r.kind !== 'registered') throw new Error(`expected registered, got ${r.reason}`);
    expect(r.strokeWidthPx).toBeGreaterThan(6);
    expect(r.coverage).toBeGreaterThan(0.8);
    expect(maxDeviation(r.fit.transform, TRUTH, CORNERS)).toBeLessThan(0.5);
    // Το ίδιο, με το πάχος καρφωμένο στην ακτίνα (η συμπεριφορά ως το #14): η πινελιά είναι «πολύ μακριά».
    const fixed = registerToInk(segments, thick, PERTURBED, { ...DEFAULT_REGISTER, strokeWidthPx: 3 });
    expect(fixed.kind === 'registered' ? fixed.coverage : 0).toBeLessThan(0.5);
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

  it('§6.9 #15 Lowe: ο δεύτερος ΔΙΑΚΡΙΤΟΣ υποψήφιος — επαναλαμβανόμενο μοτίβο ⇒ ίδιο σκορ · κοντινός (≤ R₀) ⇒ δεν μετρά', () => {
    const at = (e: number, f: number): Affine2x3 => ({ a: 1, b: 0, c: 0, d: 1, e, f });
    const first = at(30, 30);
    const copy = at(230, 200);
    const near = at(35, 30);
    const one = rasterize(segments, first, 3);
    const other = rasterize(segments, copy, 3);
    const both: InkMask = { mask: one.mask.map((v, i) => v | other.mask[i]), width: W, height: H };
    const repeated = pickByChamfer(segments, both, [first, near, copy], DEFAULT_REGISTER);
    expect(repeated?.transform).toBe(first);
    expect(repeated?.runnerUpScore).toBeCloseTo(repeated?.score ?? -1, 6);
    expect(pickByChamfer(segments, both, [first, near], DEFAULT_REGISTER)?.runnerUpScore).toBeNull();
    const single = pickByChamfer(segments, one, [first, copy], DEFAULT_REGISTER);
    expect(single?.runnerUpScore ?? 0).toBeGreaterThan(5);
  });
});
