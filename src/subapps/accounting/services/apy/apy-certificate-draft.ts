/**
 * @fileoverview Βεβαίωση Παρακράτησης — ο ΥΠΟΛΟΓΙΣΜΟΣ (γραμμές, σύνολα, στιγμιότυπα) από το καθολικό τιμολογίων
 * @description Ποια παραστατικά μπαίνουν στη βεβαίωση ενός πελάτη για μία χρήση και με ποια ποσά — ΟΛΗ η εμβέλεια
 *   ή σφάλμα. Το καλούν η προεπισκόπηση (`GET …/apy-certificates/draft`) και η δημιουργία (`POST …/apy-certificates`):
 *   ό,τι είδε ο χρήστης είναι ό,τι αποθηκεύεται, γιατί το υπολογίζει η ΙΔΙΑ συνάρτηση.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-30, ADR-ACC-010 §2.1.1 «σελίδα ≠ καθολικό»): ο διάλογος δημιουργίας διάβαζε τη ΣΕΛΙΔΑ
 *   της λίστας τιμολογίων (`data.invoices` — το πεδίο είναι `items`, άρα ΠΑΝΤΑ κενό) με φίλτρο `vatNumber` που η
 *   λίστα δεν γνωρίζει ⇒ «κανένα επιλέξιμο τιμολόγιο» για κάθε πελάτη. Και όταν θα δούλευε, ο ΠΕΛΑΤΗΣ (browser)
 *   θα υπολόγιζε σύνολα που ο διακομιστής αποθήκευε τυφλά, με ακυρωμένα και πιστωμένα τιμολόγια μέσα.
 *
 * 🏛️ SAP FI (Withholding Tax Reporting) · Xero/QuickBooks (1099): η βεβαίωση **παράγεται** από το καθολικό στον
 *   διακομιστή — δεν συναρμολογείται στην οθόνη.
 *
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου · ADR-ACC-010 §2.1.1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { InvoiceLedgerQuery } from '../../types/customer-balance';
import type { Invoice } from '../../types/invoice';
import type {
  APYCertificateCustomer,
  APYCertificateLineItem,
  APYCertificateProvider,
  CompanyProfile,
} from '../../types';
import { isCreditNote, isVoidedInvoice } from '../../utils/invoice-open-amount';
import { roundToTwo } from '../../utils/math';

// ============================================================================
// ΤΙ ΜΠΑΙΝΕΙ ΣΤΗ ΒΕΒΑΙΩΣΗ
// ============================================================================

/**
 * Παραστατικό της χρήσης με πραγματική παρακράτηση. ΟΧΙ πιστωτικό, ΟΧΙ ακυρωμένο (`void` — νομικά δεν εκδόθηκε),
 * ΟΧΙ πιστωμένο: το πιστωτικό ακυρώνει **ολόκληρο** το τιμολόγιο (`reversal-service`), άρα και την παρακράτησή του —
 * ο παλιός φίλτρος του διαλόγου απέκλειε μόνο το πρώτο και θα βεβαίωνε φόρο που δεν παρακρατήθηκε ποτέ.
 */
export function isWithholdingCertifiable(
  invoice: Pick<Invoice, 'type' | 'mydata' | 'creditNoteInvoiceId' | 'fiscalYear' | 'withholdingAmount'>,
  fiscalYear: number
): boolean {
  return (
    invoice.fiscalYear === fiscalYear &&
    !isCreditNote(invoice) &&
    !isVoidedInvoice(invoice) &&
    !invoice.creditNoteInvoiceId &&
    (invoice.withholdingAmount ?? 0) > 0
  );
}

/**
 * Ο συντελεστής της γραμμής: ο αποθηκευμένος — ή, σε παλιό παραστατικό χωρίς συντελεστή, ο **παράγωγος** από τα
 * δύο ποσά. ⚠️ Ποτέ σταθερό «20»: ο νόμος έχει 1 · 3 · 20 και ένα εφευρημένο νούμερο σε φορολογικό έγγραφο είναι
 * χειρότερο από ένα υπολογισμένο.
 */
function withholdingRateOf(invoice: Pick<Invoice, 'withholdingRate' | 'withholdingAmount' | 'totalNetAmount'>): number {
  if (typeof invoice.withholdingRate === 'number') return invoice.withholdingRate;
  return invoice.totalNetAmount > 0 ? roundToTwo(((invoice.withholdingAmount ?? 0) / invoice.totalNetAmount) * 100) : 0;
}

function lineItemOf(invoice: Invoice): APYCertificateLineItem {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: `${invoice.series}-${invoice.number}`,
    issueDate: invoice.issueDate,
    netAmount: invoice.totalNetAmount,
    withholdingRate: withholdingRateOf(invoice),
    withholdingAmount: invoice.withholdingAmount ?? 0,
  };
}

/** Τα στοιχεία του πελάτη όπως γράφτηκαν στο **πιο πρόσφατο** παραστατικό της βεβαίωσης (ισχύουν στο τέλος χρήσης). */
function customerSnapshotOf(invoice: Invoice): APYCertificateCustomer {
  return {
    name: invoice.customer.name,
    vatNumber: invoice.customer.vatNumber ?? '',
    taxOffice: invoice.customer.taxOffice ?? null,
    address: invoice.customer.address ?? null,
    city: invoice.customer.city ?? null,
  };
}

// ============================================================================
// Ο ΥΠΟΛΟΓΙΣΜΟΣ
// ============================================================================

/** Η βεβαίωση πριν αποθηκευτεί — ό,τι δείχνει η προεπισκόπηση και ό,τι γράφει η δημιουργία. */
export interface APYCertificateDraft {
  readonly fiscalYear: number;
  readonly customerId: string;
  /** `null` ⇒ καμία επιλέξιμη γραμμή — δεν υπάρχει βεβαίωση να εκδοθεί. */
  readonly customer: APYCertificateCustomer | null;
  readonly lineItems: readonly APYCertificateLineItem[];
  readonly totalNetAmount: number;
  readonly totalWithholdingAmount: number;
}

/**
 * Καθαρός υπολογισμός πάνω σε ΟΛΑ τα παραστατικά του πελάτη. Γραμμές κατά ημερομηνία έκδοσης (η σειρά της
 * σάρωσης)· σύνολα στρογγυλεμένα στο λεπτό **μία φορά**, στο τέλος — όχι ανά γραμμή, ώστε το άθροισμα να μη
 * «χάνει» λεπτά.
 */
export function buildAPYCertificateDraft(
  invoices: readonly Invoice[],
  customerId: string,
  fiscalYear: number
): APYCertificateDraft {
  const eligible = invoices.filter((invoice) => isWithholdingCertifiable(invoice, fiscalYear));
  const lineItems = eligible.map(lineItemOf);
  const latest = eligible[eligible.length - 1];
  return {
    fiscalYear,
    customerId,
    customer: latest ? customerSnapshotOf(latest) : null,
    lineItems,
    totalNetAmount: roundToTwo(lineItems.reduce((sum, line) => sum + line.netAmount, 0)),
    totalWithholdingAmount: roundToTwo(lineItems.reduce((sum, line) => sum + line.withholdingAmount, 0)),
  };
}

/**
 * Από το καθολικό: ΟΛΑ τα παραστατικά του πελάτη ως το τέλος της χρήσης (δείκτης `companyId+customer.contactId+
 * issueDate`). Πετά αν η σάρωση αποτύχει — ποτέ «κενή βεβαίωση» από σφάλμα.
 */
export async function computeAPYCertificateDraft(
  repository: { collectInvoices: (query: InvoiceLedgerQuery) => Promise<Invoice[]> },
  customerId: string,
  fiscalYear: number
): Promise<APYCertificateDraft> {
  const invoices = await repository.collectInvoices({
    scope: { kind: 'customer', customerId, asOf: `${fiscalYear}-12-31` },
  });
  return buildAPYCertificateDraft(invoices, customerId, fiscalYear);
}

/** Στιγμιότυπο παρόχου από το προφίλ εταιρείας — στον διακομιστή, όχι από το σώμα του αιτήματος. */
export function apyProviderOf(profile: CompanyProfile): APYCertificateProvider {
  return {
    name: profile.businessName,
    vatNumber: profile.vatNumber,
    taxOffice: profile.taxOffice ?? '',
    address: profile.address ?? '',
    city: profile.city ?? '',
    postalCode: profile.postalCode ?? '',
    profession: profile.profession ?? '',
    phone: profile.phone ?? null,
    email: profile.email ?? null,
  };
}
