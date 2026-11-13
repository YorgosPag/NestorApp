/**
 * @fileoverview **ΠΡΟΣΑΡΜΟΓΗ ΜΕΤΑΣΧΗΜΑΤΙΣΜΟΥ ΑΠΟ ΑΝΤΙΣΤΟΙΧΙΕΣ ΣΗΜΕΙΟΥ-ΠΡΟΣ-ΓΡΑΜΜΗ** (SSoT, ADR-929 §6.9).
 * @module lib/geometry/registration/fit-transform
 *
 * Για κάθε αντιστοιχία `(p, n, o)`: `n · T(p) = o`. Με `T` affine ή ομοιότητα η εξίσωση είναι **γραμμική** στους αγνώστους,
 * άρα λύνεται με τα σταθμισμένα ελάχιστα τετράγωνα του `lib/linear-algebra` (ένας επιλυτής, μία στατιστική). Το υπόλοιπο
 * κάθε παρατήρησης είναι η **προσημασμένη απόσταση σε pixel** του σημείου από τη γραμμή μελανιού.
 *
 * 🔑 **Κανονικοποίηση Hartley.** Οι συντεταγμένες CAD φτάνουν τα 10⁵ (mm, γεωαναφορά). Οι κανονικές εξισώσεις τότε
 * χάνουν ψηφία. Τα σημεία μεταφέρονται στο κέντρο βάρους τους και κλιμακώνονται σε μοναδιαία RMS απόσταση, λύνεται εκεί,
 * και ο μετασχηματισμός συντίθεται πίσω (Hartley 1997, «In defense of the eight-point algorithm»).
 */

import { composeAffine, type Affine2x3, type AffinePoint } from '../affine-2x3';
import { adjustWithDataSnooping } from '../../linear-algebra/robust-adjustment';
import {
  quadraticForm,
  solveWeightedLeastSquares,
  type Cofactor,
  type LinearObservation,
  type ObservationTerm,
} from '../../linear-algebra/weighted-least-squares';
import type { FitOptions, FitResult, LineCorrespondence, RegistrationModel, ResidualStats } from './registration-types';

const UNKNOWNS: Readonly<Record<RegistrationModel, number>> = { similarity: 4, affine: 6 };

/** `p → (p − κέντρο) / κλίμακα`, με μοναδιαία RMS απόσταση από το κέντρο. */
export function normalizingAffine(points: readonly AffinePoint[]): Affine2x3 {
  const n = Math.max(1, points.length);
  const cx = points.reduce((s, p) => s + p.x, 0) / n;
  const cy = points.reduce((s, p) => s + p.y, 0) / n;
  const rms = Math.sqrt(points.reduce((s, p) => s + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / n);
  const k = rms > 0 ? 1 / rms : 1;
  return { a: k, b: 0, c: 0, d: k, e: -cx * k, f: -cy * k };
}

function termsFor(model: RegistrationModel, u: AffinePoint, nrm: AffinePoint): ObservationTerm[] {
  if (model === 'similarity') {
    return [
      { index: 0, coefficient: nrm.x * u.x + nrm.y * u.y },
      { index: 1, coefficient: nrm.y * u.x - nrm.x * u.y },
      { index: 2, coefficient: nrm.x },
      { index: 3, coefficient: nrm.y },
    ];
  }
  return [
    { index: 0, coefficient: nrm.x * u.x },
    { index: 1, coefficient: nrm.y * u.x },
    { index: 2, coefficient: nrm.x * u.y },
    { index: 3, coefficient: nrm.y * u.y },
    { index: 4, coefficient: nrm.x },
    { index: 5, coefficient: nrm.y },
  ];
}

function affineOf(model: RegistrationModel, x: readonly number[]): Affine2x3 {
  if (model === 'similarity') return { a: x[0], b: x[1], c: -x[1], d: x[0], e: x[2], f: x[3] };
  return { a: x[0], b: x[1], c: x[2], d: x[3], e: x[4], f: x[5] };
}

/** RMSE / p95 / μέγιστο των απόλυτων υπολοίπων (px). */
export function residualStats(residuals: readonly number[]): ResidualStats {
  const abs = residuals.map(Math.abs).sort((p, q) => p - q);
  const count = abs.length;
  if (count === 0) return { count, rmsePx: 0, p95Px: 0, maxPx: 0 };
  const rmsePx = Math.sqrt(abs.reduce((s, v) => s + v * v, 0) / count);
  const p95Px = abs[Math.min(count - 1, Math.ceil(0.95 * count) - 1)];
  return { count, rmsePx, p95Px, maxPx: abs[count - 1] };
}

/** ∂(x′, y′)/∂παραμέτρων για ένα **κανονικοποιημένο** σημείο `u` — η σειρά των αγνώστων του {@link affineOf}. */
function pointJacobian(model: RegistrationModel, u: AffinePoint): readonly [ObservationTerm[], ObservationTerm[]] {
  if (model === 'similarity') {
    return [
      [{ index: 0, coefficient: u.x }, { index: 1, coefficient: -u.y }, { index: 2, coefficient: 1 }],
      [{ index: 0, coefficient: u.y }, { index: 1, coefficient: u.x }, { index: 3, coefficient: 1 }],
    ];
  }
  return [
    [{ index: 0, coefficient: u.x }, { index: 2, coefficient: u.y }, { index: 4, coefficient: 1 }],
    [{ index: 1, coefficient: u.x }, { index: 3, coefficient: u.y }, { index: 5, coefficient: 1 }],
  ];
}

/**
 * Αβεβαιότητα θέσης (px, 1σ, √(σ²ₓ+σ²ᵧ)) στη **χειρότερη** από τις 4 γωνίες του περιγράμματος των σημείων: σ₀²·J·Q_xx·Jᵀ.
 * Στις γωνίες, γιατί η αβεβαιότητα της affine μεγαλώνει τετραγωνικά μακριά από το κέντρο βάρους. σ₀ άγνωστο ⇒ a priori (1).
 */
function worstCornerSigma(model: RegistrationModel, points: readonly AffinePoint[], norm: Affine2x3, q: Cofactor, sigma0: number | null): number {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const corners = [Math.min(...xs), Math.max(...xs)].flatMap((x) => [Math.min(...ys), Math.max(...ys)].map((y) => ({ x, y })));
  const s2 = (sigma0 ?? 1) ** 2;
  let worst = 0;
  for (const c of corners) {
    const [jx, jy] = pointJacobian(model, { x: norm.a * c.x + norm.e, y: norm.d * c.y + norm.f });
    worst = Math.max(worst, Math.sqrt(s2 * (quadraticForm(jx, q) + quadraticForm(jy, q))));
  }
  return worst;
}

interface Solved {
  readonly singular: boolean;
  readonly cofactor: Cofactor;
  readonly x: readonly number[];
  readonly residuals: readonly (number | null)[];
  readonly rejected: number;
  readonly sigma0: number | null;
  readonly globalTestPassed: boolean | null;
}

function solve(obs: readonly LinearObservation[], unknowns: number, o: FitOptions): Solved {
  if (o.snoop) {
    const r = adjustWithDataSnooping(obs, unknowns, { critical: o.critical, minRedundancy: o.minRedundancy });
    const residuals = r.verdicts.map((v) => (v.active ? v.residual : null));
    const { singular, x, cofactor } = r.solution;
    return { singular, cofactor, x, residuals, rejected: r.rejected, sigma0: r.sigma0, globalTestPassed: r.globalTestPassed };
  }
  const s = solveWeightedLeastSquares(obs, unknowns);
  const df = s.degreesOfFreedom;
  const sigma0 = !s.singular && df > 0 ? Math.sqrt(s.weightedSquareSum / df) : null;
  return { singular: s.singular, cofactor: s.cofactor, x: s.x, residuals: s.residuals, rejected: 0, sigma0, globalTestPassed: null };
}

/** Προσάρμοσε `T: σχέδιο → pixel` στις αντιστοιχίες. Ιδιάζον σύστημα ⇒ `singular`, ποτέ `NaN`. */
export function fitTransform(correspondences: readonly LineCorrespondence[], o: FitOptions): FitResult {
  const unknowns = UNKNOWNS[o.model];
  const observations = correspondences.length;
  if (observations < unknowns) return { kind: 'singular', observations };
  const norm = normalizingAffine(correspondences.map((c) => c.drawing));
  const obs: LinearObservation[] = correspondences.map((c) => ({
    terms: termsFor(o.model, { x: norm.a * c.drawing.x + norm.e, y: norm.d * c.drawing.y + norm.f }, c.normal),
    value: c.offset,
    sigma: o.sigmaPx,
  }));
  const s = solve(obs, unknowns, o);
  if (s.singular) return { kind: 'singular', observations };
  const active = s.residuals.filter((v): v is number => v !== null);
  return {
    kind: 'fitted',
    transform: composeAffine(affineOf(o.model, s.x), norm),
    residuals: residualStats(active),
    observations,
    rejected: s.rejected,
    sigma0: s.sigma0,
    globalTestPassed: s.globalTestPassed,
    perObservation: s.residuals,
    positionSigmaPx: worstCornerSigma(o.model, correspondences.map((c) => c.drawing), norm, s.cofactor, s.sigma0),
  };
}
