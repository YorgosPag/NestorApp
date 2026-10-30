/**
 * @fileoverview Σύνοψη λίστας τιμολογίων — οι κάρτες της οθόνης πάνω σε ΟΛΗ την εμβέλεια των φίλτρων
 * @description Τα τέσσερα νούμερα της οθόνης «Τιμολόγια» (σύνολο · ανεξόφλητο · μήνας · εκκρεμή myDATA), υπολογισμένα
 *   στον διακομιστή από `collectInvoiceList` — ίδια φίλτρα με τη λίστα, χωρίς σελίδα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-30, ADR-ACC-010 §2.1.1 «σελίδα ≠ καθολικό»): οι κάρτες άθροιζαν τις ΦΟΡΤΩΜΕΝΕΣ γραμμές ⇒
 *   με 2+ σελίδες το «Ανεξόφλητο υπόλοιπο» ήταν το ανεξόφλητο της πρώτης σελίδας. Επιπλέον: μετρούσε πιστωτικά,
 *   ακυρωμένα και πιστωμένα ως ανεξόφλητα, και ο «τρέχων μήνας» κρινόταν με την ώρα του browser, όχι της Αθήνας.
 *
 * 🏛️ Xero / QuickBooks: τα σύνολα πάνω από μια λίστα είναι **άθροισμα του διακομιστή ανά φίλτρο**, ανεξάρτητο από τη σελίδα.
 *
 * @see ADR-ACC-010 §2.1.1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Invoice } from '../../types/invoice';
import { accountingDayOf } from '../../utils/accounting-day';
import { invoiceOpenAmount, isCollectibleInvoice, isVoidedInvoice } from '../../utils/invoice-open-amount';
import { roundToTwo } from '../../utils/math';

export interface InvoiceListSummary {
  /** Όσες γραμμές έχει η λίστα με αυτά τα φίλτρα, ξετυλιγμένη ως το τέλος. */
  readonly invoiceCount: number;
  /** Ανοιχτό ποσό των **εισπρακτέων** (όχι πιστωτικό · όχι ακυρωμένο · όχι πιστωμένο) που δεν εξοφλήθηκαν. */
  readonly unpaidBalance: number;
  /** Πόσα από αυτά — ανεξόφλητα **και** μερικώς εξοφλημένα (ο ίδιος κανόνας με το `unpaidBalance`). */
  readonly unpaidCount: number;
  /** Εκδόθηκαν μέσα στον ημερολογιακό μήνα του `asOf` (Αθήνα) — χωρίς ακυρωμένα (νομικά δεν εκδόθηκαν). */
  readonly issuedThisMonth: number;
  /** Πρόχειρα στο myDATA — δεν διαβιβάστηκαν ακόμη. */
  readonly pendingMydata: number;
  /** Η ημέρα αναφοράς του «μήνα» (`YYYY-MM-DD`, Αθήνα). */
  readonly asOf: string;
}

/** Ο μήνας (`YYYY-MM`) μιας ημέρας λογιστικής — ή `null` για χαλασμένη ημερομηνία (δεν μετρά, δεν πετά). */
function monthOf(value: string): string | null {
  return accountingDayOf(value)?.slice(0, 7) ?? null;
}

/**
 * @param invoices ΟΛΗ η εμβέλεια (`collectInvoiceList`) — ποτέ σελίδα
 * @param asOf η σημερινή ημέρα λογιστικής (`accountingToday()`) — παράμετρος ώστε η άγκυρα να μην εξαρτάται από ρολόι
 */
export function summarizeInvoiceList(invoices: readonly Invoice[], asOf: string): InvoiceListSummary {
  const month = monthOf(asOf);
  let unpaidBalance = 0;
  let unpaidCount = 0;
  let issuedThisMonth = 0;
  let pendingMydata = 0;

  for (const invoice of invoices) {
    if (isCollectibleInvoice(invoice) && invoice.paymentStatus !== 'paid') {
      unpaidBalance += invoiceOpenAmount(invoice);
      unpaidCount += 1;
    }
    if (month !== null && !isVoidedInvoice(invoice) && monthOf(invoice.issueDate) === month) issuedThisMonth += 1;
    if (invoice.mydata?.status === 'draft') pendingMydata += 1;
  }

  return {
    invoiceCount: invoices.length,
    // Στρογγυλοποίηση ΜΙΑ φορά, στο τέλος — όχι ανά γραμμή.
    unpaidBalance: roundToTwo(unpaidBalance),
    unpaidCount,
    issuedThisMonth,
    pendingMydata,
    asOf,
  };
}
