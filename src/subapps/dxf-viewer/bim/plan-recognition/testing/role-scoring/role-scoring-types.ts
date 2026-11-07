/**
 * **ΒΑΘΜΟΛΟΓΗΤΗΣ ΡΟΛΩΝ** (ADR-929 §6.9, Βήμα 3) — τύποι και προεπιλογές. Συγκρίνει τους ρόλους τμήματος του αναγνωριστή
 * (Φ5.4/Φ5.5) με την αλήθεια του CAD (`testing/cad-truth`), αφού η καταγραφή (`lib/geometry/registration`) έφερε το CAD στα pixel.
 *
 * 🔑 **Μήκος, όχι πλήθος τμημάτων.** Ο αναγνωριστής σπάει και ενώνει γραμμές αλλιώς από το CAD. Ένας πίνακας «ανά τμήμα»
 * θα τιμωρούσε τον κατακερματισμό και όχι το λάθος ρόλο. Μετράμε **px μήκους**, όπως οι μετρικές precision/recall των
 * ανιχνευτών ευθυγράμμων τμημάτων (ELSED, Suárez et al. 2022: επικάλυψη μήκους με κριτήριο κάθετης απόστασης).
 * 🔑 **Δύο κατευθύνσεις.** Αναγνωριστής → CAD δίνει precision (και `no-truth`: μελάνι που το CAD δεν ονομάζει)· CAD →
 * αναγνωριστής δίνει recall (και `missed`: γραμμή του CAD που δεν βρέθηκε καθόλου).
 * 🔑 **Μόνο μέτρηση.** Ζει στο `testing/`: δεν φορτώνεται ποτέ στην παραγωγή, δεν αλλάζει καμία κρίση.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/role-scoring/role-scoring-types
 */

import { DEGREES_TO_RADIANS } from '@/lib/geometry/angle';
import type { Affine2x3 } from '@/lib/geometry/affine-2x3';
import type { PlanSegmentRole, PlanSegmentRoleVerdict, RasterSegment } from '../../plan-recognition-types';
import type { CadTruth, CadTruthRole } from '../cad-truth/cad-truth-types';

/** Η αλήθεια ενός τμήματος του αναγνωριστή: ρόλος του CAD, ή `no-truth` όταν δεν πέφτει πάνω σε τίποτα του CAD. */
export type TruthLabel = CadTruthRole | 'no-truth';

/** Τι βρήκε ο αναγνωριστής πάνω σε μια γραμμή του CAD: τον ρόλο του, ή `missed`. */
export type FoundLabel = PlanSegmentRole | 'missed';

export const PREDICTED_ROLES: readonly PlanSegmentRole[] = ['wall-face', 'dimension-line', 'extension-line', 'annotation', 'unknown'];
export const TRUTH_ROLES: readonly CadTruthRole[] = ['wall-face', 'dimension-line', 'extension-line', 'annotation', 'other'];
export const TRUTH_LABELS: readonly TruthLabel[] = [...TRUTH_ROLES, 'no-truth'];
export const FOUND_LABELS: readonly FoundLabel[] = [...PREDICTED_ROLES, 'missed'];

/** Οι ρόλοι που έχουν **και** οι δύο πλευρές — μόνο σε αυτούς ορίζονται precision και recall. */
export const SCORED_ROLES = ['wall-face', 'dimension-line', 'extension-line', 'annotation'] as const;
export type ScoredRole = (typeof SCORED_ROLES)[number];

export interface RoleScoringOptions {
  /** Μέγιστη απόσταση δείγματος από τη γραμμή της άλλης πλευράς (px). Πρέπει να καλύπτει το p95 της καταγραφής. */
  readonly distTolPx: number;
  /** Μέγιστη γωνία ανάμεσα στις δύο γραμμές (rad). */
  readonly angleTolRad: number;
  /** Απόσταση δειγμάτων κατά μήκος κάθε τμήματος (px). */
  readonly sampleStepPx: number;
  /** Κάτω από αυτό το ποσοστό ταιριασμένων δειγμάτων, το τμήμα είναι `no-truth`. */
  readonly minCoverage: number;
}

export const DEFAULT_ROLE_SCORING: RoleScoringOptions = {
  distTolPx: 3,
  angleTolRad: 5 * DEGREES_TO_RADIANS,
  sampleStepPx: 2,
  minCoverage: 0.5,
};

export interface RoleScoringInput {
  readonly segments: readonly RasterSegment[];
  readonly verdicts: readonly PlanSegmentRoleVerdict[];
  readonly truth: CadTruth;
  /** Σχέδιο → px της **αρχικής** εικόνας (το `transform` μιας επιτυχούς καταγραφής). */
  readonly drawingToPx: Affine2x3;
}

/** Η κρίση για ένα τμήμα του αναγνωριστή. */
export interface SegmentTruth {
  readonly segmentId: string;
  readonly predicted: PlanSegmentRole;
  readonly truth: TruthLabel;
  /** Ποσοστό των δειγμάτων που έπεσαν σε γραμμή του CAD με ρόλο `truth` ∈ [0, 1]. */
  readonly coverage: number;
  readonly lengthPx: number;
  /** Από την κρίση του αναγνωριστή· `null` όταν δεν υπάρχει κρίση για το τμήμα. */
  readonly dimensionScore: number | null;
}

/** Πίνακας με μήκη (px): `cells[γραμμή][στήλη]`. */
export type LengthMatrix<R extends string, C extends string> = Readonly<Record<R, Readonly<Record<C, number>>>>;

export interface RoleMetric {
  readonly role: ScoredRole;
  /** `null` όταν ο αναγνωριστής δεν έδωσε καθόλου αυτόν τον ρόλο. */
  readonly precision: number | null;
  /** `null` όταν το CAD δεν έχει καθόλου αυτόν τον ρόλο. */
  readonly recall: number | null;
}

export interface RoleScore {
  readonly segments: readonly SegmentTruth[];
  /** Αναγνωριστής × αλήθεια (precision). */
  readonly confusion: LengthMatrix<PlanSegmentRole, TruthLabel>;
  /** Αλήθεια × τι βρέθηκε (recall). */
  readonly recallMatrix: LengthMatrix<CadTruthRole, FoundLabel>;
  readonly metrics: readonly RoleMetric[];
  /** Μόνο τα αταίριαστα, πρώτα τα πιο αβέβαια (βαθμός διάστασης πιο κοντά στο 0,5). */
  readonly mismatches: readonly SegmentTruth[];
}
