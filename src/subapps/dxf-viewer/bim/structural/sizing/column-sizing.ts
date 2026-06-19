/**
 * column-sizing — SSoT αυτόματης διαστασιολόγησης **διατομής κολώνας** (ADR-499
 * Slice B2, Revit-grade). Αδελφή των `suggestBeamSection` (ύψος δοκαριού) και
 * `suggestSlabThickness` (πάχος πλάκας-προβόλου).
 *
 * **ADR-503 — two-way:** η **χαρακτηριστική διάσταση** αυτο-**προσαρμόζεται** (μεγαλώνει
 * όταν υποδιαστασιολογείται, **μικραίνει** όταν υπερδιαστασιολογείται → μηδέν σπατάλη
 * υλικού/χρήματος· ο αρχιτέκτονας βάζει default 400×400 χωρίς στατικά). Βρίσκει το
 * **ελάχιστο επαρκές** `s×s` που ικανοποιεί ΤΑΥΤΟΧΡΟΝΑ:
 *   0. **Ανηγμένο αξονικό** `ν = N_Ed/(A_c·f_cd) ≤ 0.65` (EC8 §5.4.3.2.1, DCM) — η πύλη
 *      που κάνει το **shrink ασφαλές** (χωρίς αυτήν ο sizer θα μίκραινε σε EC8 παραβίαση).
 *   1. **Χωράει ο οπλισμός** (η φυσική πύλη): `As,req(N-M) ≤ ρ_max·A_c` (ρ_max=0.04,
 *      EC8). Το `As,req` = `asStrengthColumnMm2` (ήδη N-M aware, ADR-472/491) —
 *      περιλαμβάνει ΚΑΙ τον αξονικό όρο `(N_Ed − f_cd·A_c)/f_yd`.
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
import { concreteFcdMpa, DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import type { ColumnParams } from '../../types/column-types';
import { MIN_COLUMN_DIMENSION_MM, MAX_SLENDERNESS_RATIO } from '../../types/column-types';

/** Constructible module στρογγυλοποίησης διάστασης κολώνας (mm). */
const COLUMN_DIMENSION_MODULE_MM = 50;

/**
 * ADR-503 — όριο **ανηγμένου αξονικού** `ν_d = N_Ed/(A_c·f_cd)` για ορθογώνια κολώνα
 * (EC8 §5.4.3.2.1, DCM). Η πύλη που το παλιό grow-only ΔΕΝ χρειαζόταν (μεγάλες διατομές
 * την περνούσαν τετριμμένα) αλλά γίνεται **κρίσιμη στο shrink**: χωρίς αυτήν, ο two-way
 * sizer θα μίκραινε μια κολώνα ως το reinforcement-fit ελάχιστο, παραβιάζοντας το ν (EC8).
 * DCH (0.55) / provider-driven per ductility = DEFER (conservative DCM v1).
 */
const MAX_AXIAL_LOAD_RATIO = 0.65;

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
 * Είναι ΕΠΑΡΚΗΣ μια **τετράγωνη** trial διατομή `s×s`; Ελέγχει ΤΑΥΤΟΧΡΟΝΑ:
 *   (α) **ανηγμένο αξονικό** `ν = N_Ed/(A_c·f_cd) ≤ MAX_AXIAL_LOAD_RATIO` (EC8, η πύλη που
 *       κάνει το shrink ασφαλές — ίδιο `f_cd` SSoT με το `asStrengthColumnMm2`)·
 *   (β) **χωράει ο διαμήκης οπλισμός** `As,req ≤ ρ_max·A_c`.
 * Ξαναχτίζει το context για την trial **τετράγωνη** διατομή `s×s` (ΟΧΙ `max(orig,s)` —
 * two-way: η αναζήτηση ξεκινά από το κάτω φράγμα κι ανεβαίνει στο **ελάχιστο επαρκές**,
 * ώστε μια υπερδιαστασιολογημένη κολώνα να μπορεί να μικρύνει).
 */
function columnSectionFits(
  provider: StructuralCodeProvider,
  baseParams: ColumnParams,
  femMomentKnm: number | undefined,
  sMm: number,
): boolean {
  const ctx = buildColumnSectionContextFromParams({ ...baseParams, width: sMm, depth: sMm }, femMomentKnm);
  // (α) όριο ανηγμένου αξονικού (EC8) — N_Ed σε N· f_cd·A_c = αντοχή θλίψης σκυροδέματος.
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
  const nEdN = Math.max(0, ctx.designAxialKn ?? 0) * 1000;
  if (nEdN > MAX_AXIAL_LOAD_RATIO * fcd * ctx.grossAreaMm2) return false;
  // (β) χωράει ο οπλισμός.
  const maxRatio = provider.columnReinforcementLimits(ctx, COLUMN_FIT_PROBE_DIAMETER_MM).maxRatio;
  if (maxRatio <= 0) return true;
  return asStrengthColumnMm2(ctx) <= maxRatio * ctx.grossAreaMm2;
}

/**
 * Πρόταση **ελάχιστης επαρκούς** διατομής ορθογώνιας κολώνας — **two-way** (ADR-503): η
 * διάσταση **μεγαλώνει** όταν υποδιαστασιολογείται **ΚΑΙ μικραίνει** όταν υπερδιαστασιολογείται,
 * ώστε μηδέν σπατάλη υλικού (ο αρχιτέκτονας βάζει default 400×400 χωρίς στατικά). `undefined`
 * όταν δεν εφαρμόζεται (μη-ορθογώνια) ⇒ ο caller κρατά τη stored διατομή. Η `femMomentKnm` =
 * η ροπή σχεδιασμού του φορέα (ADR-491/502· πρόβολος → `wL²/2`) που υπερισχύει της ονομαστικής e₀.
 *
 * Το ελάχιστο επαρκές `s` (πολλαπλάσιο 50mm) ικανοποιεί ΤΑΥΤΟΧΡΟΝΑ: ν≤0.65 (EC8) + οπλισμός
 * (`columnSectionFits`) + λυγηρότητα (`s ≥ height/30`) + `MIN_COLUMN_DIMENSION_MM` (EC8 250mm).
 *
 * **Scope two-way v1:** ΜΟΝΟ **τετράγωνες** (`width===depth`, default παλέτας). Μη-τετράγωνες
 * (ρητή αρχιτεκτονική πρόθεση) → **grow-only** (διατηρεί aspect ratio· proportional shrink = DEFER).
 * **Convergence-safe:** στο ντετερμινιστικό takedown η ζήτηση δεν εξαρτάται από τη δική της
 * δυσκαμψία — μόνο γεωμετρία + ίδιο βάρος (μικρό κλάσμα) → μονότονη σύγκλιση, μηδέν ταλάντωση.
 */
export function suggestColumnSection(
  provider: StructuralCodeProvider,
  params: ColumnParams,
  femMomentKnm?: number,
): ColumnSizing | undefined {
  if (params.kind !== 'rectangular') return undefined;

  const slenderMinMm = MAX_SLENDERNESS_RATIO > 0 ? params.height / MAX_SLENDERNESS_RATIO : 0;
  const floorMm = roundUpToModule(Math.max(slenderMinMm, MIN_COLUMN_DIMENSION_MM), COLUMN_DIMENSION_MODULE_MM);

  let s = floorMm;
  let grewForStrength = false;
  while (s < MAX_PRACTICAL_COLUMN_DIMENSION_MM && !columnSectionFits(provider, params, femMomentKnm, s)) {
    s += COLUMN_DIMENSION_MODULE_MM;
    grewForStrength = true;
  }
  s = Math.min(s, MAX_PRACTICAL_COLUMN_DIMENSION_MM);

  const governedBy: ColumnSizingGovernedBy = grewForStrength
    ? 'reinforcement'
    : slenderMinMm > MIN_COLUMN_DIMENSION_MM ? 'slenderness' : 'minimum';

  // ADR-503 — τετράγωνη → two-way (μεγαλώνει/μικραίνει στο ελάχιστο επαρκές `s×s`)·
  // μη-τετράγωνη → grow-only (διατηρεί την αρχιτεκτονική αναλογία, μηδέν surprise squaring).
  return params.width === params.depth
    ? { widthMm: s, depthMm: s, governedBy }
    : { widthMm: Math.max(params.width, s), depthMm: Math.max(params.depth, s), governedBy };
}

/**
 * ADR-499 (Slice D) — είναι η **ορθογώνια** κολώνα ανέφικτη στο πρακτικό μέγιστο; (ο
 * διαμήκης οπλισμός δεν χωρά: `As,req > ρ_max·A_c` ακόμη και στη
 * `MAX_PRACTICAL_COLUMN_DIMENSION_MM`). Τότε ο οργανισμός κλιμακώνει σε diagnostic
 * «ανέφικτο» (`feasibility-checks`). Μη-ορθογώνια (DEFER auto-size) → `false` (no-op).
 * Reuse του ΙΔΙΟΥ `columnSectionFits` @max → μηδέν διπλό κριτήριο `As≤ρ_max·A_c`.
 */
export function isColumnInfeasibleAtMaxSection(
  provider: StructuralCodeProvider,
  params: ColumnParams,
  femMomentKnm?: number,
): boolean {
  if (params.kind !== 'rectangular') return false;
  return !columnSectionFits(provider, params, femMomentKnm, MAX_PRACTICAL_COLUMN_DIMENSION_MM);
}
