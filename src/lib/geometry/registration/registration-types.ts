/**
 * @fileoverview **ΚΑΤΑΓΡΑΦΗ ΔΙΑΝΥΣΜΑΤΙΚΟΥ ΣΧΕΔΙΟΥ ΠΑΝΩ ΣΕ ΕΙΚΟΝΑ** (SSoT) — τύποι και προεπιλογές (ADR-929 §6.9).
 * @module lib/geometry/registration/registration-types
 *
 * 🔑 **Τι λύνεται.** Ένα σχέδιο CAD (τμήματα σε μονάδες σχεδίου) και η μάσκα μελανιού μιας εικόνας του ίδιου σχεδίου
 * (εξαγωγή, εκτύπωση ή σάρωση). Ζητείται ο μετασχηματισμός `σχέδιο → pixel` **και πόσο του αξίζει να τον εμπιστευτείς**:
 * υπόλοιπα σε pixel, απορριφθείσες παρατηρήσεις, ολικό τεστ. Μια ευθυγράμμιση χωρίς μέτρο ποιότητας είναι υπόθεση.
 *
 * 🔑 **Σημείο-προς-γραμμή, όχι σημείο-προς-σημείο.** Ένα δείγμα πάνω σε ευθεία του CAD δεν έχει «το δικό του» pixel, έχει
 * μόνο την ευθεία στην εικόνα. Η παρατήρηση είναι η απόσταση **κάθετα** στη γραμμή (point-to-plane ICP, Chen & Medioni
 * 1992), οπότε η ολίσθηση κατά μήκος του τοίχου δεν τιμωρείται. Για affine/ομοιότητα η εξίσωση είναι **ακριβώς γραμμική**.
 *
 * 🔑 **Χονδροειδή σφάλματα με Baarda, όχι Huber** (`lib/linear-algebra/robust-adjustment.ts`, ίδιο δόγμα με την Φ4).
 *
 * ⚠️ **ΜΗΝ προσθέσεις εισαγωγή από subapp.** Καθαρή αριθμητική· τρέχει σε Worker, διακομιστή και jest.
 */

import type { Affine2x3, AffinePoint } from '../affine-2x3';

/** Μοντέλο: `similarity` = κλίμακα + στροφή + μετάθεση (4) · `affine` = + ανισότροπη κλίμακα και διάτμηση (6). */
export type RegistrationModel = 'similarity' | 'affine';

/** Ένα τμήμα του σχεδίου, σε μονάδες σχεδίου. */
export interface RegistrationSegment {
  readonly a: AffinePoint;
  readonly b: AffinePoint;
}

/** Μάσκα μελανιού: `1` = μελάνι, γραμμή-γραμμή, `width × height`. */
export interface InkMask {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** Μία αντιστοιχία: σημείο σχεδίου, μοναδιαίο κάθετο διάνυσμα στην εικόνα, και η θέση της γραμμής μελανιού πάνω του. */
export interface LineCorrespondence {
  /** Σημείο στο σχέδιο. */
  readonly drawing: AffinePoint;
  /** Μοναδιαίο κάθετο της γραμμής **στην εικόνα** (px). */
  readonly normal: AffinePoint;
  /** `normal · q` για κάθε pixel `q` της γραμμής μελανιού (px). */
  readonly offset: number;
}

export interface FitOptions {
  readonly model: RegistrationModel;
  /** A priori τυπική απόκλιση μιας παρατήρησης (px). */
  readonly sigmaPx: number;
  /** `false` ⇒ απλά ελάχιστα τετράγωνα (ενδιάμεσοι γύροι του ICP)· `true` ⇒ data snooping Baarda. */
  readonly snoop: boolean;
  /** Κρίσιμη τιμή |w| (α₀ = 0,001 ⇒ 3,29). */
  readonly critical: number;
  readonly minRedundancy: number;
}

export const DEFAULT_FIT: FitOptions = {
  model: 'affine',
  sigmaPx: 1,
  snoop: true,
  critical: 3.29,
  minRedundancy: 1e-6,
};

/** Στατιστικά υπολοίπων των **ενεργών** παρατηρήσεων, σε pixel. */
export interface ResidualStats {
  readonly count: number;
  readonly rmsePx: number;
  readonly p95Px: number;
  readonly maxPx: number;
}

export type FitResult =
  | { readonly kind: 'singular'; readonly observations: number }
  | {
      readonly kind: 'fitted';
      /** Σχέδιο → pixel. */
      readonly transform: Affine2x3;
      readonly residuals: ResidualStats;
      readonly observations: number;
      readonly rejected: number;
      /** `null` όταν δεν υπάρχουν βαθμοί ελευθερίας. */
      readonly sigma0: number | null;
      readonly globalTestPassed: boolean | null;
      /** Υπόλοιπο ανά παρατήρηση (px), με τη σειρά της εισόδου· `null` = απορρίφθηκε. */
      readonly perObservation: readonly (number | null)[];
    };

/**
 * **Κριτήριο αποδοχής** (ADR-929 §6.9 #7). Δύο ερωτήσεις, και οι δύο αναγκαίες: «είναι σύμπτωση;» (NFA a-contrario) και
 * «ταιριάζει το σχέδιο ή μόνο ένα κομμάτι του;» (κάλυψη). ⚠️ Όχι απόλυτο κατώφλι υπολοίπων: τα υπόλοιπα του ICP είναι
 * **κομμένα** από την τελευταία ακτίνα, άρα περνούν και σε τυχαίο μελάνι (μετρήθηκε, §6.9 #6).
 */
export interface AcceptanceOptions {
  /** Αναμενόμενες ψευδείς αποδοχές υπό H0 (Desolneux–Moisan–Morel: ε = 1). */
  readonly epsilon: number;
  /** Ελάχιστο ποσοστό ανεξάρτητων δειγμάτων που βρίσκουν μελάνι. ⚠️ Δηλωμένο, όχι βαθμονομημένο. */
  readonly minCoverage: number;
  /** Ακτίνα μέτρησης των υπολοίπων **μετά** τη σύγκλιση (px) — πολύ μεγαλύτερη από την τελευταία του ICP. */
  readonly evaluationRadiusPx: number;
}

export const DEFAULT_ACCEPTANCE: AcceptanceOptions = {
  epsilon: 1,
  minCoverage: 0.5,
  evaluationRadiusPx: 24,
};

export interface RegisterOptions {
  readonly fit: FitOptions;
  readonly acceptance: AcceptanceOptions;
  /** Ακτίνες αναζήτησης ανά γύρο ICP (px), από χονδρή σε λεπτή. Ο τελευταίος γύρος κάνει data snooping. */
  readonly searchRadiiPx: readonly number[];
  /** Απόσταση δειγμάτων κατά μήκος κάθε τμήματος, **στην εικόνα** (px). */
  readonly sampleStepPx: number;
  /** Ανώτατο πλήθος δειγμάτων (ντετερμινιστική αραίωση). */
  readonly maxSamples: number;
  /** Τμήματα κοντύτερα από αυτό στην εικόνα (px) αγνοούνται: η κάθετός τους είναι αβέβαιη. */
  readonly minSegmentPx: number;
  /** Ελάχιστες αντιστοιχίες ανά γύρο· λιγότερες ⇒ `not-converged`. */
  readonly minCorrespondences: number;
}

export const DEFAULT_REGISTER: RegisterOptions = {
  fit: DEFAULT_FIT,
  acceptance: DEFAULT_ACCEPTANCE,
  searchRadiiPx: [24, 12, 6, 3],
  sampleStepPx: 6,
  maxSamples: 3000,
  minSegmentPx: 12,
  minCorrespondences: 30,
};

/** Γιατί σταμάτησε η καταγραφή χωρίς αποτέλεσμα — ποτέ σιωπηλά. */
export type RegistrationFailure = 'too-few-correspondences' | 'singular' | 'degenerate-transform' | 'no-candidates';

type NotConverged = { readonly kind: 'not-converged'; readonly reason: RegistrationFailure; readonly round: number };

type Registered = {
  readonly kind: 'registered';
  readonly fit: Extract<FitResult, { kind: 'fitted' }>;
  /** Ποσοστό των δειγμάτων που βρήκαν μελάνι στον τελευταίο γύρο ∈ [0, 1]. ⚠️ Πυκνά δείγματα, όχι ανεξάρτητα. */
  readonly coverage: number;
  readonly samples: number;
};

/** ⚠️ **Μη αξιολογημένο**: «συνέκλινε» ≠ «είναι σωστό». Η ετυμηγορία είναι στο {@link AssessedRegistrationResult}. */
export type RegistrationResult = NotConverged | Registered;

/** Γιατί απορρίφθηκε μια καταγραφή που **συνέκλινε**. */
export type RejectionReason = 'not-meaningful' | 'low-coverage';

export type RegistrationVerdict = { readonly kind: 'accepted' } | { readonly kind: 'rejected'; readonly reason: RejectionReason };

/** Υπόλοιπα μετρημένα **μετά** τη σύγκλιση, με ακτίνα ≫ της τελευταίας του ICP, ώστε να μην είναι κομμένα. */
export interface EvaluationResiduals {
  readonly radiusPx: number;
  readonly samples: number;
  /** Δείγματα που βρήκαν κέντρο πινελιάς μέσα στην ακτίνα. */
  readonly found: number;
  readonly residuals: ResidualStats;
  /** Ποσοστό των υπολοίπων > 0,8·ακτίνα. ≫ 0 ⇒ η ακτίνα κόβει ακόμη, και το p95 **δεν** λέει αλήθεια. */
  readonly nearRadiusShare: number;
}

/** Αξιολόγηση a-contrario (ADR-929 §6.9 #7). */
export interface RegistrationAssessment {
  readonly verdict: RegistrationVerdict;
  /** log₁₀ NFA = log₁₀ hypotheses + log₁₀ χώρου αναζήτησης + log₁₀ P[X ≥ k]· αποδοχή ⇔ ≤ log₁₀ ε. */
  readonly log10Nfa: number;
  /** Πόσες αρχικές υποθέσεις δοκιμάστηκαν — δηλωμένο από τον καλούντα. */
  readonly hypotheses: number;
  /** log₁₀ των διακρίσιμων μετασχηματισμών που φτάνει το ICP από μία αρχή: (2R₀/r)^βε. N_tests = hypotheses · 10^αυτό. */
  readonly log10SearchSpace: number;
  /** Ακτίνα απόφασης «βρήκε μελάνι» (px) = η τελευταία του ICP. */
  readonly decisionRadiusPx: number;
  /** Ανεξάρτητα δείγματα (βήμα ≥ 2·ακτίνα, ώστε τα παράθυρα να μην επικαλύπτονται). */
  readonly independentSamples: number;
  readonly hits: number;
  /** p υπό H0: ποσοστό των pixel της εικόνας κοντά σε μελάνι — άνω φράγμα, άρα συντηρητικό. */
  readonly inkProbability: number;
  /** `hits / independentSamples`. */
  readonly coverage: number;
  readonly evaluation: EvaluationResiduals;
}

export type AssessedRegistrationResult =
  | NotConverged
  | (Registered & { readonly assessment: RegistrationAssessment; readonly initial: Affine2x3 });
