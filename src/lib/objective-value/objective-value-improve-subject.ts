/**
 * @fileoverview **Τι χρειάζεται η ενότητα «Αντικειμενική αξία» από τον κάτοχο της αγγελίας** (ADR-898 Φ3β-3) — ένα
 * συμβόλαιο για ιδιώτη ΚΑΙ γραφείο: ταυτότητα · η αλήθεια των δηλώσεων · αναθεώρηση · η πόρτα γραφής.
 * @related `components/owner-property/improve/useObjectiveValueImprove.ts` (ο καταναλωτής) ·
 *   `components/owner-property/improve/owner-improve-subject.ts` · `services/property/property-mutation-gateway.ts`
 * @module lib/objective-value/objective-value-improve-subject
 *
 * 🔑 **Γενίκευση της ΠΗΓΗΣ, όχι αντίγραφο της οθόνης** — ίδιο πρότυπο με το `MarketingAudienceControl`: ένα component,
 *   η πράξη γραφής δίνεται απ' έξω. Ίδιο δικαίωμα απόκρυψης για όλους (ADR-898 §12).
 * 🔑 Ζει στο `lib/` επίτηδες: ο γεννήτορας του slice i18n ακολουθεί και τα `import type` (μάθημα Φ3β-2, −1.880 bytes).
 */

import type { FieldPatchOutcome } from '@/lib/async/field-patch-queue';

import {
  isObjectiveValuePatchViolation,
  OBJECTIVE_VALUE_PATCH_VIOLATIONS,
  type ObjectiveValueDeclarationsPatch,
} from './objective-value-declarations';

/**
 * **Γιατί αρνήθηκε ο server μια απάντηση** — κλειστό λεξιλόγιο, κλειδί i18n το καθένα (`improve.rejected.*`).
 * `locked` = η συναλλαγή (πώληση/μίσθωση) κλείδωσε τα στοιχεία (ADR-249) · `other` = κάθε άλλη, ονομασμένη άρνηση.
 */
export const OBJECTIVE_VALUE_WRITE_REJECTIONS = [...OBJECTIVE_VALUE_PATCH_VIOLATIONS, 'locked', 'other'] as const;
export type ObjectiveValueWriteRejection = (typeof OBJECTIVE_VALUE_WRITE_REJECTIONS)[number];

/** Ωμός κωδικός άρνησης → το λεξιλόγιο της οθόνης. Άγνωστο ⇒ `other` (ποτέ ωμό κλειδί στην οθόνη). */
export function objectiveValueRejectionOf(raw: unknown): ObjectiveValueWriteRejection {
  return isObjectiveValuePatchViolation(raw) ? raw : 'other';
}

export type ObjectiveValueWriteOutcome = FieldPatchOutcome<ObjectiveValueWriteRejection>;

export interface ObjectiveValueImproveSubject {
  /** `ownp_*` ή `prop_*` — με αυτήν ζητείται η αγγελία «όπως θα τη δει ο αγοραστής». */
  readonly id: string;
  /** Οι δηλώσεις όπως κάθονται στο έγγραφο του listener — ωμές· τις ερμηνεύει ο ΕΝΑΣ αναγνώστης. */
  readonly declarations: unknown;
  /** Αλλάζει σε κάθε νέα κατάσταση του εγγράφου (listener) ⇒ η επικάλυψη καθαρίζει, η βάση ξαναζητιέται. */
  readonly revision: unknown;
  /** Η πόρτα γραφής — μερική διόρθωση, σε συναλλαγή στον server. */
  readonly write: (patch: ObjectiveValueDeclarationsPatch) => Promise<ObjectiveValueWriteOutcome>;
}
