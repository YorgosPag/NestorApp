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

export interface RegisterOptions {
  readonly fit: FitOptions;
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
  searchRadiiPx: [24, 12, 6, 3],
  sampleStepPx: 6,
  maxSamples: 3000,
  minSegmentPx: 12,
  minCorrespondences: 30,
};

/** Γιατί σταμάτησε η καταγραφή χωρίς αποτέλεσμα — ποτέ σιωπηλά. */
export type RegistrationFailure = 'too-few-correspondences' | 'singular' | 'degenerate-transform';

export type RegistrationResult =
  | { readonly kind: 'not-converged'; readonly reason: RegistrationFailure; readonly round: number }
  | {
      readonly kind: 'registered';
      readonly fit: Extract<FitResult, { kind: 'fitted' }>;
      /** Ποσοστό των δειγμάτων που βρήκαν μελάνι στον τελευταίο γύρο ∈ [0, 1]. */
      readonly coverage: number;
      readonly samples: number;
    };
