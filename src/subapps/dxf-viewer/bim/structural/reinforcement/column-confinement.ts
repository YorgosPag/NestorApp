/**
 * Column confinement effectiveness (ADR-456 — Στατικά, Slice 3 / static).
 *
 * Συντελεστής αποτελεσματικότητας περίσφιγξης α = αₙ·αₛ κατά EC8 §5.4.3.2.2(8)
 * (EN 1998-1) — πόσο αποδοτικά ο εγκάρσιος οπλισμός περισφίγγει τον πυρήνα:
 *   - αₛ (κατά το ύψος) = (1 − s/2b₀)(1 − s/2h₀) για ορθογώνιους συνδετήρες·
 *     για σπείρα/συνεχή = (1 − s/2b₀) (ένας όρος — συνεχής καθ' ύψος).
 *   - αₙ (στην κάτοψη) = 1 − Σbᵢ²/(6·b₀·h₀), bᵢ = αποστάσεις διαδοχικών
 *     συγκρατημένων διαμήκων ράβδων· για σπείρα αₙ = 1 (πλήρης, χωρίς κενά).
 *
 * b₀,h₀ = διαστάσεις περισφιγμένου πυρήνα ως τον άξονα του συνδετήρα. Pure,
 * geometry-is-SSoT (reuse `computeColumnRebarLayout` για τις θέσεις ράβδων).
 *
 * Σημείωση τύπου: `closed-welded` έχει ΙΔΙΑ γεωμετρία/α με `closed-hooked` — η
 * διαφορά είναι στην πλαστιμότητα/αγκύρωση (η συγκόλληση οπλισμού περιορίζεται
 * αντισεισμικά)· εκφράζεται ως `ductilityWarning`, ΟΧΙ ως αλλαγή στο α.
 *
 * @see ./column-reinforcement-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import type { ColumnSectionContext } from '../codes/structural-code-types';
import type { ColumnReinforcement } from './column-reinforcement-types';
import { DEFAULT_STIRRUP_TYPE } from './column-reinforcement-types';
import { computeColumnRebarLayout } from './column-rebar-layout';

/** Αποτέλεσμα υπολογισμού περίσφιγξης. */
export interface ColumnConfinement {
  /** αₙ — αποτελεσματικότητα στην κάτοψη [0..1]. */
  readonly alphaN: number;
  /** αₛ — αποτελεσματικότητα κατά το ύψος [0..1]. */
  readonly alphaS: number;
  /** α = αₙ·αₛ — συνολικός συντελεστής περίσφιγξης [0..1]. */
  readonly alpha: number;
  /** True όταν ο τύπος (συγκολλητός) έχει αντισεισμικό περιορισμό πλαστιμότητας. */
  readonly ductilityWarning: boolean;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Ενεργό βήμα για περίσφιγξη = κρίσιμο (αν υπάρχει) αλλιώς βασικό. */
function effectiveSpacingMm(r: ColumnReinforcement): number {
  const { spacingMm, spacingCriticalMm } = r.stirrups;
  return spacingCriticalMm && spacingCriticalMm > 0 ? spacingCriticalMm : spacingMm;
}

/** Άθροισμα bᵢ² διαδοχικών ράβδων γύρω από την περίμετρο (κλειστός βρόχος). */
function sumGapSquaredMm2(bars: readonly { x: number; y: number }[]): number {
  if (bars.length < 2) return 0;
  const ordered = [...bars].sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  let sum = 0;
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    sum += (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  }
  return sum;
}

/**
 * Υπολογίζει την αποτελεσματικότητα περίσφιγξης α = αₙ·αₛ της ορθογωνικής κολώνας.
 * Επιστρέφει μηδενικά για εκφυλισμένο πυρήνα.
 */
export function computeColumnConfinement(
  ctx: ColumnSectionContext,
  r: ColumnReinforcement,
): ColumnConfinement {
  const type = r.stirrups.type ?? DEFAULT_STIRRUP_TYPE;
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const cover = Math.max(0, r.coverMm);
  const b0 = Math.max(0, ctx.widthMm - 2 * (cover + dbw / 2));
  const h0 = Math.max(0, ctx.depthMm - 2 * (cover + dbw / 2));
  if (b0 <= 0 || h0 <= 0) {
    return { alphaN: 0, alphaS: 0, alpha: 0, ductilityWarning: type === 'closed-welded' };
  }
  const s = effectiveSpacingMm(r);

  if (type === 'spiral') {
    const alphaS = clamp01(1 - s / (2 * b0));
    return { alphaN: 1, alphaS, alpha: clamp01(alphaS), ductilityWarning: false };
  }

  const alphaS = clamp01((1 - s / (2 * b0)) * (1 - s / (2 * h0)));
  const layout = computeColumnRebarLayout(r, ctx.widthMm, ctx.depthMm);
  const sumBi2 = layout ? sumGapSquaredMm2(layout.longitudinalBarsMm) : 0;
  const alphaN = clamp01(1 - sumBi2 / (6 * b0 * h0));
  return {
    alphaN,
    alphaS,
    alpha: clamp01(alphaN * alphaS),
    ductilityWarning: type === 'closed-welded',
  };
}
