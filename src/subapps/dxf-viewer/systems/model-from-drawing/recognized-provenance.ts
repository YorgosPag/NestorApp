/**
 * ADR-929 Δ9 · §6.20 — η **προέλευση** μιας οντότητας που γεννήθηκε από την αναγνώριση της εικόνας του υποβάθρου: από
 * ποια εικόνα, από ποιο κομμάτι της (άνοιγμα διάστασης ή τμήμα γραμμής), με ποια βεβαιότητα. Ταξιδεύει ΜΑΖΙ με την
 * οντότητα (`metadata`), ώστε ό,τι κρατήθηκε να λέει πάντα «από πού ήρθα» — εκεί όπου το AutoCAD `PDFIMPORT` και το
 * ArchiCAD «Explode» την πετούν.
 *
 * ΕΝΑ κλειδί, ΕΝΑΣ κατασκευαστής: κανείς δεν γράφει `metadata.planRecognition` με το χέρι.
 *
 * ΚΑΘΑΡΟ.
 */

import type { PlanConfidenceTier } from '../plan-recognition/plan-confidence';

/** Το κλειδί στα `metadata` της οντότητας. */
export const PLAN_RECOGNITION_META_KEY = 'planRecognition';

/** Από τι κομμάτι της αναγνώρισης βγήκε η οντότητα. */
export type RecognizedOrigin = 'dimension-span' | 'segment';

export interface RecognizedProvenance {
  /** Η εικόνα υποβάθρου (ADR-929 §6.12: ο όροφος δεν φτάνει — η «Αντικατάσταση» φέρνει άλλη εικόνα). */
  readonly backgroundId: string;
  readonly origin: RecognizedOrigin;
  /** Το id του ανοίγματος (`DimensionSpan.id`) ή του τμήματος (`RasterSegment.id`). */
  readonly sourceId: string;
  /** Η βεβαιότητα, όπου η αναγνώριση τη βαθμολογεί (τμήματα)· οι διαστάσεις δεν έχουν δικό τους βαθμό. */
  readonly confidence?: PlanConfidenceTier;
}

/** Τα `metadata` που σφραγίζουν μια οντότητα με την προέλευσή της. */
export function recognizedMetadata(provenance: RecognizedProvenance): Record<string, unknown> {
  return { [PLAN_RECOGNITION_META_KEY]: provenance };
}
