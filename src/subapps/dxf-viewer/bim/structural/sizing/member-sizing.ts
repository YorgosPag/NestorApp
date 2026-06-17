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
 * **Depth-only (v1):** το `width` είναι αρχιτεκτονική επιλογή του μηχανικού →
 * αμετάβλητο (η διάτμηση οδηγεί ΥΨΟΣ, όχι πλάτος — width-bump = DEFER).
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

/** Constructible module στρογγυλοποίησης ύψους (mm). */
const BEAM_DEPTH_MODULE_MM = 50;

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
export type BeamSizingGovernedBy = 'serviceability' | 'flexure' | 'shear' | 'minimum';

/** Προτεινόμενη διατομή δοκαριού (depth-driven· width αμετάβλητο v1). */
export interface BeamSizing {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly governedBy: BeamSizingGovernedBy;
}

function roundUpToModule(value: number, module: number): number {
  return Math.ceil(value / module) * module;
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

/** ULS κάμψη: ελάχιστο h ώστε ρ ≤ ρ_max (d² ≥ M_Ed/(z·f_yd·b·ρ_max)). */
function flexuralDepthMm(ctx: BeamSectionContext, maxRatio: number): number {
  const mEdNmm = designMomentNmm(ctx);
  if (mEdNmm <= 0 || ctx.widthMm <= 0 || maxRatio <= 0) return 0;
  const dSq = mEdNmm / (BEAM_LEVER_ARM_FACTOR * rebarFydMpa() * ctx.widthMm * maxRatio);
  return Math.sqrt(Math.max(0, dSq)) / BEAM_EFFECTIVE_DEPTH_FACTOR;
}

/** ULS διάτμηση: ελάχιστο h ώστε V_Ed ≤ V_Rd,max (θλιπτήρας). */
function shearDepthMm(ctx: BeamSectionContext): number {
  const w = ctx.designLineLoadKnM ?? 0;
  if (w <= 0 || ctx.spanMm <= 0 || ctx.widthMm <= 0) return 0;
  const spanM = ctx.spanMm / MM_PER_M;
  // UDL αντίδραση: αμφιέρειστη/αμφίπακτη V=w·L/2· πρόβολος V=w·L (στην πάκτωση).
  const vEdN = w * spanM * (ctx.supportType === 'cantilever' ? 1 : 0.5) * KN_TO_N;
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
  if (fcd <= 0) return 0;
  return vEdN / (VRD_MAX_COEFF * fcd * ctx.widthMm) / BEAM_EFFECTIVE_DEPTH_FACTOR;
}

/**
 * Πρόταση ελάχιστης επαρκούς διατομής δοκαριού. Επιστρέφει την κυρίαρχη απαίτηση
 * (max των ελέγχων ∨ ελάχιστο), στρογγυλεμένη σε module 50 mm και clamped στο
 * πρακτικό μέγιστο. `governedBy` = ο έλεγχος που καθόρισε το raw ύψος (προ-clamp).
 */
export function suggestBeamSection(
  provider: StructuralCodeProvider,
  ctx: BeamSectionContext,
): BeamSizing {
  const maxRatio = provider.beamReinforcementLimits(ctx, 16).maxRatio;
  const candidates: ReadonlyArray<{ raw: number; governedBy: BeamSizingGovernedBy }> = [
    { raw: MIN_BEAM_DEPTH_MM, governedBy: 'minimum' },
    { raw: serviceabilityDepthMm(ctx, provider), governedBy: 'serviceability' },
    { raw: flexuralDepthMm(ctx, maxRatio), governedBy: 'flexure' },
    { raw: shearDepthMm(ctx), governedBy: 'shear' },
  ];
  const winner = candidates.reduce((a, b) => (b.raw > a.raw ? b : a));
  const depthMm = Math.min(
    BEAM_MAX_PRACTICAL_DEPTH_MM,
    roundUpToModule(winner.raw, BEAM_DEPTH_MODULE_MM),
  );
  return { widthMm: ctx.widthMm, depthMm, governedBy: winner.governedBy };
}
