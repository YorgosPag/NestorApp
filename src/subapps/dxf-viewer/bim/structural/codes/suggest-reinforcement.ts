/**
 * Shared default-reinforcement suggester (ADR-456 — Στατικά, Slice 1B).
 *
 * SSoT for «δώσε μου έναν έγκυρο ελάχιστο οπλισμό για αυτή τη διατομή». Both
 * code providers delegate here so the bar-selection algorithm lives in ONE place
 * (boy-scout / N.0.2) — only the LIMITS differ per code, never the algorithm.
 *
 * @see ./structural-code-types.ts
 */

import {
  barAreaMm2,
  nextRebarDiameterMm,
  rebarFydMpa,
} from '../rebar-catalog';
import { concreteFcdMpa, DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import { flexuralCapacityCapFactor, limitMomentNmm } from './flexural-capacity';
import { torsionTubeProperties } from './torsion-capacity';
import { rectRestrainedBarIntervals } from '../reinforcement/column-reinforcement-types';
import { isWallReinforcementMode } from '../reinforcement/column-section-outline';
import type { BeamSupportType } from '../../types/beam-types';
import type {
  ColumnReinforcement,
  ColumnStirrups,
  StirrupType,
  WallReinforcementIntent,
} from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement, BeamStirrups } from '../reinforcement/beam-reinforcement-types';
import type {
  BeamReinforcementLimits,
  BeamSectionContext,
  ColumnReinforcementLimits,
  ColumnSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';

/** Άνω φράγμα ασφαλείας πλήθους διαμήκων (αποφυγή runaway σε εκφυλισμένη είσοδο). */
const MAX_LONGITUDINAL_BARS = 200;

/** Στρογγυλοποίηση βήματος συνδετήρων προς τα κάτω στο πλησιέστερο 25mm (πρακτικό). */
function roundSpacingDown(spacingMm: number): number {
  return Math.max(50, Math.floor(spacingMm / 25) * 25);
}

/**
 * Πλήθος περιμετρικών διαμήκων ράβδων ώστε η απόσταση μεταξύ διαδοχικών
 * **συγκρατημένων** ράβδων να ΜΗΝ ξεπερνά `maxBarSpacingMm` σε καμία πλευρά
 * (EC8 §5.4.3.2.2(11) / ΕΑΚ): ορθογώνιο = 2·⌈W/s⌉ + 2·⌈D/s⌉ (συμπεριλ. γωνιών).
 * Μικτές διαστάσεις (συντηρητικό: το core span είναι μικρότερο → πραγματική
 * απόσταση ≤ s). Ελάχιστο 4 (μία ανά γωνία) όταν s ≤ 0.
 */
function spacingBarCount(ctx: ColumnSectionContext, maxBarSpacingMm: number): number {
  if (maxBarSpacingMm <= 0) return 4;
  // ADR-460 — shape-aware: όταν δίνεται περίμετρος outline (μη-ορθογ./κυκλική),
  // πλήθος = ⌈περίμετρος/βήμα⌉ (μία ράβδος κάθε ≤ βήμα γύρω από το περίγραμμα).
  if (ctx.perimeterMm && ctx.perimeterMm > 0) {
    return Math.max(4, Math.ceil(ctx.perimeterMm / maxBarSpacingMm));
  }
  // ΚΟΙΝΟΣ κανόνας βήματος (SSoT) — ίδιος με το geometry layout (distributeRectBarsBySpacing).
  const { nW, nD } = rectRestrainedBarIntervals(ctx.widthMm, ctx.depthMm, maxBarSpacingMm);
  return 2 * nW + 2 * nD;
}

/**
 * SSoT bar-selection core (N.0.2 — μοιράζεται κολόνα + δοκάρι): δεδομένης
 * απαιτούμενης As, αρχικού πλήθους & seed διαμέτρου, επιστρέφει {count, diameter}
 * ώστε `count·area(diameter) ≥ asRequired`. Πρώτα ανεβαίνει η διάμετρος στις
 * εμπορικές τιμές· αν κορεστεί η μέγιστη, προστίθενται ράβδοι ανά `addStep`.
 */
export function resolveBarSet(
  asRequiredMm2: number,
  initialCount: number,
  seedDiameterMm: number,
  addStep = 2,
): { count: number; diameterMm: number } {
  let count = initialCount;
  let diameterMm = seedDiameterMm;
  while (count * barAreaMm2(diameterMm) < asRequiredMm2) {
    const next = nextRebarDiameterMm(diameterMm + 1);
    if (next === diameterMm) break; // έφτασε στη μέγιστη εμπορική
    diameterMm = next;
  }
  while (count * barAreaMm2(diameterMm) < asRequiredMm2 && count < MAX_LONGITUDINAL_BARS) {
    count += addStep;
  }
  return { count, diameterMm };
}

/** kN → N (φορτίο context σε kN, αντοχές υλικών σε N/mm² = MPa). */
export const KN_TO_N = 1000;

/** EC2 §6.1(4) — κατώφλι ονομαστικής εκκεντρότητας e₀ (mm): e₀ ≥ 20 mm. */
export const NOMINAL_ECCENTRICITY_FLOOR_MM = 20;

/** EC2 §6.1(4) — διαιρέτης βάθους για e₀ ≥ h/30. */
const NOMINAL_ECCENTRICITY_DEPTH_DIVISOR = 30;

/** Κολόνα: ενεργό βάθος d ≈ factor·h (cover-agnostic seed, mirror δοκού). */
const COLUMN_EFFECTIVE_DEPTH_FACTOR = 0.9;

/** Κολόνα: μοχλοβραχίονας z ≈ factor·d (απλοποιημένο EC2 §6.1 κάμψη, ορθογ./περιμετρική). */
const COLUMN_LEVER_ARM_FACTOR = 0.9;

/**
 * ADR-493 — ΚΥΚΛΙΚΗ διατομή: μοχλοβραχίονας ισοδύναμου πλαστικού δακτυλίου χάλυβα. Ένας
 * πλήρως διαρρέων δακτύλιος ολικού εμβαδού A_s σε διάμετρο D_s δίνει M = A_s·f_yd·(D_s/π)
 * → **z = D_s/π** (≈ 0.27·d), ΠΟΛΥ μικρότερος από τον ορθογώνιο 0.81·d (όπου ο οπλισμός
 * συγκεντρώνεται σε δύο παρειές). Χρήση του 0.81·d σε κύκλο ΥΠΕΡΕΚΤΙΜΑ το z → υποεκτιμά
 * το A_s,M (μη-συντηρητικό). `D_s ≈ pitch-circle ≈ 0.85·d` (cover-agnostic seed, mirror
 * του `COLUMN_EFFECTIVE_DEPTH_FACTOR`). EC2 §6.1 / §9.5.2 (circular interaction).
 */
const CIRCULAR_PITCH_DIAMETER_FACTOR = 0.85;

/**
 * Μοχλοβραχίονας εσωτερικών δυνάμεων κολόνας (mm) ανά τρόπο διατομής (SSoT): κυκλική →
 * πλαστικός δακτύλιος `D_s/π`· ορθογώνια/περιμετρική/τοίχωμα → `0.81·h` (0.9·d, d=0.9·h).
 */
function columnLeverArmMm(ctx: ColumnSectionContext, hMm: number): number {
  if (ctx.mode === 'circular') {
    return (CIRCULAR_PITCH_DIAMETER_FACTOR * hMm) / Math.PI;
  }
  return COLUMN_LEVER_ARM_FACTOR * COLUMN_EFFECTIVE_DEPTH_FACTOR * hMm;
}

/**
 * ADR-472 S4 — EC2 §6.1(4) ονομαστική (ελάχιστη) εκκεντρότητα `e₀ = max(h/30, 20mm)`
 * (mm). Καλύπτει ατέλειες κατασκευής + ελάχιστη σχεδιαστική ροπή· `h` = βάθος διατομής
 * στο επίπεδο κάμψης. Pure — ΕΝΑ SSoT (το μοιράζονται builder + όποιος consumer).
 */
export function nominalColumnEccentricityMm(sectionDepthMm: number): number {
  const h = sectionDepthMm > 0 ? sectionDepthMm : 0;
  return Math.max(h / NOMINAL_ECCENTRICITY_DEPTH_DIVISOR, NOMINAL_ECCENTRICITY_FLOOR_MM);
}

/**
 * ADR-472 S4 — **αυτόματη** ονομαστική ροπή σχεδιασμού `M_Ed = N_Ed·e₀` (kNm), μηδέν
 * input μηχανικού (Revit-grade). `e₀` από {@link nominalColumnEccentricityMm}. ≤0
 * αξονικό ⇒ 0 (μηδέν regression). Preliminary uniaxial — biaxial/λυγηρότητα = DEFER (§4).
 */
export function nominalColumnMomentKnm(nEdKn: number, sectionDepthMm: number): number {
  if (nEdKn <= 0) return 0;
  return (nEdKn * nominalColumnEccentricityMm(sectionDepthMm)) / 1000; // kN·mm → kNm
}

/**
 * ADR-472 S4 / ADR-493 — πρόσθετη As από **καμπτική** συνιστώσα κολόνας (steel couple):
 * A_s,M = M_Ed / (z·f_yd). Μοχλοβραχίονας `z` shape-aware (`columnLeverArmMm`): ορθογ./
 * περιμετρική `0.81·h`· **κυκλική `D_s/π`** (πλαστικός δακτύλιος, ADR-493). `h` = ελάχιστο
 * πάχος (ασθενής άξονας — conservative). Additive στην αξονική As (preliminary M-N· ΟΧΙ
 * πλήρες interaction diagram, ADR-472 §4). 0 χωρίς ροπή ⇒ μηδέν regression αξονικού σχεδ.
 */
function asMomentColumnMm2(ctx: ColumnSectionContext): number {
  const mEdKnm = ctx.designMomentKnm ?? 0;
  if (mEdKnm <= 0) return 0;
  const hMm = ctx.minThicknessMm ?? Math.min(ctx.widthMm, ctx.depthMm);
  // ADR-493 — circular → πλαστικός δακτύλιος (z=D_s/π)· αλλιώς ορθογώνιο 0.81·h.
  const zMm = columnLeverArmMm(ctx, hMm);
  if (zMm <= 0) return 0;
  return (mEdKnm * 1e6) / (zMm * rebarFydMpa());
}

/**
 * ADR-472 — απαιτούμενη As διαμήκους κολόνας από **αντοχή** (EC2 §6.1): αξονική
 * συνιστώσα `(N_Ed − α_cc·f_cd·A_c)/f_yd` (inversion του N_Rd· α_cc=1.0 ήδη στο
 * `concreteFcdMpa`) **+ καμπτική** συνιστώσα (S4, ονομαστική ροπή M_Ed). Επιστρέφει
 * ~0 όταν σκυρόδεμα+ελάχιστη ροπή επαρκούν ⇒ ο ρ_min κυριαρχεί (μηδέν regression χωρίς
 * φορτίο). Biaxial / λυγηρότητα (§5.8) / ικανοτικός σεισμικός = DEFER (ADR-472 §4).
 */
export function asStrengthColumnMm2(ctx: ColumnSectionContext): number {
  const nEdKn = ctx.designAxialKn ?? 0;
  // Η αξονική συνιστώσα μετρά μόνο σε θλίψη (N>0)· η **καμπτική** (ADR-491 — πρόβολος
  // → wL²/2 στη στήριξη) μετρά ΠΑΝΤΑ, ακόμη και με μηδενικό tributary αξονικό — αλλιώς η
  // στηρίζουσα κολώνα προβόλου έμενε ανεπαρκής, αντίθετα με το intent του resolveColumnDesignLoad.
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE); // N/mm²
  const asAxialMm2 = nEdKn > 0
    ? Math.max(0, (nEdKn * KN_TO_N - fcd * ctx.grossAreaMm2) / rebarFydMpa())
    : 0;
  return asAxialMm2 + asMomentColumnMm2(ctx);
}

/**
 * Επιλέγει πλήθος + εμπορική διάμετρο διαμήκων ώστε να ικανοποιούνται ΤΑΥΤΟΧΡΟΝΑ:
 * (α) απόσταση ≤ max-bar-spacing, (β) ρ ≥ ρ_min, (γ) ≥ minBarCount, (δ) ADR-472 —
 * As ≥ απαίτηση αντοχής όταν δίνεται αξονικό σχεδιασμού. Το πλήθος ξεκινά από την
 * περίσφιγξη (spacing) → reuse `resolveBarSet`.
 */
function resolveLongitudinalDesign(
  seed: ColumnReinforcementLimits,
  ctx: ColumnSectionContext,
): { count: number; diameterMm: number } {
  const asRequiredMm2 = Math.max(ctx.grossAreaMm2 * seed.minRatio, asStrengthColumnMm2(ctx));
  const initialCount = Math.max(seed.minBarCount, spacingBarCount(ctx, seed.maxBarSpacingMm));
  return resolveBarSet(asRequiredMm2, initialCount, nextRebarDiameterMm(seed.minBarDiameterMm));
}

/**
 * Επιλέγει ελάχιστο-έγκυρο διαμήκη + εγκάρσιο οπλισμό για τη διατομή, εγγυώμενος
 * ΚΑΙ ρ ≥ ρ_min ΚΑΙ απόσταση ≤ max-bar-spacing (δυναμικό πλήθος που κλιμακώνεται
 * με τη διατομή). Καλείται από κάθε provider μέσα στο `suggestColumnReinforcement`.
 */
export function suggestColumnReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: ColumnSectionContext,
): ColumnReinforcement {
  // ρ_min/count/minBarDiameter/maxBarSpacing/cover ανεξάρτητα της διαμέτρου → seed call.
  const seed = provider.columnReinforcementLimits(ctx, 16);
  const { count, diameterMm } = resolveLongitudinalDesign(seed, ctx);

  // Stirrup rules εξαρτώνται από την τελική διάμετρο διαμήκους → δεύτερο call.
  const limits = provider.columnReinforcementLimits(ctx, diameterMm);

  // ADR-493 — ΚΥΚΛΙΚΗ διατομή → συνεχής **σπείρα** (EC2 §9.5.3 / EC8 §5.4.3.2.2: η
  // προτιμώμενη περίσφιγξη κυκλικής, καλύτερη ductility)· ορθογ./λοιπά → DEFAULT (κλειστός
  // συνδετήρας). Reuse ΟΛΗΣ της υπάρχουσας spiral infra (layout/3Δ/detail/BOQ)· ο χρήστης
  // μπορεί να το override-άρει (manual → auto=false). spiralPitchMm absent ⇒ = spacingMm.
  const stirrupType: StirrupType | undefined = ctx.mode === 'circular' ? 'spiral' : undefined;
  const stirrups: ColumnStirrups = {
    diameterMm: limits.minStirrupDiameterMm,
    spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm),
    spacingCriticalMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    ...(stirrupType ? { type: stirrupType } : {}),
  };
  const base: ColumnReinforcement = {
    longitudinal: { diameterMm, count },
    stirrups,
    coverMm: limits.nominalCoverMm,
  };
  // ADR-460 — τοίχωμα: πρόσθεσε boundary elements + κατανεμημένο κορμό (EC8 §5.4.3.4).
  if (isWallReinforcementMode(ctx.mode)) {
    return { ...base, wall: suggestWallIntent(ctx, limits) };
  }
  return base;
}

/**
 * ADR-460 — προτεινόμενος οπλισμός τοιχώματος: κρυφοκολώνα (boundary element) ανά
 * άκρο διαστασιολογημένη ως μικρή κολώνα στη ζώνη `lc` (EC8 §5.4.3.4.2) + κατανεμημένος
 * οπλισμός κορμού (κατακόρυφος/οριζόντιος) στο μέγιστο βήμα. Reuse `resolveBarSet`.
 */
function suggestWallIntent(
  ctx: ColumnSectionContext,
  limits: ColumnReinforcementLimits,
): WallReinforcementIntent {
  const lw = ctx.maxDimensionMm ?? Math.max(ctx.widthMm, ctx.depthMm);
  const bw = ctx.minThicknessMm ?? Math.min(ctx.widthMm, ctx.depthMm);
  const lc = Math.min(Math.max(0.15 * lw, 1.5 * bw), 0.4 * lw);
  const asBoundaryMm2 = limits.minRatio * lc * bw;
  const seedDia = nextRebarDiameterMm(limits.minBarDiameterMm);
  const boundary = resolveBarSet(asBoundaryMm2, Math.max(6, limits.minBarCount), seedDia);
  return {
    boundary: { diameterMm: boundary.diameterMm, count: boundary.count },
    boundaryTieSpacingMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    webVertical: { diameterMm: limits.minBarDiameterMm, spacingMm: roundSpacingDown(limits.maxBarSpacingMm) },
    webHorizontal: { diameterMm: limits.minStirrupDiameterMm, spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm) },
  };
}

// ─── Beam suggester (ADR-459 Phase 4a) ───────────────────────────────────────

/** Μελετητική ενεργός διατομή d ≈ 0.9·h (cover/bar-agnostic seed για ρ). SSoT — reuse ADR-475 member-sizing. */
export const BEAM_EFFECTIVE_DEPTH_FACTOR = 0.9;

/** EC8 §5.4.3.1.2(5) — ο άνω οπλισμός κατά μήκος ≥ 0.25·κάτω (αναρτήρες). */
const BEAM_TOP_TO_BOTTOM_RATIO = 0.25;

/** Μοχλοβραχίονας εσωτερικών δυνάμεων z ≈ 0.9·d (απλοποιημένο EC2 §6.1 κάμψη). SSoT — reuse ADR-475. */
export const BEAM_LEVER_ARM_FACTOR = 0.9;

/**
 * Συντελεστής ροπής ανοίγματος M_Ed = w·L²/c υπό ομοιόμορφο φορτίο (UDL), ανά
 * συνθήκη στήριξης: αμφιέρειστη 8· αμφίπακτη 12 (ροπή στήριξης)· πρόβολος 2 (πάκτωση).
 * ADR-504 Φ2 — συνεχής δοκός 10: envelope ισαπεχουσών ανοιγμάτων, η hogging της 1ης
 * εσωτερικής στήριξης (≈ wL²/10) κυβερνά της sagging — preliminary/Revit-grade εφεδρεία
 * (η ακριβής λύση = FEM, ADR-481). SSoT — reuse ADR-475 member-sizing.
 */
export function spanMomentDivisor(supportType: BeamSupportType): number {
  switch (supportType) {
    case 'cantilever':
      return 2;
    case 'fixed':
      return 12;
    case 'continuous':
      return 10;
    default:
      return 8;
  }
}

/**
 * ADR-534 Φ3b — πλάτος **θλιβόμενης ζώνης** στον καμπτικό έλεγχο (EC2 §5.3.2.1 T-beam):
 * η **σαγκ. (θετική) ροπή** θλίβει το **πέλμα** (πλάκα) → `b_eff`· η **hogging** ροπή
 * στήριξης (συνεχής/αμφίπακτη/πρόβολος — όπου το `spanMomentDivisor` αντλεί την κρίσιμη
 * ροπή) θλίβει τον **κορμό** → `b_w`. Absent `b_eff` (γυμνή δοκός) ⇒ `b_w` (μηδέν regression).
 */
function flexuralCompressionWidthMm(ctx: BeamSectionContext): number {
  const flangeInCompression = ctx.supportType === 'simple';
  return flangeInCompression ? ctx.effectiveFlangeWidthMm ?? ctx.widthMm : ctx.widthMm;
}

/**
 * ADR-499 — ροπή σχεδιασμού ανοίγματος δοκαριού `M_Ed = w_Ed·L²/c` (N·mm) υπό UDL.
 * Extracted SSoT: τη μοιράζονται ο οπλισμός (`asStrengthBeamMm2`) και η φυσική πύλη
 * επάρκειας (`flexural-capacity`). 0 χωρίς γραμμικό φορτίο/άνοιγμα.
 */
export function beamDesignMomentNmm(ctx: BeamSectionContext): number {
  const wEd = ctx.designLineLoadKnM ?? 0;
  if (wEd <= 0 || ctx.spanMm <= 0) return 0;
  const spanM = ctx.spanMm / 1000;
  return ((wEd * spanM * spanM) / spanMomentDivisor(ctx.supportType)) * 1e6; // kNm→N·mm
}

/**
 * ADR-472 — απαιτούμενη As κάτω οπλισμού δοκαριού από **καμπτική αντοχή** (EC2 §6.1,
 * απλοποιημένος μοχλοβραχίονας z=0.9·d): M_Ed = w_Ed·L²/c, A_s = M_Ed/(z·f_yd).
 * Επιστρέφει 0 χωρίς γραμμικό φορτίο/άνοιγμα ⇒ ο ρ_min κυριαρχεί (μηδέν regression).
 * Χωρίς ανακατανομή ροπών (το όριο θλιβόμενης ζώνης = `flexural-capacity` cap, ADR-499).
 */
export function asStrengthBeamMm2(ctx: BeamSectionContext, effectiveDepthMm: number): number {
  if (effectiveDepthMm <= 0) return 0;
  const mEdNmm = beamDesignMomentNmm(ctx);
  if (mEdNmm <= 0) return 0;
  return mEdNmm / (BEAM_LEVER_ARM_FACTOR * effectiveDepthMm * rebarFydMpa());
}

/** ADR-499 §6.3-c — ο πρόσθετος στρεπτικός χάλυβας ορθογώνιας δοκού (EC2 §6.3.2). */
interface BeamTorsionSteel {
  /** Απαιτούμενη A_st/s κλειστού συνδετήρα **ανά μέτρο** (mm²/m) — μία κλειστή τοιχωμένη βρόχωση. */
  readonly stirrupAreaPerMetreMm2: number;
  /** Απαιτούμενο **ολικό** A_sl διαμήκους στρεπτικού χάλυβα γύρω από την περίμετρο (mm²). */
  readonly longitudinalAreaMm2: number;
}

/**
 * ADR-499 §6.3-c — στρεπτικός χάλυβας ορθογώνιας δοκού από `T_Ed` (EC2 §6.3.2, cotθ=1):
 *   · `A_st/s = T_Ed / (2·A_k·f_yd)`   (κλειστοί συνδετήρες· ανά μέτρο = ×1000)
 *   · `A_sl   = T_Ed·u_k / (2·A_k·f_yd)` (διαμήκεις γωνιακοί, ολικό)
 * Reuse `torsionTubeProperties` (A_k/u_k — ΕΝΑ SSoT με το `T_Rd,max`). `null` χωρίς στρέψη /
 * εκφυλισμένη διατομή ⇒ ο caller παράγει τον σημερινό code-min οπλισμό (μηδέν regression).
 */
function resolveBeamTorsionDemand(ctx: BeamSectionContext): BeamTorsionSteel | null {
  const tEdKnm = ctx.designTorsionKnm ?? 0;
  if (tEdKnm <= 0) return null;
  const tube = torsionTubeProperties(ctx.widthMm, ctx.depthMm);
  if (!tube) return null;
  const denom = 2 * tube.akMm2 * rebarFydMpa(); // cotθ=1
  if (denom <= 0) return null;
  const tEdNmm = tEdKnm * 1e6;
  return {
    stirrupAreaPerMetreMm2: (tEdNmm / denom) * 1000,
    longitudinalAreaMm2: (tEdNmm * tube.ukMm) / denom,
  };
}

/**
 * ADR-499 §6.3-c — κλειστοί συνδετήρες δοκού. Χωρίς στρέψη → code-minimum (μηδέν regression).
 * Με στρέψη → πύκνωση/μεγέθυνση ώστε η παρεχόμενη A_st/s ανά μέτρο ≥ απαίτηση (reuse του SSoT
 * `resolveMatMesh` — ο ίδιος spacing-then-diameter αλγόριθμος με τη σχάρα θεμελίωσης· default =
 * code-min όταν demand μικρό ⇒ additive «max» με το ελάχιστο). Κρίσιμο βήμα ≤ νέο κύριο βήμα.
 */
function resolveBeamStirrups(
  limits: BeamReinforcementLimits,
  torsion: BeamTorsionSteel | null,
): BeamStirrups {
  if (!torsion) {
    return {
      diameterMm: limits.minStirrupDiameterMm,
      spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm),
      spacingCriticalMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    };
  }
  const mesh = resolveMatMesh(torsion.stirrupAreaPerMetreMm2, limits.minStirrupDiameterMm, limits.maxStirrupSpacingMm);
  return {
    diameterMm: mesh.diameterMm,
    spacingMm: mesh.spacingMm,
    spacingCriticalMm: Math.min(roundSpacingDown(limits.criticalStirrupSpacingMm), mesh.spacingMm),
  };
}

/**
 * ADR-504 Φ2 — απαιτούμενη επιφάνεια ΑΝΩ διαμήκους χάλυβα. Συνεχής δοκός (`'continuous'`):
 * πάνω από τις ενδιάμεσες στηρίξεις αναπτύσσεται hogging ≈ η ροπή ανοίγματος (envelope
 * wL²/10) → συμμετρικός οπλισμός (άνω = κάτω καμπτικός). Αλλιώς EC8 §5.4.3.1.2(5)
 * αναρτήρες: άνω ≥ 0.25·κάτω (διαμήκη). + στρεπτικός γωνιακός A_sl/2 (additive, και στις δύο).
 */
function topReinforcementAreaMm2(
  supportType: BeamSupportType,
  asBottomFlexuralMm2: number,
  bottom: { readonly count: number; readonly diameterMm: number },
  asTorsionPerFaceMm2: number,
): number {
  const flexuralTopMm2 =
    supportType === 'continuous'
      ? asBottomFlexuralMm2
      : BEAM_TOP_TO_BOTTOM_RATIO * bottom.count * barAreaMm2(bottom.diameterMm);
  return flexuralTopMm2 + asTorsionPerFaceMm2;
}

/**
 * Επιλέγει ελάχιστο-έγκυρο διαμήκη (κάτω/άνω) + εγκάρσιο οπλισμό δοκαριού,
 * εγγυώμενος ρ_κάτω ≥ ρ_min επί της ενεργού διατομής b·d (d ≈ 0.9h). Reuse του
 * SSoT `resolveBarSet` (μηδέν duplicate). Καλείται από κάθε provider.
 *
 * ADR-499 §6.3-c — όταν `ctx.designTorsionKnm > 0` (μονόπλευρη πρόβολος-πλάκα), ο στρεπτικός
 * χάλυβας προστίθεται **in-place**: `A_sl/2` ανά παρειά (γωνιακοί κάτω+άνω) additive στον
 * καμπτικό/ελάχιστο + πυκνότεροι κλειστοί συνδετήρες (`A_st/s`). Render & ΠΟΣΟΤΗΤΕΣ ακολουθούν
 * τα πραγματικά bars (geometry-is-SSoT) — μηδέν παράλληλο demand πεδίο, μηδέν αλλαγή render.
 */
export function suggestBeamReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: BeamSectionContext,
): BeamReinforcement {
  const seed = provider.beamReinforcementLimits(ctx, 16);
  const effectiveDepthMm = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  // ADR-499 — φυσική πύλη: όταν M_Ed > M_Rd,lim, ο εφελκυόμενος χάλυβας κορεστεί στο
  // A_s,lim (η θλιβόμενη ζώνη αστοχεί — περισσότερο σίδερο ΔΕΝ λύνει). Ο cap αποτρέπει
  // ψεύτικη λύση (π.χ. 4Ø32 σε 250×400)· η ανεπάρκεια διορθώνεται με μεγαλύτερη
  // διατομή (auto-size, ADR-499 Slice B). cap = 1 όταν επαρκεί ⇒ μηδέν regression.
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
  // ADR-534 Φ3b — σαγκ. ροπή θλίβει το πέλμα (b_eff)· hogging τον κορμό (b_w). Absent → b_w.
  const mLimNmm = limitMomentNmm(flexuralCompressionWidthMm(ctx), effectiveDepthMm, fcd, provider.flexuralLimitMuLim());
  const capFactor = flexuralCapacityCapFactor(beamDesignMomentNmm(ctx), mLimNmm);
  // ADR-499 §6.3-c — γωνιακός στρεπτικός χάλυβας A_sl κατανεμημένος συμμετρικά (μισό κάτω, μισό άνω).
  const torsion = resolveBeamTorsionDemand(ctx);
  const asTorsionPerFaceMm2 = torsion ? torsion.longitudinalAreaMm2 / 2 : 0;
  // ADR-472 — max(ελάχιστο ρ_min επί b·d, capped απαίτηση καμπτικής αντοχής).
  const asBottomFlexuralMm2 = Math.max(
    seed.minRatio * ctx.widthMm * effectiveDepthMm,
    asStrengthBeamMm2(ctx, effectiveDepthMm) * capFactor,
  );
  // + στρεπτικός γωνιακός A_sl/2 (μισό κάτω, μισό άνω).
  const asBottomMm2 = asBottomFlexuralMm2 + asTorsionPerFaceMm2;
  const seedDia = nextRebarDiameterMm(seed.minBarDiameterMm);

  const bottom = resolveBarSet(asBottomMm2, Math.max(seed.minBottomBarCount, 2), seedDia);
  const top = resolveBarSet(
    topReinforcementAreaMm2(ctx.supportType, asBottomFlexuralMm2, bottom, asTorsionPerFaceMm2),
    Math.max(seed.minTopBarCount, 2),
    seedDia,
  );

  const limits = provider.beamReinforcementLimits(ctx, bottom.diameterMm);
  return {
    bottom: { diameterMm: bottom.diameterMm, count: bottom.count },
    top: { diameterMm: top.diameterMm, count: top.count },
    stirrups: resolveBeamStirrups(limits, torsion),
    coverMm: limits.nominalCoverMm,
  };
}

// ─── Footing suggester (ADR-459 Phase 4b) ────────────────────────────────────

/** Πρακτικό ελάχιστο βήμα σχάρας θεμελίωσης (mm) — αποφυγή μη-σκυροδετήσιμης πυκνότητας. */
const MIN_MAT_SPACING_MM = 75;

/**
 * SSoT spacing-based επιλογή σχάρας (N.0.2 — pad×2 κατευθύνσεις + strip εγκάρσιες):
 * δεδομένης απαιτούμενης As ανά μέτρο πλάτους, αρχικής διαμέτρου & μέγιστου βήματος,
 * επιστρέφει {diameter, spacing} ώστε `area(Ø)·(1000/spacing) ≥ asRequiredPerMetre`.
 * Πρώτα πυκνώνει το βήμα (πιο οικονομικό) μέχρι το πρακτικό ελάχιστο· μετά ανεβάζει
 * διάμετρο στις εμπορικές τιμές.
 */
export function resolveMatMesh(
  asRequiredPerMetreMm2: number,
  seedDiameterMm: number,
  maxSpacingMm: number,
): { diameterMm: number; spacingMm: number } {
  let diameterMm = seedDiameterMm;
  let spacingMm = roundSpacingDown(maxSpacingMm);
  const asProvided = (): number => barAreaMm2(diameterMm) * (1000 / spacingMm);
  while (asProvided() < asRequiredPerMetreMm2 && spacingMm > MIN_MAT_SPACING_MM) {
    spacingMm = Math.max(MIN_MAT_SPACING_MM, spacingMm - 25);
  }
  while (asProvided() < asRequiredPerMetreMm2) {
    const next = nextRebarDiameterMm(diameterMm + 1);
    if (next === diameterMm) break; // έφτασε στη μέγιστη εμπορική
    diameterMm = next;
  }
  return { diameterMm, spacingMm };
}

/** Ενεργό βάθος θεμελιακού στοιχείου d ≈ thickness − cover (πλακοειδής σύμβαση). */
export function footingEffectiveDepthMm(thicknessMm: number, coverMm: number): number {
  return Math.max(0, thicknessMm - coverMm);
}

// suggestFootingReinforcementFrom (pad/strip/tie-beam) moved to
// ./suggest-footing-reinforcement.ts (N.7.1 file-size). It reuses the SSoT helpers
// exported above (resolveMatMesh, resolveBarSet, footingEffectiveDepthMm,
// suggestBeamReinforcementFrom, KN_TO_N); providers import it directly from there.

// ─── Slab suggester — universal (ADR-459 Φ4e/E3 + ADR-476) ───────────────────
// Moved to ./suggest-slab-reinforcement.ts (N.7.1 file-size). Providers import
// `suggestSlabFoundationReinforcementFrom` directly from there to keep a
// one-directional dependency (it reuses the SSoT helpers exported above).
