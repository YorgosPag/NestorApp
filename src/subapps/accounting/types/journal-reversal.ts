/**
 * @fileoverview Accounting Subapp — Αντιλογισμός εγγραφής Βιβλίου Ε-Ε (τύποι + λεξιλόγια-ρίζες)
 * @description Καταχωρημένη εγγραφή ΔΕΝ σβήνεται και ΔΕΝ αλλάζει ποσό: διορθώνεται με ΑΝΤΙΛΟΓΙΣΜΟ (storno —
 *   ίδια πεδία, αντίθετα ποσά), όπως SAP FB08 και DATEV Generalumkehr (GoBD / §146(4) AO). Η αρχική μένει, σημαδεμένη
 *   `REVERSED`, και οι δύο μετρούν στην περίοδό τους — ο ελεγκτής βλέπει το λάθος ΚΑΙ τη διόρθωσή του.
 *
 * @see ADR-ACC-010 §2.1.1 Φάση 8
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from './journal';

/** Οι λόγοι χειροκίνητου αντιλογισμού — ΕΝΑ λεξιλόγιο για zod, διάλογο και ίχνος (το κείμενο το δίνει το i18n). */
export const JOURNAL_REVERSAL_REASON_CODES = [
  'ENTRY_ERROR',
  'DUPLICATE',
  'WRONG_AMOUNT',
  'WRONG_CATEGORY',
  'WRONG_DATE',
  'OTHER',
] as const;

export type JournalReversalReasonCode = (typeof JOURNAL_REVERSAL_REASON_CODES)[number];

/** Ο λόγος που ζητά ΥΠΟΧΡΕΩΤΙΚΑ σημείωση (όπως η ακύρωση τιμολογίου με `OTHER`). */
export const JOURNAL_REVERSAL_REASON_REQUIRING_NOTES: JournalReversalReasonCode = 'OTHER';

/** Ποιος ζήτησε τον αντιλογισμό — ο χρήστης από το βιβλίο, ή η ακύρωση τιμολογίου (πιστωτικό / void). */
export type JournalReversalTrigger = 'manual' | 'invoice_cancellation';

/**
 * Πότε καταχωρείται ο αντιλογισμός:
 * - `original_period_if_open` — στην ημερομηνία της αρχικής αν η περίοδός της είναι ανοιχτή (λάθος και διόρθωση
 *   στην ίδια περίοδο, καθαρά σύνολα — SAP FB08 προεπιλογή), αλλιώς σήμερα (SAP: «closed period ⇒ open date»)·
 * - `today` — σήμερα (η ακύρωση τιμολογίου είναι γεγονός ΣΗΜΕΡΑ: το πιστωτικό έχει σημερινή ημερομηνία).
 */
export type JournalReversalDatePolicy = 'original_period_if_open' | 'today';

/** Γιατί ΔΕΝ επιτρέπεται αντιλογισμός — κωδικός (ο πελάτης τον μεταφράζει). */
export const JOURNAL_REVERSAL_REFUSALS = [
  /** Η εγγραφή είναι ήδη αντιλογισμός — η διόρθωση γίνεται με νέα σωστή εγγραφή, όχι storno του storno */
  'IS_REVERSAL',
  /** Ανήκει σε υποσύστημα (αποσβέσεις) — αντιλογίζεται ΜΟΝΟ από εκεί (SAP: Asset Accounting) */
  'SUBSYSTEM_OWNED',
  /** Γεννήθηκε από τιμολόγιο — ακυρώνεται με πιστωτικό/void του τιμολογίου (SAP: VF11, όχι FB08) */
  'INVOICE_LINKED',
  /** Γεννήθηκε από επιβεβαιωμένο παραστατικό εξόδου — ακυρώνεται από το παραστατικό (SAP: MR8M) */
  'DOCUMENT_LINKED',
] as const;

export type JournalReversalRefusal = (typeof JOURNAL_REVERSAL_REFUSALS)[number];

/** Το αίτημα προς τον ΕΝΑ γραφέα αντιλογισμού. */
export interface JournalReversalRequest {
  readonly entryId: string;
  readonly trigger: JournalReversalTrigger;
  readonly datePolicy: JournalReversalDatePolicy;
  /** Κωδικός λόγου (χειροκίνητος: `JournalReversalReasonCode` · τιμολόγιο: `CancellationReasonCode`) */
  readonly reasonCode: string;
  /** Ελεύθερο κείμενο του χρήστη (ή `null`) */
  readonly reasonNotes: string | null;
  /** Η ημέρα της λογιστικής (Αθήνα, `YYYY-MM-DD`) — από τον καλούντα, για ντετερμινισμό */
  readonly today: string;
}

export type JournalReversalOutcome =
  | {
      readonly kind: 'reversed';
      readonly originalEntryId: string;
      readonly reversalEntryId: string;
      readonly reversalDate: string;
      /** Η αρχική περίοδος ήταν κλειστή ⇒ ο αντιλογισμός πήγε σε ανοιχτή (SAP: alternative posting date) */
      readonly crossPeriod: boolean;
    }
  /** Ιδεμπότητα: είχε ήδη αντιλογιστεί — καμία εγγραφή, ίδια απάντηση */
  | { readonly kind: 'already_reversed'; readonly originalEntryId: string; readonly reversalEntryId: string | null }
  | { readonly kind: 'refused'; readonly reason: JournalReversalRefusal }
  | { readonly kind: 'not_found' };

/**
 * Τα πεδία που αλλάζουν σε καταχωρημένη εγγραφή — ΜΟΝΟ κείμενο (SAP FB02: ποσό, λογαριασμός, ημερομηνία ΠΟΤΕ).
 * Όλα τα άλλα διορθώνονται με αντιλογισμό + νέα εγγραφή.
 */
export const JOURNAL_EDITABLE_FIELDS = ['description', 'notes'] as const satisfies readonly (keyof JournalEntry)[];

/**
 * Τα πεδία ΓΕΝΕΑΛΟΓΙΑΣ — τα γράφει ΜΟΝΟ ο γραφέας αντιλογισμού. Πελάτης που τα στέλνει στη δημιουργία θα έφτιαχνε
 * «αντιλογισμό» χωρίς αρχική (αμετάβλητο, και μάλιστα ψεύτικο ίχνος).
 */
export const JOURNAL_LINEAGE_FIELDS = [
  'status',
  'isReversal',
  'reversalEntryId',
  'originalEntryId',
  'reversedAt',
  'reversedBy',
  'reversalTrigger',
  'cancellationReasonCode',
  'cancellationNotes',
  'crossPeriodReversal',
  'originalPeriod',
  'reversalPeriod',
] as const satisfies readonly (keyof JournalEntry)[];
