/**
 * Legacy Greek structural code provider (ADR-456 — Στατικά, Slice 1).
 *
 * ΕΚΩΣ 2000 (Ελληνικός Κανονισμός Ωπλισμένου Σκυροδέματος) + ΕΑΚ 2003 (Ελληνικός
 * Αντισεισμικός Κανονισμός). Used for assessing / retrofitting existing buildings
 * (ΚΑΝ.ΕΠΕ workflow) designed before the Eurocodes. Slightly more conservative
 * detailing than EC2/EC8 in places (e.g. Ø14 minimum bar, 100mm critical
 * stirrup spacing).
 *
 * @see ./structural-code-types.ts
 */

import { developmentLengthMm, nextRebarDiameterMm } from '../rebar-catalog';
import { MAX_RESTRAINED_BAR_SPACING_MM } from '../reinforcement/column-reinforcement-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { FootingReinforcement } from '../reinforcement/footing-reinforcement-types';
import type { SlabFoundationReinforcement } from '../reinforcement/slab-foundation-reinforcement-types';
import type {
  BarDevelopmentContext,
  BeamReinforcementLimits,
  BeamSectionContext,
  ColumnReinforcementLimits,
  ColumnSectionContext,
  FootingDesignFactors,
  FootingReinforcementLimits,
  FootingSectionContext,
  SlabFoundationReinforcementLimits,
  SlabFoundationSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';
import {
  suggestBeamReinforcementFrom,
  suggestColumnReinforcementFrom,
  suggestFootingReinforcementFrom,
  suggestSlabFoundationReinforcementFrom,
} from './suggest-reinforcement';
import { EN1990_ULS_FACTORS } from '../loads/load-combinations';

/** Μελετητική ενεργός διατομή δοκού d ≈ 0.9·h. */
const BEAM_EFFECTIVE_DEPTH_FACTOR = 0.9;

function greekLegacyColumnLimits(
  ctx: ColumnSectionContext,
  longitudinalDiameterMm: number,
): ColumnReinforcementLimits {
  // ADR-460 — χαρακτηριστικό πάχος: minThicknessMm (shape-aware) ή min(width,depth).
  const bMin = ctx.minThicknessMm ?? Math.min(ctx.widthMm, ctx.depthMm);
  // ΕΚΩΣ 2000 §18.3.5: συνδετήρες φw ≥ max(8mm, dbL/3).
  const minStirrupRaw = Math.max(8, longitudinalDiameterMm / 3);
  return {
    // ΕΚΩΣ 2000 §18.3.3 — ελάχιστο ποσοστό 1%.
    minRatio: 0.01,
    // ΕΚΩΣ 2000 §18.3.3 — μέγιστο ποσοστό 4%.
    maxRatio: 0.04,
    minBarCount: 4,
    // ΕΚΩΣ 2000 §18.3.4 — κύριος οπλισμός υποστυλωμάτων Ø ≥ 14mm.
    minBarDiameterMm: 14,
    minStirrupDiameterMm: nextRebarDiameterMm(minStirrupRaw),
    // ΕΚΩΣ 2000 §18.3.5 — εκτός κρισίμων περιοχών (συντηρητικό: 15·dbL).
    maxStirrupSpacingMm: Math.min(15 * longitudinalDiameterMm, bMin, 300),
    // ΕΑΚ 2003 §18.4.6 — κρίσιμες περιοχές: s ≤ min(b/2, 100, 8·dbL).
    criticalStirrupSpacingMm: Math.min(bMin / 2, 100, 8 * longitudinalDiameterMm),
    // ΕΑΚ 2003 §18.4.5 — κάθε διαμήκης συγκρατημένη ράβδος ≤200mm απόσταση (SSoT).
    maxBarSpacingMm: MAX_RESTRAINED_BAR_SPACING_MM,
    // ΕΚΩΣ 2000 §5 — επικάλυψη ~25mm για στοιχεία εσωτερικού περιβάλλοντος.
    nominalCoverMm: 25,
  };
}

/**
 * ΕΚΩΣ 2000 §17 (διαστασιολόγηση/λεπτομέρειες) + ΕΑΚ 2003 (αντισεισμικά) όρια
 * ορθογωνικής RC δοκού. Ελαφρώς συντηρητικότερα από EC2/EC8.
 */
function greekLegacyBeamLimits(
  ctx: BeamSectionContext,
  longitudinalDiameterMm: number,
): BeamReinforcementLimits {
  const dEff = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  // ΕΚΩΣ 2000 §18.3.5 πρακτική — συνδετήρες φw ≥ max(8mm, dbL/4).
  const minStirrup = nextRebarDiameterMm(Math.max(8, longitudinalDiameterMm / 4));
  return {
    // ΕΚΩΣ 2000 §17.5 — ελάχιστο εφελκυόμενο ποσοστό (συντηρητικό).
    minRatio: 0.0030,
    maxRatio: 0.04,
    minBottomBarCount: 2,
    minTopBarCount: 2,
    // ΕΚΩΣ 2000 §17.x — Ø ≥ 14mm κύριος οπλισμός δοκού.
    minBarDiameterMm: 14,
    minStirrupDiameterMm: minStirrup,
    // ΕΚΩΣ 2000 — βήμα συνδετήρων εκτός κρισίμων (συντηρητικό 0.75·d, cap 250).
    maxStirrupSpacingMm: Math.min(0.75 * dEff, 250),
    // ΕΑΚ 2003 §18.4.6 — κρίσιμη ζώνη: s ≤ min(hw/4, 100, 8·dbL, 24·dbw).
    criticalStirrupSpacingMm: Math.min(ctx.depthMm / 4, 100, 8 * longitudinalDiameterMm, 24 * minStirrup),
    maxBarSpacingMm: 200,
    // ΕΚΩΣ 2000 §5 — επικάλυψη ~25mm εσωτερικού περιβάλλοντος.
    nominalCoverMm: 25,
  };
}

/**
 * ΕΚΩΣ 2000 §16.4 (περιορισμός βέλους) — βασικός λόγος l/d ελαφρώς συντηρητικότερος
 * από EC2 (13 vs 14), συνεπές με τη γενικά πιο συντηρητική φιλοσοφία του παλαιού κανονισμού.
 */
const GREEK_LEGACY_BASIC_SPAN_DEPTH = 13;

/** ΕΚΩΣ §16.4 — συντελεστής δομικού συστήματος K (όπως EC2 Table 7.4N). */
function greekLegacySpanDepthSystemFactor(ctx: BeamSectionContext): number {
  switch (ctx.supportType) {
    case 'cantilever':
      return 0.4;
    case 'fixed':
      return 1.5;
    default:
      return 1.0;
  }
}

/** ADR-475 — μέγιστο επιτρεπτό L/d_eff = K · basic (ΕΚΩΣ §16.4). */
function greekLegacyBeamSpanDepthLimit(ctx: BeamSectionContext): number {
  return greekLegacySpanDepthSystemFactor(ctx) * GREEK_LEGACY_BASIC_SPAN_DEPTH;
}

/**
 * ΕΚΩΣ 2000 §17 (θεμελιώσεις) όρια θεμελιακού στοιχείου — ελαφρώς συντηρητικότερα
 * από EC2 (μεγαλύτερο ρ_min, πυκνότερο μέγιστο βήμα). `tie-beam` = δοκός →
 * ισοδύναμα beam limits.
 */
function greekLegacyFootingLimits(ctx: FootingSectionContext): FootingReinforcementLimits {
  if (ctx.kind === 'tie-beam') {
    const b = greekLegacyBeamLimits(ctx, 16);
    return {
      minRatio: b.minRatio,
      minBarDiameterMm: b.minBarDiameterMm,
      maxBarSpacingMm: b.maxBarSpacingMm,
      minLongitudinalBarCount: b.minBottomBarCount,
      nominalCoverMm: b.nominalCoverMm,
      // Δεν διαβάζονται για tie-beam (δοκός)· τιμές για πληρότητα τύπου.
      padTopMeshMinThicknessMm: GREEK_LEGACY_PAD_TOP_MESH_MIN_THICKNESS_MM,
      padTopMeshKernRatio: GREEK_LEGACY_PAD_TOP_MESH_KERN_RATIO,
    };
  }
  return {
    // ΕΚΩΣ 2000 §17 — ελάχιστο ποσοστό σχάρας θεμελίωσης (συντηρητικό).
    minRatio: 0.0015,
    // Ø12 κύριος οπλισμός σχάρας.
    minBarDiameterMm: 12,
    // Συντηρητικό μέγιστο βήμα σχάρας θεμελίωσης.
    maxBarSpacingMm: 200,
    minLongitudinalBarCount: 4,
    // ΕΚΩΣ 2000 §5 — επικάλυψη θεμελίωσης (έδραση σε έδαφος).
    nominalCoverMm: 50,
    // ADR-464 — άνω σχάρα: επιδερμικός οπλισμός σε χονδρά πέδιλα + kern εκκεντρότητας.
    padTopMeshMinThicknessMm: GREEK_LEGACY_PAD_TOP_MESH_MIN_THICKNESS_MM,
    padTopMeshKernRatio: GREEK_LEGACY_PAD_TOP_MESH_KERN_RATIO,
  };
}

/** ΕΚΩΣ — χονδρά πέδιλα (≥600mm) χρειάζονται επιδερμικό οπλισμό (άνω σχάρα). */
const GREEK_LEGACY_PAD_TOP_MESH_MIN_THICKNESS_MM = 600;
/** Πυρήνας ορθογωνικής βάσης — e/dim > 1/6 ⇒ αποκόλληση ⇒ άνω σχάρα (hogging). */
const GREEK_LEGACY_PAD_TOP_MESH_KERN_RATIO = 1 / 6;

/**
 * ΕΚΩΣ 2000 όρια οπλισμού πλάκας — kind-aware (ADR-476), ελαφρώς συντηρητικότερα από EC2:
 *   - εδαφόπλακα/raft (`foundation`, §17 θεμελιώσεις): Ø12 κύριος· βήμα 200· cover 50.
 *   - αναρτημένη (`suspended`, §18 πλάκες): Ø8 ελάχιστο· smax = min(2h, 300) (πυκνότερο
 *     από EC2)· cover 25 (εσωτερικό).
 */
function greekLegacySlabFoundationLimits(
  ctx: SlabFoundationSectionContext,
): SlabFoundationReinforcementLimits {
  if (ctx.kind === 'suspended') {
    const h = ctx.thicknessMm > 0 ? ctx.thicknessMm : 0;
    return {
      // ΕΚΩΣ 2000 §18 — ελάχιστο ποσοστό πλάκας (συντηρητικό).
      minRatio: 0.0015,
      minBarDiameterMm: 8,
      maxBarSpacingMm: h > 0 ? Math.min(2 * h, 300) : 300,
      nominalCoverMm: 25,
    };
  }
  return {
    // ΕΚΩΣ 2000 §17 — ελάχιστο ποσοστό σχάρας θεμελίωσης (συντηρητικό).
    minRatio: 0.0015,
    // Ø12 κύριος οπλισμός σχάρας.
    minBarDiameterMm: 12,
    // Συντηρητικό μέγιστο βήμα σχάρας θεμελίωσης.
    maxBarSpacingMm: 200,
    // ΕΚΩΣ 2000 §5 — επικάλυψη θεμελίωσης (έδραση σε έδαφος).
    nominalCoverMm: 50,
  };
}

/** ΕΑΚ 2003 §3.2.3 — θεμελιώδης συνδυασμός (ίδιοι με EN1990 → SSoT `EN1990_ULS_FACTORS`). */
const GREEK_LEGACY_FOOTING_DESIGN_FACTORS: FootingDesignFactors = {
  combination: EN1990_ULS_FACTORS,
};

/** ΕΚΩΣ 2000 §17.2.6 — αγκύρωση συντηρητικότερη από EC2 (~50·Ø). */
const GREEK_LEGACY_ANCHORAGE_FACTOR = 50;
/** ΕΚΩΣ 2000 §17.2.7 — μάτισμα συντηρητικότερο από EC2 (~55·Ø). */
const GREEK_LEGACY_LAP_FACTOR = 55;

export const GREEK_LEGACY_PROVIDER: StructuralCodeProvider = {
  id: 'greek-legacy',
  labelKey: 'structural.code.greekLegacy',
  columnReinforcementLimits: greekLegacyColumnLimits,
  suggestColumnReinforcement(ctx: ColumnSectionContext): ColumnReinforcement {
    return suggestColumnReinforcementFrom(this, ctx);
  },
  beamReinforcementLimits: greekLegacyBeamLimits,
  suggestBeamReinforcement(ctx: BeamSectionContext): BeamReinforcement {
    return suggestBeamReinforcementFrom(this, ctx);
  },
  beamSpanDepthLimit: greekLegacyBeamSpanDepthLimit,
  footingReinforcementLimits: greekLegacyFootingLimits,
  suggestFootingReinforcement(ctx: FootingSectionContext): FootingReinforcement {
    return suggestFootingReinforcementFrom(this, ctx);
  },
  slabFoundationReinforcementLimits: greekLegacySlabFoundationLimits,
  suggestSlabFoundationReinforcement(ctx: SlabFoundationSectionContext): SlabFoundationReinforcement {
    return suggestSlabFoundationReinforcementFrom(this, ctx);
  },
  footingDesignFactors(): FootingDesignFactors {
    return GREEK_LEGACY_FOOTING_DESIGN_FACTORS;
  },
  lapLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number {
    return developmentLengthMm(GREEK_LEGACY_LAP_FACTOR, diameterMm, ctx);
  },
  anchorageLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number {
    return developmentLengthMm(GREEK_LEGACY_ANCHORAGE_FACTOR, diameterMm, ctx);
  },
};
