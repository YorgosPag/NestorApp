/**
 * @fileoverview Βιβλίο Ε-Ε — πολιτική αντιλογισμού (SSoT, καθαρό, ασφαλές και για τον πελάτη)
 * @description ΠΟΙΑ εγγραφή αντιλογίζεται, ΑΠΟ ΠΟΥ, και σε ΠΟΙΑ ημερομηνία. Ο ΕΝΑΣ γραφέας
 *   (`accounting-repo-journal-reversal.ts`) την εφαρμόζει μέσα στη συναλλαγή πάνω στα φρέσκα έγγραφα· η οθόνη την
 *   ξαναρωτά μόνο για να ΔΕΙΞΕΙ (κουμπί ή εξήγηση) — ποτέ για να αποφασίσει.
 *
 * 🏆 Πρότυπο (ADR-ACC-010 §2.1.1 Φ8):
 *   - SAP FB08: storno με αναφορά στο αρχικό, κωδικός λόγου, «κλειστή περίοδος ⇒ ημερομηνία σε ανοιχτή»·
 *     παραστατικά άλλου υποσυστήματος (SD/MM/AA) αντιλογίζονται ΜΟΝΟ από εκεί (VF11 / MR8M / AA).
 *   - DATEV Generalumkehr: ίδια πεδία, αρνητικό πρόσημο — τα σύνολα κινήσεων μένουν καθαρά.
 *   - GoBD / §146(4) AO: καμία διαγραφή, καμία αλλαγή ποσού — μόνο διόρθωση που φαίνεται ως διόρθωση.
 *
 * @see ADR-ACC-010 §2.1.1 Φάση 8
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import {
  JOURNAL_LINEAGE_FIELDS,
  JOURNAL_REVERSAL_REASON_REQUIRING_NOTES,
  JOURNAL_REVERSAL_REFUSALS,
  type JournalReversalDatePolicy,
  type JournalReversalRefusal,
  type JournalReversalTrigger,
} from '../../types/journal-reversal';
import { isSubsystemOwnedEntry } from './journal-subsystem-ownership';

type ReversibleShape = Pick<JournalEntry, 'isReversal' | 'source' | 'category' | 'invoiceId'>;

/**
 * Γιατί ΔΕΝ αντιλογίζεται η εγγραφή από αυτόν τον καλούντα — `null` = επιτρέπεται.
 * (Το `DOCUMENT_LINKED` το αποφασίζει ο γραφέας: χρειάζεται ανάγνωση του παραστατικού.)
 */
export function reversalRefusalOf(entry: ReversibleShape, trigger: JournalReversalTrigger): JournalReversalRefusal | null {
  if (entry.isReversal === true) return 'IS_REVERSAL';
  if (isSubsystemOwnedEntry(entry)) return 'SUBSYSTEM_OWNED';
  if (trigger === 'manual' && entry.invoiceId) return 'INVOICE_LINKED';
  return null;
}

/** Δείχνει η οθόνη του βιβλίου κουμπί «Αντιλογισμός»; (ενεργή + καμία άρνηση γνωστή στον πελάτη) */
export function canReverseFromLedger(entry: ReversibleShape & Pick<JournalEntry, 'status'>): boolean {
  return entry.status === 'ACTIVE' && reversalRefusalOf(entry, 'manual') === null;
}

/**
 * Οι υποψήφιες ημερομηνίες, με σειρά προτίμησης. Ο γραφέας κρατά την ΠΡΩΤΗ με ανοιχτή περίοδο· αν καμία, αρνείται
 * με την άρνηση της ΤΕΛΕΥΤΑΙΑΣ (σήμερα) — ο χρήστης μαθαίνει ποια περίοδο πρέπει να ανοίξει.
 */
export function reversalDateCandidates(
  policy: JournalReversalDatePolicy,
  originalDate: string,
  today: string
): readonly string[] {
  if (policy === 'today' || originalDate === today) return [today];
  return [originalDate, today];
}

/** Είναι ο λόγος πλήρης; (`OTHER` θέλει σημείωση) — ΕΝΑΣ κανόνας για zod και διάλογο. */
export function isReversalReasonComplete(reasonCode: string, notes: string | null | undefined): boolean {
  if (reasonCode !== JOURNAL_REVERSAL_REASON_REQUIRING_NOTES) return reasonCode.length > 0;
  return (notes ?? '').trim().length > 0;
}

/**
 * Κουβαλά το σώμα πεδίο ΓΕΝΕΑΛΟΓΙΑΣ (`JOURNAL_LINEAGE_FIELDS`); — τα γράφει ΜΟΝΟ ο γραφέας αντιλογισμού. Ως 2026-11-07
 * το `POST /journal` (`passthrough`) δεχόταν `isReversal: true` ⇒ «αντιλογισμός» χωρίς αρχική, αμετάβλητος για πάντα.
 */
export function carriesLineageFields(body: object): boolean {
  return JOURNAL_LINEAGE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field));
}

/** Το πρόθεμα του `errorCode` μιας άρνησης στο HTTP — ΕΝΑ σχήμα για διακομιστή και πελάτη. */
const REFUSAL_ERROR_PREFIX = 'JOURNAL_REVERSAL_';

/** `IS_REVERSAL` ⇒ `JOURNAL_REVERSAL_IS_REVERSAL` (ο κωδικός που στέλνει ο διακομιστής). */
export function journalReversalRefusalCode(reason: string): string {
  return `${REFUSAL_ERROR_PREFIX}${reason}`;
}

/** Ο λόγος άρνησης πίσω από έναν `errorCode` του διακομιστή — `null` αν δεν είναι τέτοια άρνηση. */
export function journalReversalRefusalOfErrorCode(errorCode: string): JournalReversalRefusal | null {
  if (!errorCode.startsWith(REFUSAL_ERROR_PREFIX)) return null;
  const reason = errorCode.slice(REFUSAL_ERROR_PREFIX.length);
  return (JOURNAL_REVERSAL_REFUSALS as readonly string[]).includes(reason) ? (reason as JournalReversalRefusal) : null;
}
