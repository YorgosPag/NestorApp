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
}
