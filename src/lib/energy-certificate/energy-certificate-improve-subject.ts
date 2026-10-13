/**
 * @fileoverview **Τι χρειάζεται η ενότητα «Ενεργειακό πιστοποιητικό» από τον κάτοχο της αγγελίας** (ADR-777 §8.94) —
 * η αλήθεια του μπλοκ · αναθεώρηση · η πόρτα γραφής. Ίδιο πρότυπο με το `common-charges-improve-subject.ts`.
 * @related `components/owner-property/improve/EnergyCertificateImproveSection.tsx` (ο καταναλωτής) ·
 *   `components/owner-property/improve/owner-improve-subject.ts` (ο ιδιώτης ως κάτοχος)
 * @module lib/energy-certificate/energy-certificate-improve-subject
 *
 * 🔑 Ζει στο `lib/` επίτηδες: ο γεννήτορας του slice i18n ακολουθεί και τα `import type` (μάθημα ADR-898 Φ3β-2).
 * 🔑 **Καμία ονομασμένη άρνηση**: ό,τι κρίνεται, κρίνεται από το σχήμα πριν φύγει η απάντηση — άρα η γραφή είτε
 *   πέτυχε είτε απέτυχε (δίκτυο / διακομιστής), και η επανάληψη έχει πάντα νόημα.
 */

import type { FieldPatchOutcome } from '@/lib/async/field-patch-queue';

import type { EnergyCertificatePatch } from './energy-certificate';

export type EnergyCertificateWriteOutcome = FieldPatchOutcome<never>;

export interface EnergyCertificateImproveSubject {
  /** Το μπλοκ όπως κάθεται στο έγγραφο του listener — ωμό· το ερμηνεύει ο ΕΝΑΣ αναγνώστης (`readEnergyCertificate`). */
  readonly certificate: unknown;
  /** Αλλάζει σε κάθε νέα κατάσταση του εγγράφου ⇒ η αισιόδοξη επικάλυψη καθαρίζει. */
  readonly revision: unknown;
  /** Η πόρτα γραφής — μερική διόρθωση, σε συναλλαγή στον server (που γράφει μαζί και την αξίωση νομιμότητας). */
  readonly write: (patch: EnergyCertificatePatch) => Promise<EnergyCertificateWriteOutcome>;
}
