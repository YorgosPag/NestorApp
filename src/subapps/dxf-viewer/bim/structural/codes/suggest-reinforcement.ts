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
import { rectRestrainedBarIntervals } from '../reinforcement/column-reinforcement-types';
import type { BeamSupportType } from '../../types/beam-types';
import type {
  ColumnReinforcement,
  WallReinforcementIntent,
} from '../reinforcement/column-reinforcement-types';
import type { BeamRebarLayer, BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { FootingReinforcement } from '../reinforcement/footing-reinforcement-types';
import type {
  BeamReinforcementLimits,
  BeamSectionContext,
  ColumnReinforcementLimits,
  ColumnSectionContext,
  FootingReinforcementLimits,
  FootingSectionContext,
  PadSectionContext,
  StructuralCodeProvider,
  TieBeamSectionContext,
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
const KN_TO_N = 1000;

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
  if (nEdKn <= 0) return 0;
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE); // N/mm²
  const concreteCapacityN = fcd * ctx.grossAreaMm2;
  const asAxialMm2 = Math.max(0, (nEdKn * KN_TO_N - concreteCapacityN) / rebarFydMpa());
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

  const base: ColumnReinforcement = {
    longitudinal: { diameterMm, count },
    stirrups: {
      diameterMm: limits.minStirrupDiameterMm,
      spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm),
      spacingCriticalMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    },
    coverMm: limits.nominalCoverMm,
  };
  // ADR-460 — τοίχωμα: πρόσθεσε boundary elements + κατανεμημένο κορμό (EC8 §5.4.3.4).
  if (ctx.mode === 'wall') {
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
 * SSoT — reuse ADR-475 member-sizing (καμπτική επάρκεια διατομής).
 */
export function spanMomentDivisor(supportType: BeamSupportType): number {
  switch (supportType) {
    case 'cantilever':
      return 2;
    case 'fixed':
      return 12;
    default:
      return 8;
  }
}

/**
 * ADR-472 — απαιτούμενη As κάτω οπλισμού δοκαριού από **καμπτική αντοχή** (EC2 §6.1,
 * απλοποιημένος μοχλοβραχίονας z=0.9·d): M_Ed = w_Ed·L²/c, A_s = M_Ed/(z·f_yd).
 * Επιστρέφει 0 χωρίς γραμμικό φορτίο/άνοιγμα ⇒ ο ρ_min κυριαρχεί (μηδέν regression).
 * Χωρίς ανακατανομή ροπών / έλεγχο θλιβόμενης ζώνης (ADR-472 §4).
 */
export function asStrengthBeamMm2(ctx: BeamSectionContext, effectiveDepthMm: number): number {
  const wEd = ctx.designLineLoadKnM ?? 0;
  if (wEd <= 0 || ctx.spanMm <= 0 || effectiveDepthMm <= 0) return 0;
  const spanM = ctx.spanMm / 1000;
  const mEdNmm = ((wEd * spanM * spanM) / spanMomentDivisor(ctx.supportType)) * 1e6; // kNm→N·mm
  return mEdNmm / (BEAM_LEVER_ARM_FACTOR * effectiveDepthMm * rebarFydMpa());
}

/**
 * Επιλέγει ελάχιστο-έγκυρο διαμήκη (κάτω/άνω) + εγκάρσιο οπλισμό δοκαριού,
 * εγγυώμενος ρ_κάτω ≥ ρ_min επί της ενεργού διατομής b·d (d ≈ 0.9h). Reuse του
 * SSoT `resolveBarSet` (μηδέν duplicate). Καλείται από κάθε provider.
 */
export function suggestBeamReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: BeamSectionContext,
): BeamReinforcement {
  const seed = provider.beamReinforcementLimits(ctx, 16);
  const effectiveDepthMm = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  // ADR-472 — max(ελάχιστο ρ_min επί b·d, απαίτηση καμπτικής αντοχής).
  const asBottomMm2 = Math.max(
    seed.minRatio * ctx.widthMm * effectiveDepthMm,
    asStrengthBeamMm2(ctx, effectiveDepthMm),
  );
  const seedDia = nextRebarDiameterMm(seed.minBarDiameterMm);

  const bottom = resolveBarSet(asBottomMm2, Math.max(seed.minBottomBarCount, 2), seedDia);
  const top = resolveBarSet(
    BEAM_TOP_TO_BOTTOM_RATIO * bottom.count * barAreaMm2(bottom.diameterMm),
    Math.max(seed.minTopBarCount, 2),
    seedDia,
  );

  const limits = provider.beamReinforcementLimits(ctx, bottom.diameterMm);
  return {
    bottom: { diameterMm: bottom.diameterMm, count: bottom.count },
    top: { diameterMm: top.diameterMm, count: top.count },
    stirrups: {
      diameterMm: limits.minStirrupDiameterMm,
      spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm),
      spacingCriticalMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    },
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

/**
 * ADR-464 — απαιτείται άνω σχάρα πεδίλου; (κανόνας code-driven, μηδέν φορτίο
 * απαραίτητο): (α) χονδρό πέδιλο `thickness ≥ padTopMeshMinThicknessMm` (επιδερμικός
 * οπλισμός, EC2 §9.7/§7.3.3) **ή** (β) έκκεντρο `eccentricityRatio > padTopMeshKernRatio`
 * (kern → αποκόλληση/hogging). Default πέδιλο (0.5m, κεντρικό) ⇒ false (μηδέν regression).
 */
function padNeedsTopMesh(ctx: PadSectionContext, limits: FootingReinforcementLimits): boolean {
  if (ctx.thicknessMm >= limits.padTopMeshMinThicknessMm) return true;
  return (ctx.eccentricityRatio ?? 0) > limits.padTopMeshKernRatio;
}

/**
 * Επιλέγει ελάχιστο-έγκυρο οπλισμό θεμελίωσης ανά kind. pad → δι-διευθυντική σχάρα
 * (reuse `resolveMatMesh`)· strip → εγκάρσια σχάρα + διαμήκεις διανομής (reuse
 * `resolveBarSet`)· tie-beam → **delegate** στον beam suggester (μηδέν duplicate,
 * N.0.2). Καλείται από κάθε provider μέσα στο `suggestFootingReinforcement`.
 */
/**
 * EN1998-5 §5.4.1.2 — αναβάθμιση μιας παρειάς (κάτω/άνω) ώστε να φέρει το μερίδιό της
 * της σεισμικής δύναμης σύνδεσης: αν ο υπάρχων (καμπτικός/ελάχιστος) οπλισμός υπολείπεται
 * του `asTiePerFaceMm2`, ξανα-επιλέγεται με reuse του SSoT `resolveBarSet` (μηδέν duplicate).
 */
function upgradeFaceForTie(layer: BeamRebarLayer, asTiePerFaceMm2: number): BeamRebarLayer {
  if (layer.count * barAreaMm2(layer.diameterMm) >= asTiePerFaceMm2) return layer;
  const set = resolveBarSet(asTiePerFaceMm2, layer.count, layer.diameterMm);
  return { diameterMm: set.diameterMm, count: set.count };
}

/**
 * Συνδετήρια δοκός: ΕΙΝΑΙ δοκός → πρώτα delegate στον beam suggester (καμπτικός +
 * detailing + EC8 συνδετήρες, μηδέν duplicate). Έπειτα, αν υπάρχει σεισμική δύναμη
 * σύνδεσης (EN1998-5 §5.4.1.2(7)), προστίθεται `As,tie = N_tie/f_yd` κατανεμημένο
 * **συμμετρικά** (μισό κάτω, μισό άνω — αξονικός σύνδεσμος εφελκυσμού/θλίψης):
 * κάθε παρειά = max(καμπτικό/ελάχιστο, μερίδιο tie). Absent/≤0 N_tie → καθαρά δοκός.
 */
function suggestTieBeamReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: TieBeamSectionContext,
): FootingReinforcement {
  const beam = suggestBeamReinforcementFrom(provider, ctx);
  const nTieKn = ctx.designAxialTieKn ?? 0;
  if (nTieKn <= 0) return { kind: 'tie-beam', ...beam };
  const asTiePerFaceMm2 = (nTieKn * KN_TO_N) / rebarFydMpa() / 2;
  return {
    kind: 'tie-beam',
    ...beam,
    bottom: upgradeFaceForTie(beam.bottom, asTiePerFaceMm2),
    top: upgradeFaceForTie(beam.top, asTiePerFaceMm2),
  };
}

export function suggestFootingReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: FootingSectionContext,
): FootingReinforcement {
  if (ctx.kind === 'tie-beam') {
    return suggestTieBeamReinforcementFrom(provider, ctx);
  }

  const limits = provider.footingReinforcementLimits(ctx);
  const seedDia = nextRebarDiameterMm(limits.minBarDiameterMm);
  const thicknessMm = ctx.thicknessMm;
  const dEff = footingEffectiveDepthMm(thicknessMm, limits.nominalCoverMm);
  const asPerMetre = limits.minRatio * 1000 * dEff;

  if (ctx.kind === 'pad') {
    const mesh = resolveMatMesh(asPerMetre, seedDia, limits.maxBarSpacingMm);
    const layer = { diameterMm: mesh.diameterMm, spacingMm: mesh.spacingMm };
    // ADR-464 — άνω σχάρα όταν την απαιτεί ο κώδικας (επιδερμικός/kern)· ίδια
    // ελάχιστη διάταξη με την κάτω (mirror raft, συντηρητικό & πρακτικό).
    const topMesh = padNeedsTopMesh(ctx, limits) ? layer : undefined;
    return {
      kind: 'pad',
      bottomMeshX: layer,
      bottomMeshY: layer,
      ...(topMesh ? { topMesh } : {}),
      coverMm: limits.nominalCoverMm,
    };
  }

  // strip — ανεστραμμένη δοκός: εγκάρσιες (κύριος) + διαμήκεις διανομής (detailing).
  const transverse = resolveMatMesh(asPerMetre, seedDia, limits.maxBarSpacingMm);
  const initialLongCount = Math.max(
    limits.minLongitudinalBarCount,
    Math.ceil(ctx.widthMm / limits.maxBarSpacingMm) + 1,
  );
  // Διαμήκεις = detailing-governed (όχι strength) → asRequired=0 ⇒ reuse SSoT χωρίς bump.
  const longitudinal = resolveBarSet(0, initialLongCount, seedDia);
  return {
    kind: 'strip',
    transverse: { diameterMm: transverse.diameterMm, spacingMm: transverse.spacingMm },
    longitudinal: { diameterMm: longitudinal.diameterMm, count: longitudinal.count },
    coverMm: limits.nominalCoverMm,
  };
}

// ─── Slab suggester — universal (ADR-459 Φ4e/E3 + ADR-476) ───────────────────
// Moved to ./suggest-slab-reinforcement.ts (N.7.1 file-size). Providers import
// `suggestSlabFoundationReinforcementFrom` directly from there to keep a
// one-directional dependency (it reuses the SSoT helpers exported above).
