/**
 * @fileoverview **Τι χρειάζεται η ενότητα «Κοινόχρηστα» από τον κάτοχο της αγγελίας** (ADR-777 §8.93) — η αλήθεια
 * του μπλοκ · αναθεώρηση · η πόρτα γραφής. Ίδιο πρότυπο με το `objective-value-improve-subject.ts`.
 * @related `components/owner-property/improve/CommonChargesImproveSection.tsx` (ο καταναλωτής) ·
 *   `components/owner-property/improve/owner-improve-subject.ts` (ο ιδιώτης ως κάτοχος)
 * @module lib/common-charges/common-charges-improve-subject
 *
 * 🔑 Ζει στο `lib/` επίτηδες: ο γεννήτορας του slice i18n ακολουθεί και τα `import type` (μάθημα ADR-898 Φ3β-2).
 * 🔑 **Καμία ονομασμένη άρνηση**: ό,τι κρίνεται, κρίνεται από το σχήμα πριν φύγει η απάντηση — άρα η γραφή είτε
 *   πέτυχε είτε απέτυχε (δίκτυο / διακομιστής), και η επανάληψη έχει πάντα νόημα.
 */

import type { FieldPatchOutcome } from '@/lib/async/field-patch-queue';

import type { CommonChargesPatch } from './common-charges';

export type CommonChargesWriteOutcome = FieldPatchOutcome<never>;

export interface CommonChargesImproveSubject {
  /** Το μπλοκ όπως κάθεται στο έγγραφο του listener — ωμό· το ερμηνεύει ο ΕΝΑΣ αναγνώστης (`readCommonCharges`). */
  readonly charges: unknown;
  /** Αλλάζει σε κάθε νέα κατάσταση του εγγράφου ⇒ η αισιόδοξη επικάλυψη καθαρίζει. */
  readonly revision: unknown;
  /** Η πόρτα γραφής — μερική διόρθωση, σε συναλλαγή στον server. */
  readonly write: (patch: CommonChargesPatch) => Promise<CommonChargesWriteOutcome>;
}
