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
      /**
       * Αβεβαιότητα **θέσης** (px, 1σ, 2D RMS) στη **χειρότερη** γωνία του αποτυπώματος των αντιστοιχιών: σ₀²·J·Q_xx·Jᵀ
       * (ADR-929 §6.9 #15, ICP covariance κατά Censi 2007). ⚠️ Τα πυκνά δείγματα είναι συσχετισμένα ⇒ υποεκτίμηση· γι' αυτό
       * η πύλη του βαθμονομείται, δεν πιστεύεται.
       */
      readonly positionSigmaPx: number;
    };

/**
 * **Κριτήριο αποδοχής** (ADR-929 §6.9 #7). Δύο ερωτήσεις, και οι δύο αναγκαίες: «είναι σύμπτωση;» (NFA a-contrario) και
 * «ταιριάζει το σχέδιο ή μόνο ένα κομμάτι του;» (κάλυψη). ⚠️ Όχι απόλυτο κατώφλι υπολοίπων: τα υπόλοιπα του ICP είναι
 * **κομμένα** από την τελευταία ακτίνα, άρα περνούν και σε τυχαίο μελάνι (μετρήθηκε, §6.9 #6).
 * 🔴 **§6.9 #9: μονάδα = ΤΜΗΜΑ, όχι δείγμα.** Τα δείγματα ενός τοίχου πετυχαίνουν ή αποτυγχάνουν **μαζί**· το NFA ανά δείγμα
 * μετρούσε ένα γεγονός χίλιες φορές και δεχόταν λάθος κατόψεις με log₁₀NFA −700 (μετρήθηκε, §6.9 #8).
 */
export interface AcceptanceOptions {
  /** Αναμενόμενες ψευδείς αποδοχές υπό H0 (Desolneux–Moisan–Morel: ε = 1). */
  readonly epsilon: number;
  /**
   * Ελάχιστο ποσοστό **μήκους** τμημάτων που πέτυχαν. Βαθμονομημένο (§6.9 #19): σωστά ≥ 0,331, λάθος διάμεσος 0,041 ⇒ 0,30
   * (απόφαση Giorgio). Δίχτυ ασφαλείας, όχι διαχωριστής: σωστά και λάθος επικαλύπτονται (λάθος έως 0,697).
   */
  readonly minCoverage: number;
  /** Ακτίνα μέτρησης των υπολοίπων **μετά** τη σύγκλιση (px) — πολύ μεγαλύτερη από την τελευταία του ICP. */
  readonly evaluationRadiusPx: number;
  /** Ένα τμήμα «πετυχαίνει» όταν τουλάχιστον τόσο κλάσμα των δειγμάτων του βρίσκει κέντρο πινελιάς. */
  readonly segmentHitShare: number;
  /**
   * Ποσοστημόριο των μετρημένων παχών που γίνεται το πάχος πινελιάς (= όριο μήκους του probe) **του κριτή**, στην τελική θέση.
   * Μετρημένο (§6.9 #21): ο διάμεσος (0,5) απέρριπτε ~½ των δειγμάτων σε σωστή θέση με θόρυβο ⇒ 0,9 (απόφαση Giorgio).
   */
  readonly strokeWidthQuantile: number;
  /** Ανώτατο πλήθος θέσεων του εμπειρικού μηδενικού μοντέλου ανά (μήκος, διεύθυνση). */
  readonly maxNullPlacements: number;
  /** Ανώτατο πλήθος τμημάτων στο NFA (ντετερμινιστική αραίωση) — η ουρά Poisson-binomial είναι O(n²). */
  readonly maxSegments: number;
  /** Ανώτατο ποσοστό ανεξήγητου μελανιού μέσα στο περίγραμμα (PatMax «clutter»)· `null` ⇒ μόνο αναφορά, ως τη βαθμονόμηση. */
  readonly maxClutter: number | null;
  /** Ελάχιστο balance (ReCap: λ_min/Σλ των καθέτων, ∈ [0, ½])· `null` ⇒ μόνο αναφορά, ως τη βαθμονόμηση. */
  readonly minBalance: number | null;
  /** Παράθυρο της τοπικής H0 (§6.9 #15): ±(τόσα × πλάτος/ύψος αποτυπώματος) γύρω από τη θέση. */
  readonly shiftWindow: number;
  /** ≈ Ανώτατο πλήθος μετατοπίσεων του σχεδίου στην τοπική H0. */
  readonly maxShifts: number;
  /** Ελάχιστο z της θέσης έναντι των μετατοπίσεων (peak-to-sidelobe)· `null` ⇒ μόνο αναφορά, ως τη βαθμονόμηση. */
  readonly minShiftZ: number | null;
  /**
   * Μέγιστος λόγος chamfer καλύτερου / δεύτερου **διακριτού** υποψηφίου (Lowe)· `null` ⇒ μόνο αναφορά. Βαθμονομημένο
   * (§6.9 #19, με την ευθυγράμμιση της Φ1): σωστά ≤ 0,52, λάθος ≥ 0,683 ⇒ 0,60 (απόφαση Giorgio).
   */
  readonly maxAmbiguity: number | null;
  /**
   * Ανεξάρτητες μονάδες της τοπικής H0 (§6.9 #19, E4): δύο τμήματα ανήκουν στην ίδια μονάδα όταν οι διευθύνσεις τους απέχουν
   * ≤ τόσες μοίρες, επικαλύπτονται κατά μήκος και απέχουν < 2r + W (οι παρειές ενός τοίχου πετυχαίνουν **μαζί**).
   */
  readonly unitParallelDeg: number;
  /** Μέγιστη αβεβαιότητα θέσης (px, 1σ) — η πύλη ανάλυσης· `null` ⇒ μόνο αναφορά, ως τη βαθμονόμηση. */
  readonly maxPositionSigmaPx: number | null;
}

export const DEFAULT_ACCEPTANCE: AcceptanceOptions = {
  epsilon: 1,
  minCoverage: 0.3,
  evaluationRadiusPx: 24,
  segmentHitShare: 0.5,
  strokeWidthQuantile: 0.9,
  maxNullPlacements: 1024,
  maxSegments: 400,
  maxClutter: null,
  minBalance: null,
  shiftWindow: 1,
  maxShifts: 128,
  minShiftZ: null,
  maxAmbiguity: 0.6,
  unitParallelDeg: 5,
  maxPositionSigmaPx: null,
};

/**
 * **Τι απαρίθμησε ο καλών** πριν από το ICP (ADR-929 §6.9 #19) — το N_tests του NFA. Ένα αντικείμενο, ώστε να μην μπορεί
 * κανείς να δηλώσει θέσεις χωρίς βήμα ή βήμα χωρίς θέσεις.
 * 🔴 Ως το #18 ο κριτής μετρούσε τη μετάθεση **δύο φορές**: οι θέσεις του χονδρού ήταν ήδη μέσα στο `hypotheses`, και το
 * ICP μετρούσε ξανά όλο το ±R₀.
 */
export interface SearchDeclaration {
  /** Πόσες αρχικές υποθέσεις δοκιμάστηκαν **συνολικά** (ακέραιος ≥ 1) — μαζί με κάθε θέση που απαρίθμησε ο χονδρός. */
  readonly hypotheses: number;
  /** Το βήμα (px εικόνας) με το οποίο ο χονδρός απαρίθμησε θέσεις· `null` ⇒ δεν απαρίθμησε θέσεις. */
  readonly translationStepPx: number | null;
}

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
  /**
   * Πάχος πινελιάς (px). `null` ⇒ **μετριέται** στο αποτύπωμα της αρχικής υπόθεσης (§6.9 #15). Το πάχος είναι σε mm
   * χαρτιού, άρα σε px μεγαλώνει με τα dpi· σταθερό όριο σε px έδωσε κάλυψη 0,01 σε σωστή θέση (§6.9 #13).
   */
  readonly strokeWidthPx: number | null;
}

export const DEFAULT_REGISTER: RegisterOptions = {
  fit: DEFAULT_FIT,
  acceptance: DEFAULT_ACCEPTANCE,
  searchRadiiPx: [24, 12, 6, 3],
  sampleStepPx: 6,
  maxSamples: 3000,
  minSegmentPx: 12,
  minCorrespondences: 30,
  strokeWidthPx: null,
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
  /** Το πάχος πινελιάς (px) που χρησιμοποίησε το probe — δηλωμένο ή μετρημένο. */
  readonly strokeWidthPx: number;
};

/** ⚠️ **Μη αξιολογημένο**: «συνέκλινε» ≠ «είναι σωστό». Η ετυμηγορία είναι στο {@link AssessedRegistrationResult}. */
export type RegistrationResult = NotConverged | Registered;

/** Γιατί απορρίφθηκε μια καταγραφή που **συνέκλινε**. */
export type RejectionReason =
  /**
   * Η αβεβαιότητα **θέσης** ξεπερνά το όριο (§6.9 #15). ⚠️ Ως το #14 σήμαινε «παρειές < 2r+1 px», που απέρριπτε 22/24
   * **σωστές** θέσεις (#12): «δεν ξεχωρίζουν οι παρειές» ≠ «δεν κρίνεται η θέση».
   */
  | 'unresolvable'
  /** Το NFA της **τοπικής** H0 (μετατόπιση όλου του σχεδίου) > ε. */
  | 'not-meaningful'
  /** Η θέση δεν ξεχωρίζει από τις γειτονικές μετατοπίσεις (peak-to-sidelobe z < όριο). */
  | 'not-distinct'
  /** Άλλη διακριτή υπόθεση ταιριάζει σχεδόν εξίσου (Lowe ratio). */
  | 'ambiguous'
  | 'low-coverage'
  /** Τα τμήματα που πέτυχαν έχουν (σχεδόν) μία διεύθυνση: η κάθετη ολίσθηση δεν ορίζεται (ReCap «balance»). */
  | 'degenerate'
  /** Πολύ μελάνι μέσα στο περίγραμμα που το σχέδιο δεν εξηγεί (PatMax «clutter»). */
  | 'cluttered';

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

/** Το NFA σε επίπεδο τμήματος (ADR-929 §6.9 #9). */
export interface SegmentEvidence {
  /** Τμήματα που αξιολογήθηκαν (≥ `minSegmentPx` στην εικόνα, αραιωμένα στο `maxSegments`). */
  readonly segments: number;
  readonly hits: number;
  /** Εμπειρικό p ανά τμήμα υπό H0 (ίδιο μήκος + διεύθυνση σε πλέγμα θέσεων της ίδιας εικόνας): διάμεσος και μέγιστο. */
  readonly pMedian: number;
  readonly pMax: number;
}

/** Ποιότητα πέρα από το «είναι σύμπτωση;»: όσα μετρούν οι μεγάλοι (PatMax, ReCap) και η ανάλυση. */
export interface RegistrationQuality {
  /** Ανεξήγητο μελάνι / μελάνι μέσα στο περίγραμμα του σχεδίου ∈ [0, 1]· `null` ⇒ καθόλου μελάνι στο περίγραμμα. */
  readonly clutter: number | null;
  /** λ_min/(λ₁+λ₂) του Σ ℓ·n nᵀ των τμημάτων που πέτυχαν ∈ [0, ½]· `null` ⇒ κανένα δεν πέτυχε. */
  readonly balance: number | null;
  /**
   * Διάμεσος (βάρος μήκους) της απόστασης κάθε τμήματος από τον πλησιέστερο παράλληλο γείτονα (px)· `null` ⇒ κανένα ζεύγος.
   * ⚠️ Από το §6.9 #15 **μόνο αναφορά** — δεν αποφασίζει πια.
   */
  readonly parallelSeparationPx: number | null;
  /** 2·ακτίνα απόφασης + 1 (px) — μόνο αναφορά, δίπλα στο `parallelSeparationPx`. */
  readonly resolvablePx: number;
}

/**
 * **Τοπική H0 με μετατόπιση όλου του σχεδίου** (ADR-929 §6.9 #15, Π1 του #11): το ίδιο σχέδιο, ίδια κλίμακα και στροφή,
 * σε M άλλες θέσεις κοντά (εκτός του δακτυλίου που φτάνει το ICP). Peak-to-sidelobe (correlation filters) + Kish.
 */
export interface ShiftNullEvidence {
  /** Πλήθος μετατοπίσεων M. */
  readonly shifts: number;
  /** Τμήματα που πέτυχαν στη θέση της καταγραφής. */
  readonly observedHits: number;
  /** Διάμεσος και MAD των επιτυχιών στις μετατοπίσεις. */
  readonly medianHits: number;
  readonly madHits: number;
  /** (k − διάμεσος) / max(1,4826·MAD, √Σp(1−p))· `null` ⇒ μηδενική διασπορά και στα δύο. */
  readonly z: number | null;
  /** (1 + #{k_j ≥ k}) / (1 + M) — ποτέ κάτω από 1/(M+1). */
  readonly empiricalP: number;
  /**
   * Συντελεστής σχεδιασμού Kish = max(1, Var(k_j) / Σpᵢ(1−pᵢ)) — **μόνο αναφορά** από το §6.9 #19: ως διαιρέτης της ουράς
   * επικυρώθηκε μόνο 16/26 σωστά (#18), οπότε την αντικατέστησαν οι ανεξάρτητες μονάδες.
   */
  readonly designEffect: number;
  /** Πλήθος ανεξάρτητων μονάδων (E4, §6.9 #19): ομάδες παράλληλων, αντικριστών τμημάτων που πετυχαίνουν μαζί. */
  readonly units: number;
  /** Μονάδες που πέτυχαν στη θέση της καταγραφής (≥ `segmentHitShare` του μήκους τους). */
  readonly unitHits: number;
  /** log₁₀ P[X ≥ k] πάνω στις **μονάδες**, με p ανά μονάδα από τις ίδιες μετατοπίσεις (Poisson-binomial, χωρίς διαιρέτη). */
  readonly log10Tail: number;
}

/** Αξιολόγηση a-contrario (ADR-929 §6.9 #7, μονάδα τμήμα από το #9, τοπική H0 από το #15). */
export interface RegistrationAssessment {
  readonly verdict: RegistrationVerdict;
  /**
   * log₁₀ NFA της **απόφασης** = log₁₀ hypotheses + log₁₀ χώρου αναζήτησης + `shiftNull.log10Tail`· αποδοχή ⇔ ≤ log₁₀ ε.
   */
  readonly log10Nfa: number;
  /** Το NFA με την H0 **όλης της σελίδας** (#9) — μόνο αναφορά: δέχτηκε 5–14/33 λάθος ζεύγη (#10, #14). */
  readonly log10NfaGlobal: number;
  readonly shiftNull: ShiftNullEvidence;
  /** Το πάχος πινελιάς (px) του probe. */
  readonly strokeWidthPx: number;
  /** Λόγος chamfer καλύτερου / δεύτερου διακριτού υποψηφίου ∈ [0, 1]· `null` ⇒ ένας μόνο διακριτός υποψήφιος. */
  readonly ambiguityRatio: number | null;
  /** Αβεβαιότητα θέσης (px, 1σ) από την προσαρμογή· `null` ⇒ αξιολογήθηκε μετασχηματισμός χωρίς προσαρμογή. */
  readonly positionSigmaPx: number | null;
  /** Πόσες αρχικές υποθέσεις δοκιμάστηκαν — δηλωμένο από τον καλούντα. */
  readonly hypotheses: number;
  /** Το βήμα απαρίθμησης θέσεων του χονδρού (px)· `null` ⇒ καμία απαρίθμηση θέσεων. */
  readonly translationStepPx: number | null;
  /**
   * log₁₀ των διακρίσιμων μετασχηματισμών που φτάνει το ICP από μία αρχή **και δεν απαρίθμησε ήδη ο χονδρός**: μετάθεση
   * (min(s, 2R₀)/r)², υπόλοιποι βαθμοί (2R₀/r)^(βε−2). N_tests = hypotheses · 10^αυτό.
   */
  readonly log10SearchSpace: number;
  /** Ακτίνα απόφασης «βρήκε μελάνι» (px) = η τελευταία του ICP. */
  readonly decisionRadiusPx: number;
  readonly segments: SegmentEvidence;
  /** Ποσοστό των pixel κοντά σε μελάνι — **μόνο πληροφορία** (ήταν το p του #7, πολύ αδύναμο ως H0). */
  readonly inkProbability: number;
  /** Μήκος τμημάτων που πέτυχαν / συνολικό μήκος. */
  readonly coverage: number;
  readonly quality: RegistrationQuality;
  readonly evaluation: EvaluationResiduals;
}

export type AssessedRegistrationResult =
  | NotConverged
  | (Registered & { readonly assessment: RegistrationAssessment; readonly initial: Affine2x3 });
