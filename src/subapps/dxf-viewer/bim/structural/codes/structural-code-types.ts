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
import type { SlabFoundationReinforcement } from '../reinforcement/slab-foundation-reinforcement-types';
import type { BeamSupportType } from '../../types/beam-types';
import type { BarDevelopmentModifiers } from '../rebar-catalog';
import type { LoadCombinationFactors } from '../loads/load-combinations';
import type { ConcreteGrade } from '../concrete-grades';

/** Persisted code identifier (project-level setting). */
export type StructuralCodeId = 'eurocode' | 'greek-legacy';

/**
 * Προαιρετικό context ανάπτυξης ράβδου (lap/anchorage) — ADR-459 Φ4c. Οι
 * τροποποιητές συνάφειας/εφελκυσμού ζουν στο `rebar-catalog` (ΕΝΑ SSoT)· εδώ
 * προστίθεται μόνο το `concreteGrade` (DEFER — το απλοποιημένο μοντέλο `factor·Ø`
 * δεν το χρησιμοποιεί ακόμη· κρατιέται για το πλήρες EC2 §8.4.2 μελλοντικά).
 */
export interface BarDevelopmentContext extends BarDevelopmentModifiers {
  /** π.χ. 'C25/30' — αν absent → default code grade. DEFER στο απλοποιημένο μοντέλο. */
  readonly concreteGrade?: string;
}

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
  // ─── ADR-460 — shape-aware (όλα optional· absent ⇒ rectangular συμπεριφορά) ──
  /** Ελάχιστο πάχος διατομής (mm) — όρια βήματος συνδ. Absent ⇒ min(width,depth). */
  readonly minThicknessMm?: number;
  /** Μέγιστη διάσταση διατομής (mm) — μήκος τοιχώματος. Absent ⇒ max(width,depth). */
  readonly maxDimensionMm?: number;
  /** Περίμετρος outline (mm) — πλήθος περιμετρικών ράβδων. Absent ⇒ 2(width+depth). */
  readonly perimeterMm?: number;
  /** Τρόπος διευθέτησης οπλισμού. Absent ⇒ 'perimeter'. */
  readonly mode?: 'perimeter' | 'circular' | 'wall';
  // ─── ADR-472 — load-aware strength (όλα optional· absent ⇒ min-detailing μόνο) ──
  /**
   * Αξονικό σχεδιασμού N_Ed (kN, θλίψη θετική) — ULS συνδυασμός του `appliedLoad`
   * (EN1990 6.10). Absent/≤0 ⇒ ο suggester δίνει μόνο ελάχιστο ρ_min (σημερινή
   * συμπεριφορά, μηδέν regression). Παρόν ⇒ `As = max(ρ_min·Ac, strength(N_Ed))`.
   */
  readonly designAxialKn?: number;
  /**
   * Κατηγορία σκυροδέματος (για f_cd στον strength υπολογισμό). Absent ⇒ default
   * code grade. Χρησιμοποιείται ΜΟΝΟ όταν υπάρχει `designAxialKn`.
   */
  readonly concreteGrade?: ConcreteGrade;
  /**
   * ADR-472 S4 — Ροπή σχεδιασμού M_Ed (kNm) για M-N σχεδιασμό. Παράγεται **αυτόματα**
   * ως ονομαστική εκκεντρότητα EC2 §6.1(4): `M_Ed = N_Ed·e₀`, `e₀ = max(h/30, 20mm)`
   * (preliminary, χωρίς πλαισιακή ανάλυση/biaxial — βλ. ADR-472 §4). Absent/≤0 ⇒
   * καθαρά αξονικός σχεδιασμός (μηδέν regression). Χρησιμοποιείται ΜΟΝΟ με `designAxialKn`.
   */
  readonly designMomentKnm?: number;
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
  /**
   * ADR-472 — γραμμικό φορτίο σχεδιασμού w_Ed (kN/m) — ULS συνδυασμός του tributary
   * `appliedLoad` διαιρεμένο με το άνοιγμα. Absent/≤0 ⇒ μόνο ελάχιστο ρ_min (σημερινή
   * συμπεριφορά). Παρόν ⇒ `As,κάτω = max(ρ_min·b·d, strength(M_Ed))`, M_Ed = w·L²/c.
   */
  readonly designLineLoadKnM?: number;
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
  /**
   * ADR-464 — λόγος εκκεντρότητας SLS e/dim (max κατά X/Y) από το εφαρμοζόμενο
   * φορτίο· καθορίζει αν χρειάζεται άνω σχάρα (kern). Absent/0 ⇒ κεντρικό φορτίο.
   */
  readonly eccentricityRatio?: number;
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
  /**
   * ADR-464 — ελάχιστο πάχος (mm) πάνω από το οποίο ΑΠΑΙΤΕΙΤΑΙ άνω σχάρα πεδίλου
   * για επιδερμικό/συστολικό οπλισμό (skin, EC2 §9.7/§7.3.3), ανεξάρτητα φορτίου.
   */
  readonly padTopMeshMinThicknessMm: number;
  /**
   * ADR-464 — όριο λόγου εκκεντρότητας e/dim (kern, 1/6 ορθογ.) πάνω από το οποίο
   * εμφανίζεται αποκόλληση/αντιστροφή ⇒ ΑΠΑΙΤΕΙΤΑΙ άνω σχάρα (hogging).
   */
  readonly padTopMeshKernRatio: number;
}

// ─── Footing design (ADR-464) ────────────────────────────────────────────────

/**
 * Code-specific factors για τον σχεδιασμό θεμελίωσης (loads model + design engine,
 * ADR-464). Slice 1 = συντελεστές συνδυασμού· διάτρηση/άλλα προστίθενται additive.
 */
export interface FootingDesignFactors {
  /** Συντελεστές θεμελιώδους συνδυασμού ULS (EN1990 / ΕΑΚ). */
  readonly combination: LoadCombinationFactors;
}

// ─── Foundation-slab / raft (ADR-459 Φ4e/E3) ─────────────────────────────────

/**
 * Section context a code provider needs for a FOUNDATION-SLAB (raft / εδαφόπλακα,
 * `SlabEntity` kind foundation/ground). bbox dims (πλακοειδής σύμβαση — οι σχάρες
 * τρέχουν στο περιβάλλον ορθογώνιο) + πάχος + ακαθάριστο εμβαδό περιγράμματος.
 */
export interface SlabFoundationSectionContext {
  /** Πλάτος bbox κατά X (mm). */
  readonly widthMm: number;
  /** Μήκος bbox κατά Y (mm). */
  readonly lengthMm: number;
  /** Πάχος πλάκας (mm). */
  readonly thicknessMm: number;
  /** Ακαθάριστο εμβαδό περιγράμματος (mm²). */
  readonly grossAreaMm2: number;
}

/**
 * Code-derived detailing limits για εδαφόπλακα/raft. Τα ρ αναφέρονται στην ενεργό
 * διατομή ανά μέτρο πλάτους (b=1000, d ≈ thickness−cover), όπως στις πλάκες
 * (EC2 §9.3.1.1). Lean — η raft είναι δι-διευθυντική σχάρα (μηδέν διαμήκεις διανομής).
 */
export interface SlabFoundationReinforcementLimits {
  /** ρ_min — ελάχιστο ποσοστό κύριου (καμπτικού) οπλισμού (slab-like). */
  readonly minRatio: number;
  /** Ελάχιστη διάμετρος ράβδου σχάρας (mm). */
  readonly minBarDiameterMm: number;
  /** Μέγιστο βήμα ράβδων σχάρας (mm). */
  readonly maxBarSpacingMm: number;
  /** Ονομαστική επικάλυψη cnom (mm) — έδραση σε έδαφος (EC2 §4.4.1.3). */
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
  /** ADR-459 Φ4e/E3 — detailing limits εδαφόπλακας/raft (slab-like, δι-διευθυντική). */
  slabFoundationReinforcementLimits(
    ctx: SlabFoundationSectionContext,
  ): SlabFoundationReinforcementLimits;
  /** ADR-459 Φ4e/E3 — προτεινόμενος ελάχιστος-έγκυρος οπλισμός εδαφόπλακας (top+bottom σχάρα). */
  suggestSlabFoundationReinforcement(
    ctx: SlabFoundationSectionContext,
  ): SlabFoundationReinforcement;
  /**
   * ADR-464 — code-specific factors σχεδιασμού θεμελίωσης (συνδυασμοί δράσεων ULS,
   * + διάτρηση σε επόμενα slices). Stateless — ίδιες τιμές για όλο το κτίριο.
   */
  footingDesignFactors(): FootingDesignFactors;
  /**
   * ADR-459 Phase 4c — μήκος ματίσματος l₀ (mm), EC2 §8.7.3. ΕΝΑ SSoT για τις
   * προεκτάσεις/ματίσεις στις συνδέσεις του οργανισμού (αντικαθιστά το flat 50·Ø).
   * Eurocode ~50·Ø· legacy συντηρητικότερα.
   */
  lapLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number;
  /**
   * ADR-459 Phase 4c — μήκος αγκύρωσης lbd (mm), EC2 §8.4.4. Αγκύρωση ράβδων στους
   * κόμβους (δοκάρι→κολόνα) & αναμονών (dowels) μέσα στο πέδιλο. Eurocode ~40·Ø·
   * legacy ~50·Ø.
   */
  anchorageLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number;
}
