import 'server-only';

/**
 * @fileoverview Η ικανότητα **marketplace** του port παρόχου — δικαιούχοι, κράτηση, αποδέσμευση, αντιλογισμός, επιστροφή
 *   (ADR-943 §5.7 · Κ-2)
 * @description Η προκαταβολή ανάθεσης είναι **χρήματα τρίτου** (του μηχανικού). Δεν περνούν ποτέ από τον λογαριασμό
 *   εμπόρου της πλατφόρμας (PSD2 — ADR-943 §2.2)· τα κρατά αδειοδοτημένος PSP, που ξέρει τον δικαιούχο (KYC δικό του) και
 *   του αποδίδει. Εδώ ζει **μόνο** το συμβόλαιο· όνομα, endpoints και σφάλματα του παρόχου ζουν στον adapter του
 *   (`providers/everypay/everypay-marketplace.ts`).
 *
 *   🔑 **Δηλωτικές πράξεις, όχι εντολές** — η ιδεμποτία χωρίς κλειδί ιδεμποτίας του παρόχου:
 *   ο πάροχος δεν τεκμηριώνει `Idempotency-Key` για transfers / reversals / refunds. Μια επανάληψη μετά από timeout
 *   («έγινε ή όχι;») με εντολή «επίστρεψε 3 €» θα επέστρεφε **δύο φορές**. Γι' αυτό κάθε πράξη χρημάτων δηλώνει την
 *   **τελική κατάσταση** («συνολικά επιστραμμένα 3 €», «υπάρχει μεταφορά Χ προς Υ») και ο adapter διαβάζει πρώτα τι
 *   ισχύει και στέλνει **μόνο τη διαφορά** (reconcile — πρότυπο ελεγκτή Kubernetes). Δεύτερη εκτέλεση ⇒ καμία κίνηση.
 *   ⚠️ Δεν προστατεύει από **ταυτόχρονους** καλούντες: τη σειριοποίηση την κάνει ο καλών (συναλλαγή / lease στο έγγραφο
 *   της προκαταβολής, ADR-943 Φ4–Φ5).
 *
 *   🔑 **API = αλήθεια** (Κ-8): η εξουσιοδότηση δικαιούχου διαβάζεται από το API (`readPayee`), όχι από το webhook KYC.
 */

import type { PayoutAccountDetails, PayoutUpdate } from '@/lib/payments/payout-account';

/** Η κατάσταση λογαριασμού του δικαιούχου στον πάροχο. Μόνο `authorized` δέχεται μεταφορές. `unknown` ⇒ τιμή που δεν ξέρουμε. */
export const PAYEE_STATUSES = ['authorized', 'suspended', 'closed', 'unknown'] as const;
export type PayeeStatus = (typeof PAYEE_STATUSES)[number];

// ADR-943 §5.14 — το λεξιλόγιο KYC (κατάσταση · δικαιολογητικά) ζει στο κοινό `lib/payments/payee-kyc.ts`: το δείχνει
// και η κάρτα του πελάτη. Εισάγεται **απευθείας** από εκεί — καμία επανεξαγωγή, ένας δρόμος.

/**
 * Τα στοιχεία εγγραφής δικαιούχου. Περνούν **διαμέσου** του διακομιστή προς τον πάροχο και **δεν** αποθηκεύονται από εμάς
 * (ελαχιστοποίηση — ADR-943 §6.4): IBAN, ΑΦΜ και ταυτοποίηση ζουν στον PSP.
 */
export interface PayeeRegistration {
  readonly email: string;
  readonly phone: string;
  /** Περιγραφή δραστηριότητας (π.χ. «Ενεργειακός επιθεωρητής»). */
  readonly description: string;
  /** Νομική επωνυμία / ονοματεπώνυμο. */
  readonly legalName: string;
  /** Διακριτικός τίτλος. */
  readonly tradeName: string;
  readonly taxNumber: string;
  readonly address: string;
  readonly iban: string;
  readonly ibanBeneficiary: string;
  /** Ιδιώτης πωλητής (C2C) — αλλιώς επαγγελματίας. */
  readonly consumerToConsumer: boolean;
}

/**
 * Ό,τι δηλώθηκε στον πάροχο, **για ανάγνωση από τον ίδιο τον δικαιούχο** — ο κοινός τύπος της κάρτας (ΕΝΑΣ ορισμός).
 * Διαβάζεται από το API κάθε φορά, δεν αποθηκεύεται· το IBAN φεύγει από τον adapter **μόνο** μασκαρισμένο.
 */
export type PayeeDetails = PayoutAccountDetails;

export interface PayeeAccount {
  /** Το αναγνωριστικό του δικαιούχου στον πάροχο (EveryPay `sel_…`). */
  readonly reference: string;
  readonly status: PayeeStatus;
  /** Η hosted σελίδα KYC του παρόχου, όταν τη δίνει (EveryPay: **μόνο** στο webhook KYC). */
  readonly kycProcessUrl: string | null;
  /** Τα δηλωμένα στοιχεία· `null` όταν η απάντηση δεν τα περιέχει. */
  readonly details: PayeeDetails | null;
}

/**
 * Αλλαγή στοιχείων δικαιούχου — ο κοινός τύπος του σχήματος (`payoutUpdateSchema`, ΕΝΑΣ ορισμός). Ό,τι λείπει μένει ως
 * έχει· το ΑΦΜ δεν αλλάζει (νέο ΑΦΜ = νέος δικαιούχος)· ο λογαριασμός πίστωσης αλλάζει μόνο μαζί με τον δικαιούχο του και
 * ο πάροχος τον ξαναελέγχει με KYC πριν ισχύσει.
 */
export type PayeeUpdate = PayoutUpdate;

/** Η **επιθυμητή** μεταφορά: «από αυτή την πληρωμή, τόσα στον δικαιούχο, κρατημένα ή όχι». */
export interface PayeeTransferTarget {
  readonly paymentReference: string;
  readonly payeeReference: string;
  readonly amountMinor: number;
  /** Προμήθεια πλατφόρμας — **0** (απόφαση Giorgio 2026-11-16, ADR-943 Κ-2): ρύθμιση, όχι κώδικας. */
  readonly commissionMinor: number;
  readonly description: string;
  /** `true` ⇒ τα χρήματα δεν αποδίδονται ώσπου να αποδεσμευτούν (`releaseTransfer`). */
  readonly hold: boolean;
}

export interface PayeeTransfer {
  readonly reference: string;
  readonly paymentReference: string | null;
  readonly payeeReference: string;
  readonly amountMinor: number;
  readonly commissionMinor: number;
  readonly held: boolean;
  /** Μπήκε ήδη σε απόδοση (payout) προς τον δικαιούχο. */
  readonly paidOut: boolean;
  readonly reversedMinor: number;
}

/** Η **επιθυμητή** κατάσταση αντιλογισμού: «από αυτή τη μεταφορά, συνολικά τόσα πίσω». */
export interface TransferReversalTarget {
  readonly transferReference: string;
  readonly reversedTotalMinor: number;
  readonly description: string;
}

/** Η **επιθυμητή** κατάσταση επιστροφής: «από αυτή την πληρωμή, συνολικά τόσα πίσω στον πελάτη». */
export interface PaymentRefundTarget {
  readonly paymentReference: string;
  readonly refundedTotalMinor: number;
}

/** Τι έκανε μια δηλωτική πράξη: τίποτα (ήδη ίσχυε) ή μία κίνηση με αυτό το ποσό. */
export type ReconcileOutcome =
  | { readonly applied: false }
  | { readonly applied: true; readonly reference: string; readonly amountMinor: number };

/**
 * Ο πάροχος ως marketplace. Κάθε μέθοδος που ρωτά δίκτυο **ρίχνει** σε σφάλμα (ο καλών αποφασίζει retry). Οι πράξεις
 * χρημάτων είναι **δηλωτικές** — ιδεμποτικές σε διαδοχικές επαναλήψεις.
 */
export interface MarketplaceCapability {
  /** Εγγραφή δικαιούχου· η εξουσιοδότηση έρχεται μετά το KYC του παρόχου. Τα στοιχεία δεν αποθηκεύονται από εμάς. */
  registerPayee(registration: PayeeRegistration): Promise<PayeeAccount>;
  /** Η αλήθεια για τον δικαιούχο (εξουσιοδότηση + δηλωμένα στοιχεία) — από το API. */
  readPayee(payeeReference: string): Promise<PayeeAccount>;
  /** Αλλαγή στοιχείων (βλ. `PayeeUpdate`). Ιδεμποτική: ίδια στοιχεία ⇒ ίδια κατάσταση. */
  updatePayee(payeeReference: string, update: PayeeUpdate): Promise<PayeeAccount>;
  /** Υπάρχει (ή δημιουργείται) **η** μεταφορά της πληρωμής προς τον δικαιούχο. Δεύτερη κλήση ⇒ η ίδια μεταφορά. */
  ensureTransfer(target: PayeeTransferTarget): Promise<PayeeTransfer>;
  readTransfer(transferReference: string): Promise<PayeeTransfer>;
  /** Αποδέσμευση κρατημένης μεταφοράς. Ήδη αποδεσμευμένη ⇒ καμία αλλαγή. */
  releaseTransfer(transferReference: string): Promise<PayeeTransfer>;
  /** Αντιλογισμός ώς το συνολικό ποσό-στόχο (χρήματα πίσω από τον δικαιούχο στην πλατφόρμα-PSP). */
  reconcileTransferReversal(target: TransferReversalTarget): Promise<ReconcileOutcome>;
  /** Επιστροφή στον πελάτη ώς το συνολικό ποσό-στόχο. */
  reconcilePaymentRefund(target: PaymentRefundTarget): Promise<ReconcileOutcome>;
}
