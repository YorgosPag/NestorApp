/**
 * @fileoverview Τιμολόγιο → **δημόσια όψη** για τον κάτοχο του συνδέσμου πληρωμής (ADR-ACC-018 §16)
 * @description Καθαρή προβολή με ρητή λίστα πεδίων. Χτίζει νέο αντικείμενο και δεν αντιγράφει το έγγραφο, οπότε
 *   πεδίο που προστίθεται στο `Invoice` δεν διαρρέει από μόνο του. Τι μένει έξω το γράφει το
 *   `types/invoice-public-view.ts`.
 *
 *   Γλώσσα: τη διαλέγει ο **επισκέπτης** (αποθηκευμένη προτίμηση, αλλιώς γλώσσα browser, ο υπάρχων κριτής του
 *   `i18n/config.ts`), όχι η χώρα του πελάτη. Ο λογιστής του πελάτη στο εξωτερικό διαβάζει στη γλώσσα του.
 *
 *   Ο καλών δίνει τιμολόγιο **με τους λογαριασμούς που θα τύπωνε σήμερα** (`withCurrentPaymentAccounts`:
 *   πρόχειρο ⇒ μητρώο, εκδομένο ⇒ στιγμιότυπο). Η προβολή δεν αποφασίζει ποιοι λογαριασμοί ισχύουν.
 *
 * @see ADR-ACC-018 §15 · §16
 */

import type { ChatChannelRef } from '@/lib/contact/social-chat-links';

import type { Invoice, InvoiceCustomer, InvoiceIssuer } from '../../types/invoice';
import type {
  InvoicePublicIssuer,
  InvoicePublicParty,
  InvoicePublicPayment,
  InvoicePublicView,
} from '../../types/invoice-public-view';
import {
  invoicePayableAmount, invoicePaymentReference, paymentBeneficiaryOf, paymentQrPayload,
} from '../payments/invoice-payment-instructions';
import { invoiceAmountDueNow, invoicePaymentStanding } from '../payments/invoice-payment-link';
import type { HumanLanguage } from '@/i18n/languages';
import { uomLabelIn } from '@/lib/uom/uom-label-bundle';

/** Παρακράτηση: 0 σε κάθε σημερινό καλούντα (ADR-ACC-018 §15, «Εκτός εμβέλειας»). Ίδια τιμή με PDF και email. */
const WITHHOLDING_AMOUNT = 0;

/** Η μονάδα σε κάθε γλώσσα, με τον ίδιο μορφοποιητή με το PDF. Η σελίδα διαλέγει τη γλώσσα του επισκέπτη. */
function unitLabels(unit: string): Readonly<Record<HumanLanguage, string>> {
  return { el: uomLabelIn(unit, 'el'), en: uomLabelIn(unit, 'en') };
}

function publicCustomer(customer: InvoiceCustomer): InvoicePublicParty {
  return {
    name: customer.name,
    vatNumber: customer.vatNumber,
    taxOffice: customer.taxOffice,
    address: customer.address,
    city: customer.city,
    postalCode: customer.postalCode,
  };
}

function publicIssuer(issuer: InvoiceIssuer): InvoicePublicIssuer {
  return {
    name: issuer.name,
    vatNumber: issuer.vatNumber || null,
    taxOffice: issuer.taxOffice || null,
    address: issuer.address || null,
    city: issuer.city || null,
    postalCode: issuer.postalCode || null,
    profession: issuer.profession || null,
    email: issuer.email,
    phone: issuer.phone ?? issuer.mobile,
    website: issuer.website,
  };
}

/** Οι οδηγίες πληρωμής με το **υπόλοιπο**: ένα QR ανά λογαριασμό, ίδια αιτιολογία με το PDF. */
function publicPayment(invoice: Invoice, amountDue: number): InvoicePublicPayment {
  const reference = invoicePaymentReference(invoice);
  const accounts = (invoice.issuer.bankAccounts ?? []).map((account) => {
    const beneficiary = paymentBeneficiaryOf(account, invoice.issuer.name);
    return {
      bankName: account.bankName,
      iban: account.iban.replace(/\s+/g, ''),
      bic: account.bic ?? null,
      beneficiary,
      epcQrPayload: paymentQrPayload({
        account, beneficiaryName: beneficiary, currency: invoice.currency, amount: amountDue, remittance: reference.remittance,
      }),
    };
  });
  return { creditorReference: reference.rf, remittance: reference.remittance, accounts };
}

/**
 * Η δημόσια όψη. Οδηγίες πληρωμής **μόνο** όταν οφείλεται ποσό και υπάρχει λογαριασμός.
 *
 * @param today Η σημερινή ημερομηνία (`YYYY-MM-DD`) για το «ληξιπρόθεσμο». Παράμετρος, ώστε η προβολή να μένει καθαρή.
 * @param issuerChatChannels Τα **τρέχοντα** κανάλια συνομιλίας της εταιρείας. Τα διαβάζει ο καλών, όχι η προβολή.
 */
export function buildInvoicePublicView(
  invoice: Invoice, today: string, issuerChatChannels: readonly ChatChannelRef[],
): InvoicePublicView {
  const standing = invoicePaymentStanding(invoice);
  const amountDue = invoiceAmountDueNow(invoice);
  const hasAccounts = (invoice.issuer.bankAccounts ?? []).length > 0;
  return {
    invoiceId: invoice.invoiceId,
    series: invoice.series,
    number: invoice.number,
    type: invoice.type,
    documentStatus: invoice.mydata?.status ?? 'draft',
    mark: invoice.mydata?.mark ?? null,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    issuer: publicIssuer(invoice.issuer),
    issuerChatChannels,
    customer: publicCustomer(invoice.customer),
    lines: invoice.lineItems.map(({ lineNumber, description, quantity, unit, unitPrice, vatRate, netAmount }) => ({
      lineNumber, description, quantity, unit, unitLabel: unitLabels(unit), unitPrice, vatRate, netAmount,
    })),
    vatBreakdown: invoice.vatBreakdown.map(({ vatRate, netAmount, vatAmount }) => ({ vatRate, netAmount, vatAmount })),
    totalNetAmount: invoice.totalNetAmount,
    totalVatAmount: invoice.totalVatAmount,
    totalGrossAmount: invoice.totalGrossAmount,
    payableAmount: invoicePayableAmount(invoice, WITHHOLDING_AMOUNT),
    amountDue,
    standing,
    overdue: standing === 'payable' && invoice.dueDate !== null && invoice.dueDate < today,
    payment: standing === 'payable' && hasAccounts ? publicPayment(invoice, amountDue) : null,
    notes: invoice.notes,
  };
}
