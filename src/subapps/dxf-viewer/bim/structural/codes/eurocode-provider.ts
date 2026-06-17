/**
 * Eurocode structural code provider (ADR-456 — Στατικά, Slice 1).
 *
 * EN 1992-1-1 (EC2) detailing + EN 1998-1 (EC8) seismic detailing with the Greek
 * National Annexes. Since Greece is a seismic country, the EC8 Ductility Class
 * Medium (DCM) minima govern over the plain-EC2 values where they differ
 * (e.g. ρ_min = 1% from EC8 §5.4.3.2.2 vs 0.2% from EC2 §9.5.2).
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

function eurocodeColumnLimits(
  ctx: ColumnSectionContext,
  longitudinalDiameterMm: number,
): ColumnReinforcementLimits {
  // ADR-460 — χαρακτηριστικό πάχος: minThicknessMm (shape-aware) ή min(width,depth).
  const bMin = ctx.minThicknessMm ?? Math.min(ctx.widthMm, ctx.depthMm);
  // EC2 §9.5.3(1): φw ≥ max(6mm, 0.25·dbL,max) → επόμενη εμπορική.
  const minStirrupRaw = Math.max(6, 0.25 * longitudinalDiameterMm);
  return {
    // EC8 §5.4.3.2.2(1)P (DCM) — κυριαρχεί έναντι EC2 §9.5.2 (0.002).
    minRatio: 0.01,
    // EC2 §9.5.2(3) — εκτός περιοχών υπερκάλυψης.
    maxRatio: 0.04,
    // EC2 §9.5.2(4): ≥1 ράβδος ανά γωνία → 4 για ορθογωνική.
    minBarCount: 4,
    // EC2 §9.5.2(1) NA / EC8 πρακτική — Ø12 για κύριο οπλισμό κολώνας.
    minBarDiameterMm: 12,
    minStirrupDiameterMm: nextRebarDiameterMm(minStirrupRaw),
    // EC2 §9.5.3(3): scl,tmax = min(20·dbL,min, b, 400mm).
    maxStirrupSpacingMm: Math.min(20 * longitudinalDiameterMm, bMin, 400),
    // EC8 §5.4.3.2.2(11) DCM κρίσιμη περιοχή: s ≤ min(b0/2, 175, 8·dbL).
    criticalStirrupSpacingMm: Math.min(bMin / 2, 175, 8 * longitudinalDiameterMm),
    // EC8 §5.4.3.2.2(11)P (DCM): κάθε διαμήκης συγκρατημένη ράβδος ≤200mm απόσταση (SSoT).
    maxBarSpacingMm: MAX_RESTRAINED_BAR_SPACING_MM,
    // EN 1992-1-1 §4.4.1 — cnom ~30mm για XC κλάση έκθεσης κτιρίων.
    nominalCoverMm: 30,
  };
}

/**
 * EC2 §9.2 (detailing) + EC8 §5.4.3.1.2 (DCM seismic) όρια ορθογωνικής RC δοκού.
 * Τα ρ αναφέρονται στην ενεργό διατομή b·d (d ≈ 0.9h).
 */
function eurocodeBeamLimits(
  ctx: BeamSectionContext,
  longitudinalDiameterMm: number,
): BeamReinforcementLimits {
  const dEff = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  // EC2 §9.2.2(1) φw ≥ max(6mm, 0.25·dbL,max)· EC8 DCM + ελληνική πρακτική → Ø8 min.
  const minStirrup = nextRebarDiameterMm(Math.max(8, 0.25 * longitudinalDiameterMm));
  return {
    // EC8 §5.4.3.1.2(5) DCM: ρ_min = 0.5·fctm/fyk ≈ 0.0026 (C25/30 + B500C).
    minRatio: 0.0026,
    // EC8 §5.4.3.1.2(4) — πρακτικό άνω όριο εφελκυόμενου οπλισμού δοκού.
    maxRatio: 0.04,
    // EC2 §9.2.1.1 — ≥2 γωνιακές ράβδοι κάτω + 2 διαμπερείς άνω.
    minBottomBarCount: 2,
    minTopBarCount: 2,
    // EC2/Greek πρακτική — Ø14 κύριος οπλισμός δοκού.
    minBarDiameterMm: 14,
    minStirrupDiameterMm: minStirrup,
    // EC2 §9.2.2(6): sl,max = 0.75·d (κατακόρυφοι συνδετήρες).
    maxStirrupSpacingMm: Math.min(0.75 * dEff, 300),
    // EC8 §5.4.3.1.2(6) DCM κρίσιμη ζώνη: s ≤ min(hw/4, 175, 8·dbL, 24·dbw).
    criticalStirrupSpacingMm: Math.min(ctx.depthMm / 4, 175, 8 * longitudinalDiameterMm, 24 * minStirrup),
    // EC2 §7.3 crack control — απόσταση διαμήκων.
    maxBarSpacingMm: 200,
    // EN 1992-1-1 §4.4.1 — cnom ~30mm για XC κτιρίων.
    nominalCoverMm: 30,
  };
}

/**
 * EC2 §7.4.2 Table 7.4N — βασικός λόγος l/d για έλεγχο βέλους χωρίς ρητό υπολογισμό,
 * σκυρόδεμα **ισχυρά καταπονούμενο** (ρ ≈ 1.5%, conservative preliminary). Ο τελικός
 * πίνακας κυμαίνεται 14→20 ανάλογα με το ρ· κρατάμε το ασφαλές κάτω άκρο (14).
 */
const EUROCODE_BASIC_SPAN_DEPTH = 14;

/**
 * EC2 §7.4.2 Table 7.4N — συντελεστής δομικού συστήματος K επί του basic l/d:
 * αμφιέρειστη 1.0 · αμφίπακτη (εσωτερικό φάτνωμα) 1.5 · πρόβολος 0.4.
 */
function eurocodeSpanDepthSystemFactor(ctx: BeamSectionContext): number {
  switch (ctx.supportType) {
    case 'cantilever':
      return 0.4;
    case 'fixed':
      return 1.5;
    default:
      return 1.0;
  }
}

/** ADR-475 — μέγιστο επιτρεπτό L/d_eff = K · basic (EC2 §7.4.2). */
function eurocodeBeamSpanDepthLimit(ctx: BeamSectionContext): number {
  return eurocodeSpanDepthSystemFactor(ctx) * EUROCODE_BASIC_SPAN_DEPTH;
}

/**
 * EC2 §9.8.2 (πέδιλα) + §9.3.1.1 (slab-like κάτω σχάρα) όρια θεμελιακού στοιχείου.
 * `tie-beam` = δοκός → ισοδύναμα beam limits. Cover μεγαλύτερο (EC2 §4.4.1.3 —
 * έδραση σε προετοιμασμένο έδαφος/blinding).
 */
function eurocodeFootingLimits(ctx: FootingSectionContext): FootingReinforcementLimits {
  if (ctx.kind === 'tie-beam') {
    const b = eurocodeBeamLimits(ctx, 16);
    return {
      minRatio: b.minRatio,
      minBarDiameterMm: b.minBarDiameterMm,
      maxBarSpacingMm: b.maxBarSpacingMm,
      minLongitudinalBarCount: b.minBottomBarCount,
      nominalCoverMm: b.nominalCoverMm,
      // Δεν διαβάζονται για tie-beam (δοκός)· τιμές για πληρότητα τύπου.
      padTopMeshMinThicknessMm: EUROCODE_PAD_TOP_MESH_MIN_THICKNESS_MM,
      padTopMeshKernRatio: EUROCODE_PAD_TOP_MESH_KERN_RATIO,
    };
  }
  return {
    // EC2 §9.3.1.1(1) As,min = 0.26·fctm/fyk·b·d ≈ 0.0013 (C25/30 + B500C).
    minRatio: 0.0013,
    // Πρακτική θεμελίωσης — Ø12 κύριος οπλισμός σχάρας.
    minBarDiameterMm: 12,
    // EC2 §9.3.1.1(3) smax,slabs = min(3h, 400)· πρακτικό 250 για θεμελίωση.
    maxBarSpacingMm: 250,
    // ≥4 διαμήκεις ράβδοι διανομής (strip).
    minLongitudinalBarCount: 4,
    // EN 1992-1-1 §4.4.1.3 — έδραση σε προετοιμασμένο έδαφος ~50mm.
    nominalCoverMm: 50,
    // ADR-464 — άνω σχάρα: επιδερμικός οπλισμός σε χονδρά πέδιλα + kern εκκεντρότητας.
    padTopMeshMinThicknessMm: EUROCODE_PAD_TOP_MESH_MIN_THICKNESS_MM,
    padTopMeshKernRatio: EUROCODE_PAD_TOP_MESH_KERN_RATIO,
  };
}

/** EC2 §7.3.3/§9.7 — χονδρά πέδιλα (≥600mm) χρειάζονται επιδερμικό οπλισμό (άνω σχάρα). */
const EUROCODE_PAD_TOP_MESH_MIN_THICKNESS_MM = 600;
/** Πυρήνας ορθογωνικής βάσης — e/dim > 1/6 ⇒ αποκόλληση ⇒ άνω σχάρα (hogging). */
const EUROCODE_PAD_TOP_MESH_KERN_RATIO = 1 / 6;

/**
 * EC2 §9.3.1.1 (slab-like) όρια οπλισμού πλάκας — kind-aware (ADR-476):
 *   - εδαφόπλακα/raft (`foundation`): δι-διευθυντική top+bottom· Ø12 κύριος· βήμα 250·
 *     cover 50 (έδραση σε έδαφος, §4.4.1.3).
 *   - αναρτημένη (`suspended` floor/ceiling/roof): Ø8 ελάχιστο· smax = min(3h, 400)
 *     (§9.3.1.1(3))· cover 25 (εσωτερικό XC1, §4.4.1).
 */
function eurocodeSlabFoundationLimits(
  ctx: SlabFoundationSectionContext,
): SlabFoundationReinforcementLimits {
  // EC2 §9.3.1.1(1) As,min = 0.26·fctm/fyk·b·d ≈ 0.0013 (C25/30 + B500C) — κοινό.
  if (ctx.kind === 'suspended') {
    const h = ctx.thicknessMm > 0 ? ctx.thicknessMm : 0;
    return {
      minRatio: 0.0013,
      minBarDiameterMm: 8,
      maxBarSpacingMm: h > 0 ? Math.min(3 * h, 400) : 400,
      nominalCoverMm: 25,
    };
  }
  return {
    minRatio: 0.0013,
    minBarDiameterMm: 12,
    maxBarSpacingMm: 250,
    nominalCoverMm: 50,
  };
}

/** EN1990 Πίνακας A1.2(B) — θεμελιώδης συνδυασμός ULS (SSoT `EN1990_ULS_FACTORS`). */
const EUROCODE_FOOTING_DESIGN_FACTORS: FootingDesignFactors = {
  combination: EN1990_ULS_FACTORS,
};

/** EC2 §8.4.4 — βασικός συντελεστής αγκύρωσης lbd ≈ 40·Ø (καλή συνάφεια, εφελκυσμός). */
const EUROCODE_ANCHORAGE_FACTOR = 40;
/** EC2 §8.7.3 — βασικός συντελεστής ματίσματος l₀ ≈ 50·Ø (α₆ ≈ 1.25 × lbd). */
const EUROCODE_LAP_FACTOR = 50;

export const EUROCODE_PROVIDER: StructuralCodeProvider = {
  id: 'eurocode',
  labelKey: 'structural.code.eurocode',
  columnReinforcementLimits: eurocodeColumnLimits,
  suggestColumnReinforcement(ctx: ColumnSectionContext): ColumnReinforcement {
    return suggestColumnReinforcementFrom(this, ctx);
  },
  beamReinforcementLimits: eurocodeBeamLimits,
  suggestBeamReinforcement(ctx: BeamSectionContext): BeamReinforcement {
    return suggestBeamReinforcementFrom(this, ctx);
  },
  beamSpanDepthLimit: eurocodeBeamSpanDepthLimit,
  footingReinforcementLimits: eurocodeFootingLimits,
  suggestFootingReinforcement(ctx: FootingSectionContext): FootingReinforcement {
    return suggestFootingReinforcementFrom(this, ctx);
  },
  slabFoundationReinforcementLimits: eurocodeSlabFoundationLimits,
  suggestSlabFoundationReinforcement(ctx: SlabFoundationSectionContext): SlabFoundationReinforcement {
    return suggestSlabFoundationReinforcementFrom(this, ctx);
  },
  footingDesignFactors(): FootingDesignFactors {
    return EUROCODE_FOOTING_DESIGN_FACTORS;
  },
  lapLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number {
    return developmentLengthMm(EUROCODE_LAP_FACTOR, diameterMm, ctx);
  },
  anchorageLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number {
    return developmentLengthMm(EUROCODE_ANCHORAGE_FACTOR, diameterMm, ctx);
  },
};
