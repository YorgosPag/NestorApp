/**
 * Structural design code provider — abstraction (ADR-456 — Στατικά, Slice 1).
 *
 * Giorgio chose «και τα δύο»: the engine must support BOTH the current Eurocodes
 * (EC2/EC8 + Greek National Annexes) AND the legacy Greek code (ΕΚΩΣ 2000 + ΕΑΚ
 * 2003), selectable per project. This module defines the contract; the concrete
 * rules live in `eurocode-provider.ts` and `greek-legacy-provider.ts`, resolved
 * through `index.ts`.
 *
 * Slice 1 scope = reinforcement DETAILING limits (ρ_min/ρ_max, bar/stirrup
 * minima, cover) + a default-reinforcement suggester. Strength design (axial
 * capacity, M-N interaction) is DEFER Slice 3+.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { FootingReinforcement } from '../reinforcement/footing-reinforcement-types';
import type { BeamSupportType } from '../../types/beam-types';

/** Persisted code identifier (project-level setting). */
export type StructuralCodeId = 'eurocode' | 'greek-legacy';

/** Section context a code provider needs to derive detailing limits. */
export interface ColumnSectionContext {
  /** Διάσταση X διατομής (mm). */
  readonly widthMm: number;
  /** Διάσταση Y διατομής (mm). */
  readonly depthMm: number;
  /** Ύψος κολώνας (mm). */
  readonly heightMm: number;
  /** Εμβαδό διατομής σκυροδέματος Ac (mm²). */
  readonly grossAreaMm2: number;
}

/**
 * Code-derived detailing limits for a rectangular RC column. All ratios are
 * fractions of the gross concrete area Ac.
 */
export interface ColumnReinforcementLimits {
  /** ρ_min — ελάχιστο ποσοστό διαμήκους οπλισμού (As/Ac). */
  readonly minRatio: number;
  /** ρ_max — μέγιστο ποσοστό διαμήκους οπλισμού (As/Ac). */
  readonly maxRatio: number;
  /** Ελάχιστο πλήθος διαμήκων ράβδων (4 για ορθογωνική). */
  readonly minBarCount: number;
  /** Ελάχιστη διάμετρος διαμήκους ράβδου (mm). */
  readonly minBarDiameterMm: number;
  /** Ελάχιστη διάμετρος συνδετήρα (mm). */
  readonly minStirrupDiameterMm: number;
  /** Μέγιστο βήμα συνδετήρων στη μεσαία ζώνη (mm). */
  readonly maxStirrupSpacingMm: number;
  /** Βήμα πύκνωσης συνδετήρων στις κρίσιμες περιοχές άκρων (mm). */
  readonly criticalStirrupSpacingMm: number;
  /**
   * Μέγιστη απόσταση μεταξύ διαδοχικών **συγκρατημένων** διαμήκων ράβδων (mm)
   * περιμετρικά — EC8 §5.4.3.2.2(11)P (DCM ≤200, DCH ≤150) / ΕΑΚ. Καθορίζει το
   * ΠΛΗΘΟΣ των διαμήκων (ράβδος κάθε ≤ τόσο), όχι μόνο τη διάμετρο.
   */
  readonly maxBarSpacingMm: number;
  /** Ονομαστική επικάλυψη cnom (mm). */
  readonly nominalCoverMm: number;
}

// ─── Beam (ADR-459 Phase 4a) ─────────────────────────────────────────────────

/** Section context a code provider needs to derive BEAM detailing limits. */
export interface BeamSectionContext {
  /** Πλάτος διατομής b (mm). */
  readonly widthMm: number;
  /** Δομικό βάθος διατομής h (mm). */
  readonly depthMm: number;
  /** Καθαρό άνοιγμα / μήκος δοκαριού (mm). */
  readonly spanMm: number;
  /** Εμβαδό διατομής σκυροδέματος Ac = b·h (mm²). */
  readonly grossAreaMm2: number;
  /** Συνθήκη στήριξης (cantilever ⇒ κρίσιμη ζώνη μόνο στο πακτωμένο άκρο). */
  readonly supportType: BeamSupportType;
}

/**
 * Code-derived detailing limits για ορθογωνική RC δοκό. Τα ρ αναφέρονται στην
 * **ενεργό** διατομή b·d (d ≈ 0.9·h, μελετητική σύμβαση) — όχι στο μικτό Ac.
 */
export interface BeamReinforcementLimits {
  /** ρ_min — ελάχιστο ποσοστό εφελκυόμενου (κάτω) οπλισμού (As/(b·d)). */
  readonly minRatio: number;
  /** ρ_max — μέγιστο ποσοστό εφελκυόμενου οπλισμού. */
  readonly maxRatio: number;
  /** Ελάχιστο πλήθος κάτω ράβδων (2 — γωνιακές). */
  readonly minBottomBarCount: number;
  /** Ελάχιστο πλήθος άνω ράβδων (2 — αναρτήρες συνδετήρων). */
  readonly minTopBarCount: number;
  /** Ελάχιστη διάμετρος διαμήκους ράβδου (mm). */
  readonly minBarDiameterMm: number;
  /** Ελάχιστη διάμετρος συνδετήρα (mm). */
  readonly minStirrupDiameterMm: number;
  /** Μέγιστο βήμα συνδετήρων στη μεσαία ζώνη ανοίγματος (mm). */
  readonly maxStirrupSpacingMm: number;
  /** Βήμα πύκνωσης συνδετήρων στις κρίσιμες περιοχές άκρων (mm). */
  readonly criticalStirrupSpacingMm: number;
  /** Μέγιστη απόσταση μεταξύ διαδοχικών διαμήκων ράβδων (mm). */
  readonly maxBarSpacingMm: number;
  /** Ονομαστική επικάλυψη cnom (mm). */
  readonly nominalCoverMm: number;
}

// ─── Footing (ADR-459 Phase 4b) ──────────────────────────────────────────────

/**
 * Section context a code provider needs to derive FOOTING detailing limits.
 * Discriminated ανά foundation kind (mirror `FoundationParams`). Το `tie-beam`
 * επεκτείνει το {@link BeamSectionContext} — είναι δοκός (reuse beam path).
 */
export type FootingSectionContext =
  | PadSectionContext
  | StripSectionContext
  | TieBeamSectionContext;

/** Μεμονωμένο πέδιλο (pad) — ορθογώνιο ίχνος width(X)×length(Y), πάχος thickness. */
export interface PadSectionContext {
  readonly kind: 'pad';
  /** Πλάτος ίχνους κατά X (mm). */
  readonly widthMm: number;
  /** Μήκος ίχνους κατά Y (mm). */
  readonly lengthMm: number;
  /** Πάχος πεδίλου (mm). */
  readonly thicknessMm: number;
  /** Εμβαδό ίχνους width·length (mm²). */
  readonly grossAreaMm2: number;
}

/** Πεδιλοδοκός/συνεχές πέδιλο (strip) — band πλάτους width, βάθος thickness, μήκος span. */
export interface StripSectionContext {
  readonly kind: 'strip';
  /** Πλάτος band κάθετα στον άξονα (mm). */
  readonly widthMm: number;
  /** Βάθος/πάχος band (mm). */
  readonly thicknessMm: number;
  /** Μήκος άξονα (mm). */
  readonly spanMm: number;
}

/** Συνδετήρια δοκός (tie-beam) — ΕΙΝΑΙ δοκός → reuse {@link BeamSectionContext}. */
export interface TieBeamSectionContext extends BeamSectionContext {
  readonly kind: 'tie-beam';
}

/**
 * Code-derived detailing limits για θεμελιακό στοιχείο (mat/strip). Τα ρ
 * αναφέρονται στην ενεργό διατομή ανά μέτρο πλάτους (b=1000, d ≈ thickness−cover),
 * όπως στις πλάκες (EC2 §9.3.1.1 / §9.8.2). Για `tie-beam` ισχύουν τα beam limits.
 */
export interface FootingReinforcementLimits {
  /** ρ_min — ελάχιστο ποσοστό κύριου (καμπτικού) οπλισμού (slab-like). */
  readonly minRatio: number;
  /** Ελάχιστη διάμετρος κύριας ράβδου (mm). */
  readonly minBarDiameterMm: number;
  /** Μέγιστο βήμα ράβδων σχάρας (mm). */
  readonly maxBarSpacingMm: number;
  /** Ελάχιστο πλήθος διαμήκων ράβδων διανομής (strip). */
  readonly minLongitudinalBarCount: number;
  /** Ονομαστική επικάλυψη cnom (mm) — μεγαλύτερη (έδραση σε έδαφος, EC2 §4.4.1.3). */
  readonly nominalCoverMm: number;
}

/**
 * A structural design code. Stateless — pure rule functions keyed by section
 * context, so the same instance is shared across all entities.
 */
export interface StructuralCodeProvider {
  readonly id: StructuralCodeId;
  /** i18n key για το όνομα του κανονισμού (UI dropdown). */
  readonly labelKey: string;
  /**
   * Detailing limits για δεδομένη διατομή + επιλεγμένη διάμετρο διαμήκους
   * ράβδου (επηρεάζει το βήμα συνδετήρων: s ≤ k·dbL).
   */
  columnReinforcementLimits(
    ctx: ColumnSectionContext,
    longitudinalDiameterMm: number,
  ): ColumnReinforcementLimits;
  /**
   * Προτεινόμενος ελάχιστος-έγκυρος οπλισμός για τη διατομή (auto-suggest).
   * Εγγυάται ρ ≥ ρ_min ανεβάζοντας τη διάμετρο στις εμπορικές τιμές.
   */
  suggestColumnReinforcement(ctx: ColumnSectionContext): ColumnReinforcement;
  /**
   * ADR-459 Phase 4a — beam detailing limits για δεδομένη διατομή + διάμετρο
   * διαμήκους (επηρεάζει βήμα συνδετήρων).
   */
  beamReinforcementLimits(
    ctx: BeamSectionContext,
    longitudinalDiameterMm: number,
  ): BeamReinforcementLimits;
  /** ADR-459 Phase 4a — προτεινόμενος ελάχιστος-έγκυρος οπλισμός δοκαριού. */
  suggestBeamReinforcement(ctx: BeamSectionContext): BeamReinforcement;
  /**
   * ADR-459 Phase 4b — footing detailing limits (mat/strip). Για `tie-beam` ctx
   * επιστρέφει τα ισοδύναμα beam limits (είναι δοκός).
   */
  footingReinforcementLimits(ctx: FootingSectionContext): FootingReinforcementLimits;
  /** ADR-459 Phase 4b — προτεινόμενος ελάχιστος-έγκυρος οπλισμός θεμελίωσης. */
  suggestFootingReinforcement(ctx: FootingSectionContext): FootingReinforcement;
}
