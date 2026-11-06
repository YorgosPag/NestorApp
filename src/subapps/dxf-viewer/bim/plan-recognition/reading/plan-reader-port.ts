/**
 * Η **θύρα** `PlanReader` (ADR-929 Δ5): ό,τι χρειάζεται η ροή από έναν αναγνώστη κάτοψης, χωρίς τίποτα από τον πάροχο.
 * Σήμερα υπάρχει **ένας** προσαρμογέας (OpenAI, §9.1)· η θύρα κρατιέται ώστε μια αλλαγή παρόχου να είναι νέος
 * προσαρμογέας, όχι ξαναγράψιμο της ροής.
 *
 * 🔑 Καθαρός τύπος, χωρίς `server-only`: τον υλοποιεί ο διακομιστής, τον καταναλώνει και το σενάριο μέτρησης.
 * 🔑 **Ένα** πέρασμα (Δ5): η θύρα δεν έχει «ξαναπροσπάθησε». Ο έλεγχος γίνεται από τον λύτη (Φ4) και τον άνθρωπο (Φ5).
 * 🔑 Κάθε έκβαση κουβαλά **χρήση και κόστος**, και η αποτυχημένη: πληρώνεται κι αυτή (Δ16 #1).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reader-port
 */

import type { PlanReadingView, PlanViewSegment } from './plan-reading-view';
import type { PlanReadingDropped, PlanViewReading } from './plan-reading-wire';

export type PlanReaderImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** Η εικόνα της όψης (`PlanReadingView`) όπως **στάλθηκε**: το hash της είναι η απόδειξη αποστολής (Δ15 #5). */
export interface PlanReaderImage {
  readonly bytes: Uint8Array;
  readonly mimeType: PlanReaderImageMime;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PlanReaderInput {
  readonly image: PlanReaderImage;
  /** Τα τμήματα της Φ2 που φαίνονται στην όψη, σε `view-‰` ({@link PlanReadingView}). */
  readonly segments: readonly PlanViewSegment[];
}

/**
 * Ό,τι χρειάζεται η **εκτίμηση** κόστους (Δ16 #2): μέγεθος εικόνας και τμήματα, όχι τα bytes. Έτσι ο προέλεγχος της
 * Φ5.3α εκτιμά με την **ίδια** συνάρτηση πριν υπάρξει εικόνα, και το {@link PlanReaderInput} περνά αυτούσιο.
 */
export interface PlanReaderEstimateInput {
  readonly image: Pick<PlanReaderImage, 'widthPx' | 'heightPx'>;
  readonly segments: readonly PlanViewSegment[];
}

/** Μετρημένη χρήση μίας κλήσης. `costUsd: null` ⇒ μοντέλο χωρίς γραμμή τιμής: «δεν ξέρω», ποτέ «δωρεάν». */
export interface PlanReaderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number | null;
}

export type PlanReaderFailure = 'transport' | 'empty' | 'unparseable' | 'invalid-shape';

export type PlanReaderOutcome =
  | {
      readonly kind: 'read';
      readonly model: string;
      readonly reading: PlanViewReading;
      readonly dropped: PlanReadingDropped;
      readonly usage: PlanReaderUsage | null;
      readonly latencyMs: number;
    }
  | {
      readonly kind: 'failed';
      readonly model: string;
      readonly failure: PlanReaderFailure;
      readonly usage: PlanReaderUsage | null;
      readonly latencyMs: number;
      /** Για το log του διακομιστή και τη μέτρηση· ποτέ στο σύρμα προς τον χρήστη. */
      readonly detail: string;
    };

export interface PlanReader {
  readonly model: string;
  /** Το εκτιμώμενο κόστος **πριν** την κλήση (Δ16 #2). `null` ⇒ άγνωστο ⇒ η κλήση δεν επιτρέπεται. */
  readonly estimateCostUsd: (input: PlanReaderEstimateInput) => number | null;
  readonly read: (input: PlanReaderInput) => Promise<PlanReaderOutcome>;
}
