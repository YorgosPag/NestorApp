/**
 * member-sizing — SSoT αυτόματης διαστασιολόγησης διατομής δομικού μέλους
 * (ADR-475 — Serviceability-Driven, Revit-grade).
 *
 * Mirror της φιλοσοφίας του `footing-design/suggest-pad-dimensions.ts` (auto-sizing
 * πεδίλου): pure function που επιστρέφει την **ελάχιστη επαρκή** διατομή ώστε να
 * ικανοποιούνται ΤΑΥΤΟΧΡΟΝΑ:
 *   1. SLS βέλος (EC2 §7.4.2 Table 7.4N) — `d_req = span / (l/d)_limit`, το όριο
 *      ανά συνθήκη στήριξης από τον code provider (`beamSpanDepthLimit`).
 *   2. ULS κάμψη — η διατομή πρέπει να χωρά τον εφελκυόμενο οπλισμό: `ρ ≤ ρ_max`
 *      ⇒ `d² ≥ M_Ed/(z·f_yd·b·ρ_max)` (αλλιώς υπερ-οπλισμένη → αύξηση ύψους).
 *   3. ULS διάτμηση — ο θλιπτήρας δεν συνθλίβεται: `V_Ed ≤ V_Rd,max` ⇒ section
 *      adequacy (απλοποιημένο EC2 §6.2.3, θ=45°).
 * Τελικό ύψος = max(όλων) ∨ `MIN_BEAM_DEPTH_MM`, στρογγυλεμένο προς τα πάνω σε
 * constructible module (50 mm), με πρακτικό άνω φράγμα (belt-and-suspenders: αν το
 * φράγμα κόψει την απαίτηση, ο validator κρατά code-violation).
 *
 * **Width-aware (ADR-506):** όταν η απαιτούμενη βάθος ξεπερνά το **πρακτικό όριο ΝΟΚ**
 * (`ctx.practicalDepthLimitMm` = ύψος ορόφου − ελεύθερο ύψος κάτω από δοκό για κούφωμα/
 * πόρτα, SSoT `clear-height-under-beam`), ο sizer **φαρδαίνει** two-way το πλάτος στο
 * ελάχιστο επαρκές αντί να βαθαίνει άλλο — με άνω όριο το `ctx.maxWidthMm` (πλάτος
 * στηρίζουσας κολώνας). **Μονόδρομο:** η κολώνα ΔΕΝ μεγαλώνει — αν δεν χωρά ούτε στο cap,
 * επιστρέφει `'width-capped'` (υπερβολικό άνοιγμα → ADR-504 πρόταση ενδιάμεσης κολώνας).
 * Width-sizing ενεργοποιείται ΜΟΝΟ όταν ο caller δώσει `maxWidthMm` + `widthAutoSized !== false`·
 * αλλιώς **depth-only** (legacy, μηδέν regression).
 *
 * REUSE (μηδέν duplicate μηχανικής, N.0.2): `spanMomentDivisor`,
 * `BEAM_EFFECTIVE_DEPTH_FACTOR`, `BEAM_LEVER_ARM_FACTOR` (suggest-reinforcement SSoT),
 * `rebarFydMpa`, `concreteFcdMpa`. Pure — zero React/DOM/Firestore. Όλα σε mm.
 *
 * **Member-generic σχεδίαση:** το `BeamSizing`/`suggestBeamSection` είναι το πρώτο
 * μέλος· η κολόνα (slenderness EC2 §5.8 + αξονικό) θα προστεθεί ως αδελφή entry
 * χωρίς αναδόμηση (ADR-475 §4 DEFER).
 *
 * @see ../footing-design/suggest-pad-dimensions.ts — το προηγούμενο auto-sizing pattern
 * @see ../codes/structural-code-types.ts — `beamSpanDepthLimit` (serviceability)
 * @see docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md
 */

import { DEFAULT_CONCRETE_GRADE, concreteFcdMpa } from '../concrete-grades';
import { rebarFydMpa } from '../rebar-catalog';
import {
  BEAM_EFFECTIVE_DEPTH_FACTOR,
  BEAM_LEVER_ARM_FACTOR,
  spanMomentDivisor,
} from '../codes/suggest-reinforcement';
import type { BeamSectionContext, StructuralCodeProvider } from '../codes/structural-code-types';
import { MIN_BEAM_DEPTH_MM } from '../../types/beam-types';
import { plasticTorsionalResistanceKnm, shearTorsionUtilization } from '../codes/torsion-capacity';
import { roundUpToModule, roundDownToModule } from './module-rounding';

/** Constructible module στρογγυλοποίησης ύψους (mm). */
const BEAM_DEPTH_MODULE_MM = 50;

/** Constructible module στρογγυλοποίησης πλάτους (mm) — ADR-506. */
const BEAM_WIDTH_MODULE_MM = 50;

/** Πρακτικό άνω φράγμα ύψους δοκαριού (mm) — guard έναντι εκφυλισμένης εισόδου. */
export const BEAM_MAX_PRACTICAL_DEPTH_MM = 1500;

/**
 * Συντελεστής V_Rd,max (θλιπτήρας σκυροδέματος, EC2 §6.2.3 με θ=45°, ν₁≈0.6,
 * z=0.9·d): `V_Rd,max = 0.5·ν₁·f_cd·b·z = 0.27·f_cd·b·d`. ⇒ d_req = V_Ed/(0.27·f_cd·b).
 */
const VRD_MAX_COEFF = 0.27;

const KN_TO_N = 1000;
const MM_PER_M = 1000;

/** Ποιος έλεγχος καθόρισε την τελική διατομή (διαγνωστικό/τεκμηρίωση). */
export type BeamSizingGovernedBy =
  | 'serviceability'
  | 'flexure'
  | 'shear'
  | 'torsion'
  | 'minimum'
  /** ADR-506 — το πλάτος έφτασε το cap (κολώνα) χωρίς να χωρά: υπερβολικό άνοιγμα → ADR-504 advisory. */
  | 'width-capped';

/** Προτεινόμενη διατομή δοκαριού (depth-driven· width αμετάβλητο v1). */
export interface BeamSizing {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly governedBy: BeamSizingGovernedBy;
}

/** SLS βέλος (EC2 §7.4.2): ελάχιστο h ώστε span/d_eff ≤ όριο κώδικα. */
function serviceabilityDepthMm(ctx: BeamSectionContext, provider: StructuralCodeProvider): number {
  const limit = provider.beamSpanDepthLimit(ctx);
  if (limit <= 0 || ctx.spanMm <= 0) return 0;
  return ctx.spanMm / limit / BEAM_EFFECTIVE_DEPTH_FACTOR;
}

/** Ροπή σχεδιασμού ανοίγματος M_Ed (N·mm) από UDL w_Ed· 0 χωρίς φορτίο/άνοιγμα. */
function designMomentNmm(ctx: BeamSectionContext): number {
  const w = ctx.designLineLoadKnM ?? 0;
  if (w <= 0 || ctx.spanMm <= 0) return 0;
  const spanM = ctx.spanMm / MM_PER_M;
  return ((w * spanM * spanM) / spanMomentDivisor(ctx.supportType)) * 1e6;
}

/**
 * ULS κάμψη: ελάχιστο h ώστε ρ ≤ ρ_max (d² ≥ M_Ed/(z·f_yd·b·ρ_max)). ADR-506 — `widthMm`
 * παραμετρικό (default `ctx.widthMm`) ώστε ο width-search να δοκιμάζει υποψήφια πλάτη.
 */
function flexuralDepthMm(ctx: BeamSectionContext, maxRatio: number, widthMm = ctx.widthMm): number {
  const mEdNmm = designMomentNmm(ctx);
  if (mEdNmm <= 0 || widthMm <= 0 || maxRatio <= 0) return 0;
  const dSq = mEdNmm / (BEAM_LEVER_ARM_FACTOR * rebarFydMpa() * widthMm * maxRatio);
  return Math.sqrt(Math.max(0, dSq)) / BEAM_EFFECTIVE_DEPTH_FACTOR;
}

/**
 * Τέμνουσα σχεδιασμού V_Ed (kN) στη στήριξη από το UDL `w_Ed`: αμφιέρειστη/αμφίπακτη
 * αντίδραση `w·L/2`· πρόβολος `w·L` (στην πάκτωση). ΕΝΑ SSoT — μοιράζονται ο έλεγχος
 * διάτμησης (`shearDepthMm`) και ο έλεγχος αλληλεπίδρασης διάτμησης-στρέψης (`torsionDepthMm`).
 */
function designShearKn(ctx: BeamSectionContext): number {
  const w = ctx.designLineLoadKnM ?? 0;
  if (w <= 0 || ctx.spanMm <= 0) return 0;
  const spanM = ctx.spanMm / MM_PER_M;
  return w * spanM * (ctx.supportType === 'cantilever' ? 1 : 0.5);
}

/** V_Rd,max (kN) θλιπτήρα σκυροδέματος για διατομή `b × depth` (EC2 §6.2.3, z=0.9·d). */
function shearResistanceKn(widthMm: number, depthMm: number, fcdMpa: number): number {
  const dMm = depthMm * BEAM_EFFECTIVE_DEPTH_FACTOR;
  return (VRD_MAX_COEFF * fcdMpa * widthMm * dMm) / KN_TO_N;
}

/** ULS διάτμηση: ελάχιστο h ώστε V_Ed ≤ V_Rd,max (θλιπτήρας). ADR-506 — `widthMm` παραμετρικό. */
function shearDepthMm(ctx: BeamSectionContext, widthMm = ctx.widthMm): number {
  const vEdKn = designShearKn(ctx);
  if (vEdKn <= 0 || widthMm <= 0) return 0;
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
  if (fcd <= 0) return 0;
  return (vEdKn * KN_TO_N) / (VRD_MAX_COEFF * fcd * widthMm) / BEAM_EFFECTIVE_DEPTH_FACTOR;
}

/**
 * ADR-499 §6.3-b — ULS αλληλεπίδραση **διάτμησης-στρέψης** (EC2 §6.3.2(4)): ελάχιστο ύψος h
 * ώστε `T_Ed/T_Rd,max(b,h) + V_Ed/V_Rd,max(b,h) ≤ 1` (ο λοξός θλιπτήρας δεν συνθλίβεται από
 * τον συνδυασμό). **Iterative** (το `T_Rd,max` είναι μη-γραμμικό στο h — ισοδύναμος σωλήνας
 * `A_k·t_ef`, όπως ο grow της κολώνας B2): δοκιμάζει ύψη ανά module (50 mm) από το ελάχιστο ως
 * το πρακτικό μέγιστο. Ανέφικτο ακόμη και στο μέγιστο → επιστρέφει `BEAM_MAX_PRACTICAL_DEPTH_MM`
 * (ο έλεγχος εφικτότητας — Slice D — το εκδίδει ως error). Μηδέν στρέψη → `0` (κανένα candidate).
 */
function torsionDepthMm(ctx: BeamSectionContext, widthMm = ctx.widthMm): number {
  const tEdKnm = ctx.designTorsionKnm ?? 0;
  if (tEdKnm <= 0 || widthMm <= 0) return 0;
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
  if (fcd <= 0) return 0;
  const vEdKn = designShearKn(ctx);
  const b = widthMm;
  for (let depth = MIN_BEAM_DEPTH_MM; depth <= BEAM_MAX_PRACTICAL_DEPTH_MM; depth += BEAM_DEPTH_MODULE_MM) {
    const tRdMaxKnm = plasticTorsionalResistanceKnm(b, depth, fcd);
    const vRdMaxKn = shearResistanceKn(b, depth, fcd);
    if (shearTorsionUtilization(tEdKnm, tRdMaxKnm, vEdKn, vRdMaxKn) <= 1) return depth;
  }
  return BEAM_MAX_PRACTICAL_DEPTH_MM;
}

/**
 * Raw (προ-clamp/προ-rounding) ελάχιστο επαρκές ύψος για δεδομένο πλάτος `widthMm`: το max
 * όλων των ελέγχων (serviceability / flexure / shear / torsion) ∨ `MIN_BEAM_DEPTH_MM`. ADR-506
 * — το πλάτος είναι παράμετρος ώστε ο width-search να ξανα-υπολογίζει ανά υποψήφιο πλάτος.
 */
function requiredDepthRaw(
  ctx: BeamSectionContext,
  provider: StructuralCodeProvider,
  maxRatio: number,
  widthMm: number,
): { raw: number; governedBy: BeamSizingGovernedBy } {
  const candidates: ReadonlyArray<{ raw: number; governedBy: BeamSizingGovernedBy }> = [
    { raw: MIN_BEAM_DEPTH_MM, governedBy: 'minimum' },
    { raw: serviceabilityDepthMm(ctx, provider), governedBy: 'serviceability' },
    { raw: flexuralDepthMm(ctx, maxRatio, widthMm), governedBy: 'flexure' },
    { raw: shearDepthMm(ctx, widthMm), governedBy: 'shear' },
    // ADR-499 §6.3-b — αλληλεπίδραση διάτμησης-στρέψης από μονόπλευρη πρόβολο-πλάκα.
    { raw: torsionDepthMm(ctx, widthMm), governedBy: 'torsion' },
  ];
  return candidates.reduce((a, b) => (b.raw > a.raw ? b : a));
}

/** Το ενεργό άνω όριο ύψους (mm): πρακτικό μέγιστο ∧ δυναμικό όριο ΝΟΚ (αν δοθεί). ADR-506. */
function effectiveDepthCap(ctx: BeamSectionContext): number {
  return Math.min(BEAM_MAX_PRACTICAL_DEPTH_MM, ctx.practicalDepthLimitMm ?? Infinity);
}

/**
 * ADR-506 — διαστασιολόγηση με ΣΤΑΘΕΡΟ πλάτος (`ctx.widthMm`): depth-only (legacy + NOK cap).
 * Κλειδωμένο ύψος (`depthAutoSized === false`) → κρατά το stored `depthMm`.
 */
function sizeFixedWidth(ctx: BeamSectionContext, provider: StructuralCodeProvider, maxRatio: number): BeamSizing {
  const { raw, governedBy } = requiredDepthRaw(ctx, provider, maxRatio, ctx.widthMm);
  const depthMm =
    ctx.depthAutoSized === false
      ? ctx.depthMm
      : Math.min(effectiveDepthCap(ctx), roundUpToModule(raw, BEAM_DEPTH_MODULE_MM));
  return { widthMm: ctx.widthMm, depthMm, governedBy };
}

/**
 * ADR-506 — two-way width search: το **ελάχιστο** πλάτος (module 50) στο
 * `[MIN_BEAM_WIDTH_MM, cap]` ώστε το απαιτούμενο ύψος να χωρά στο `effectiveDepthCap`
 * (cap = πλάτος στηρίζουσας κολώνας, στρογγ. προς τα κάτω). Κανένα δεν χωρά → `cap` + ύψος
 * clamped + `'width-capped'` (υπερβολικό άνοιγμα → ADR-504 ενδιάμεση κολώνα· η κολώνα ΔΕΝ μεγαλώνει).
 */
function sizeWidthFree(ctx: BeamSectionContext, provider: StructuralCodeProvider, maxRatio: number): BeamSizing {
  const depthCap = effectiveDepthCap(ctx);
  // ADR-506 — κάτω όριο πλάτους από τον ΕΝΕΡΓΟ κώδικα (ΕΚ8/ΕΚΩΣ→200, EC2→150), ΟΧΙ σταθερό:
  // το two-way shrink δεν πέφτει ποτέ κάτω από το ελάχιστο του κανονισμού («πλήρως ΕΚ8»).
  const minWidth = provider.beamMinWidthMm();
  const cap = Math.max(minWidth, roundDownToModule(ctx.maxWidthMm ?? ctx.widthMm, BEAM_WIDTH_MODULE_MM));
  const depthLocked = ctx.depthAutoSized === false;
  for (let w = minWidth; w <= cap; w += BEAM_WIDTH_MODULE_MM) {
    const { raw, governedBy } = requiredDepthRaw(ctx, provider, maxRatio, w);
    if (depthLocked) {
      if (ctx.depthMm >= raw) return { widthMm: w, depthMm: ctx.depthMm, governedBy };
      continue;
    }
    const depthMm = roundUpToModule(raw, BEAM_DEPTH_MODULE_MM);
    if (depthMm <= depthCap) return { widthMm: w, depthMm, governedBy };
  }
  const { raw } = requiredDepthRaw(ctx, provider, maxRatio, cap);
  const depthMm = depthLocked ? ctx.depthMm : Math.min(depthCap, roundUpToModule(raw, BEAM_DEPTH_MODULE_MM));
  return { widthMm: cap, depthMm, governedBy: 'width-capped' };
}

/**
 * Πρόταση ελάχιστης επαρκούς διατομής δοκαριού (ύψος ∨ ύψος+πλάτος). **Width-sizing
 * ενεργοποιείται** μόνο όταν δοθεί `ctx.maxWidthMm` (cap κολώνας) ΚΑΙ `widthAutoSized !== false`
 * → two-way `sizeWidthFree`. Αλλιώς **depth-only** `sizeFixedWidth` (legacy· locked width ∨
 * graphless caller). `governedBy` = ο έλεγχος που καθόρισε το raw ύψος (∨ `'width-capped'`).
 */
export function suggestBeamSection(
  provider: StructuralCodeProvider,
  ctx: BeamSectionContext,
): BeamSizing {
  const maxRatio = provider.beamReinforcementLimits(ctx, 16).maxRatio;
  const widthFree = ctx.maxWidthMm !== undefined && ctx.widthAutoSized !== false;
  return widthFree ? sizeWidthFree(ctx, provider, maxRatio) : sizeFixedWidth(ctx, provider, maxRatio);
}
