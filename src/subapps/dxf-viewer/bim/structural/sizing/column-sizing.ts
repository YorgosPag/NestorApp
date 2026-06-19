/**
 * column-sizing — SSoT αυτόματης διαστασιολόγησης **διατομής κολώνας** (ADR-499
 * Slice B2, Revit-grade). Αδελφή των `suggestBeamSection` (ύψος δοκαριού) και
 * `suggestSlabThickness` (πάχος πλάκας-προβόλου).
 *
 * Όταν ένας πρόβολος (ADR-486/498) φορτίζει τη στηρίζουσα κολώνα, η FEM ροπή
 * `wL²/2` (ADR-491) εκτοξεύεται ενώ η διατομή μένει 400×400 → ο διαμήκης οπλισμός
 * θα ξεπερνούσε το ρ_max (φυσικά αδύνατο). Εδώ η **χαρακτηριστική διάσταση**
 * αυτο-μεγαλώνει ώστε να ικανοποιούνται ΤΑΥΤΟΧΡΟΝΑ:
 *   1. **Χωράει ο οπλισμός** (η φυσική πύλη): `As,req(N-M) ≤ ρ_max·A_c` (ρ_max=0.04,
 *      EC8). Το `As,req` = `asStrengthColumnMm2` (ήδη N-M aware, ADR-472/491) —
 *      περιλαμβάνει ΚΑΙ τον αξονικό όρο `(N_Ed − f_cd·A_c)/f_yd`, άρα καλύπτει
 *      σιωπηλά και το `N_Rd` (αν `N_Ed > f_cd·A_c` ο αξονικός όρος εκτοξεύεται →
 *      η διατομή μεγαλώνει· μηδέν διπλότυπος τύπος N_Rd).
 *   2. **Λυγηρότητα** (EC2 §5.8): `min(width,depth) ≥ height / λ_max` με
 *      `λ_max = MAX_SLENDERNESS_RATIO` — το **ΙΔΙΟ** γεωμετρικό κριτήριο που
 *      ελέγχει ο `validateColumnParams` (height/minDim ≤ 30) ⇒ η αυτο-μεγεθυμένη
 *      κολώνα περνά validation χωρίς απόκλιση. (Το ακριβές `λ = l0/i` EC2
 *      §5.8.3.1 = DEFER — conservative geometric proxy επαρκεί για v1.)
 *
 * **Scope B2 v1:** ΜΟΝΟ **ορθογώνιες** κολώνες (`kind==='rectangular'`). L/T/U/I/
 * circular/wall shape-grow = DEFER (πολυδιάστατο· τα `bim/columns/*` τα πειράζει
 * άλλος agent — ADR-496). Μη-ορθογώνια → `undefined` (no-op).
 *
 * **Απόκλιση από τα slab/beam sizers:** εκεί το `d_req` είναι closed-form· εδώ η
 * `As,req` εξαρτάται από την ίδια τη διάσταση (A_c + μοχλοβραχίονας z), άρα η
 * αναζήτηση είναι **iterative** (βήμα 50mm, ≤~20 επαναλήψεις ως το πρακτικό
 * μέγιστο) — κάθε candidate ξαναχτίζει το `ColumnSectionContext` από τα ίδια SSoT.
 *
 * REUSE (μηδέν duplicate μηχανικής, N.0.2): `buildColumnSectionContextFromParams`
 * (section-context), `asStrengthColumnMm2` (suggest-reinforcement N-M demand),
 * `columnReinforcementLimits().maxRatio` (provider ρ_max), `MIN_COLUMN_DIMENSION_MM`
 * + `MAX_SLENDERNESS_RATIO` (column-types). Pure — zero React/DOM/Firestore. mm.
 *
 * @see ./member-sizing.ts — `suggestBeamSection` (το πρώτο μέλος)
 * @see ./slab-sizing.ts — `suggestSlabThickness` (το αδελφό pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import { buildColumnSectionContextFromParams } from '../section-context';
import { asStrengthColumnMm2 } from '../codes/suggest-reinforcement';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import type { ColumnParams } from '../../types/column-types';
import { MIN_COLUMN_DIMENSION_MM, MAX_SLENDERNESS_RATIO } from '../../types/column-types';

/** Constructible module στρογγυλοποίησης διάστασης κολώνας (mm). */
const COLUMN_DIMENSION_MODULE_MM = 50;

/** Πρακτικό άνω φράγμα χαρακτηριστικής διάστασης κολώνας (mm) — πάνω → Slice D escalation. */
export const MAX_PRACTICAL_COLUMN_DIMENSION_MM = 1200;

/** Διάμετρος-probe για το ρ_max (diameter-independent — η `columnReinforcementLimits` θέλει arg). */
const COLUMN_FIT_PROBE_DIAMETER_MM = 16;

/** Ποιος έλεγχος καθόρισε την τελική διατομή (διαγνωστικό/τεκμηρίωση). */
export type ColumnSizingGovernedBy = 'reinforcement' | 'slenderness' | 'minimum';

/** Προτεινόμενη διατομή κολώνας (square-equivalent grow· διατηρεί διαστάσεις upward). */
export interface ColumnSizing {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly governedBy: ColumnSizingGovernedBy;
}

function roundUpToModule(value: number, module: number): number {
  return Math.ceil(value / module) * module;
}

/**
 * Χωράει ο διαμήκης οπλισμός σε ορθογώνια διατομή με χαρακτηριστική διάσταση `sMm`;
 * (`As,req ≤ ρ_max·A_c`). Ξαναχτίζει το context από τα ίδια SSoT για την trial διατομή
 * `width=max(w₀,s)`, `depth=max(d₀,s)` (grow upward, διατηρεί αρχιτεκτονικές διαστάσεις).
 */
function columnSectionFits(
  provider: StructuralCodeProvider,
  baseParams: ColumnParams,
  femMomentKnm: number | undefined,
  sMm: number,
): boolean {
  const width = Math.max(baseParams.width, sMm);
  const depth = Math.max(baseParams.depth, sMm);
  const ctx = buildColumnSectionContextFromParams({ ...baseParams, width, depth }, femMomentKnm);
  const maxRatio = provider.columnReinforcementLimits(ctx, COLUMN_FIT_PROBE_DIAMETER_MM).maxRatio;
  if (maxRatio <= 0) return true;
  return asStrengthColumnMm2(ctx) <= maxRatio * ctx.grossAreaMm2;
}

/**
 * Πρόταση ελάχιστης επαρκούς διατομής **ορθογώνιας** κολώνας. `undefined` όταν δεν
 * εφαρμόζεται (μη-ορθογώνια) ⇒ ο caller κρατά τη stored διατομή. Η `femMomentKnm` =
 * η engaged-gated FEM ροπή του φορέα (ADR-491· πρόβολος → `wL²/2`) που υπερισχύει της
 * ονομαστικής e₀. `governedBy` = ο έλεγχος που καθόρισε την αύξηση (προ-patch).
 */
export function suggestColumnSection(
  provider: StructuralCodeProvider,
  params: ColumnParams,
  femMomentKnm?: number,
): ColumnSizing | undefined {
  if (params.kind !== 'rectangular') return undefined;

  const slenderMinMm = MAX_SLENDERNESS_RATIO > 0 ? params.height / MAX_SLENDERNESS_RATIO : 0;
  const sStart = roundUpToModule(Math.max(slenderMinMm, MIN_COLUMN_DIMENSION_MM), COLUMN_DIMENSION_MODULE_MM);

  let s = sStart;
  let grewForSteel = false;
  while (s < MAX_PRACTICAL_COLUMN_DIMENSION_MM && !columnSectionFits(provider, params, femMomentKnm, s)) {
    s += COLUMN_DIMENSION_MODULE_MM;
    grewForSteel = true;
  }
  s = Math.min(s, MAX_PRACTICAL_COLUMN_DIMENSION_MM);

  const governedBy: ColumnSizingGovernedBy = grewForSteel
    ? 'reinforcement'
    : slenderMinMm > MIN_COLUMN_DIMENSION_MM ? 'slenderness' : 'minimum';
  return { widthMm: Math.max(params.width, s), depthMm: Math.max(params.depth, s), governedBy };
}
