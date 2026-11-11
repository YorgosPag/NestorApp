/**
 * @fileoverview Οι οδηγίες πληρωμής ενός τιμολογίου ως **δεδομένα**: αιτιολογία (RF), δικαιούχος, EPC QR payload
 * @description Ο ΕΝΑΣ ορισμός για το PDF (`invoice-pdf-sections.ts` σχεδιάζει) **και** για τη δημόσια σελίδα
 *   πληρωμής (`invoice-public-view.ts` προβάλλει), ώστε η αιτιολογία, ο δικαιούχος και το QR να είναι ίδια σε χαρτί
 *   και οθόνη. Καθαρές συναρτήσεις χωρίς jsPDF: ως τις 2026-11-11 ζούσαν μέσα στα αρχεία σχεδίασης του PDF.
 *
 * @see ADR-ACC-018 §15 · §16 · EN 16931 BT-83 / BT-85 · EPC069-12
 */

import type { Invoice, InvoicePaymentAccount } from '../../types/invoice';
import { invoiceCreditorReference } from '../engines/matching-reference';
import { formatCreditorReference } from './creditor-reference';
import { buildEpcQrPayload } from './epc-qr-payload';

/** Το ΠΛΗΡΩΤΕΟ — ο ΕΝΑΣ αριθμός για τα σύνολα του PDF, το EPC QR του και τη δημόσια σελίδα (ADR-ACC-018 §15). */
export function invoicePayableAmount(invoice: Pick<Invoice, 'totalGrossAmount'>, withholdingAmount: number): number {
  return invoice.totalGrossAmount - withholdingAmount;
}

/** Το EPC QR είναι **μόνο** για ευρώ (SEPA Credit Transfer). */
const EPC_CURRENCY = 'EUR';

export interface InvoicePaymentReference {
  /** Το ISO 11649 RF, ή `null` όταν η σειρά δεν το επιτρέπει. */
  readonly rf: string | null;
  /** Η τυπωμένη μορφή: «RF.. .... (Α-7)» ή σκέτο «Α-7». */
  readonly label: string;
  /** Ό,τι μπαίνει στο πεδίο αιτιολογίας της μεταφοράς και στο QR: το RF, αλλιώς «σειρά-αριθμός». */
  readonly remittance: string;
}

/** Η αιτιολογία πληρωμής (EN 16931 BT-83): το RF όταν ορίζεται, πάντα μαζί με τον αριθμό του τιμολογίου. */
export function invoicePaymentReference(invoice: Pick<Invoice, 'series' | 'number'>): InvoicePaymentReference {
  const rf = invoiceCreditorReference(invoice.series, invoice.number);
  const number = `${invoice.series}-${invoice.number}`;
  return { rf, label: rf ? `${formatCreditorReference(rf)} (${number})` : number, remittance: rf ?? number };
}

/** Ο δικαιούχος (EN 16931 BT-85): ο δηλωμένος του λογαριασμού, αλλιώς η επωνυμία του εκδότη. */
export function paymentBeneficiaryOf(account: InvoicePaymentAccount, issuerName: string): string {
  return account.holderName?.trim() || issuerName;
}

export interface PaymentQrRequest {
  readonly account: InvoicePaymentAccount;
  /** Δικαιούχος όπως τυπώνεται (ο λογαριασμός ή, αλλιώς, η επωνυμία του εκδότη) */
  readonly beneficiaryName: string;
  readonly currency: string;
  /** Το ποσό: στο PDF το πληρωτέο των συνόλων, στη σελίδα το υπόλοιπο που οφείλεται τώρα */
  readonly amount: number;
  /** RF ή, αλλιώς, ο αριθμός του τιμολογίου */
  readonly remittance: string;
}

/** Το payload, ή `null` όταν το QR δεν ορίζεται (μη ευρώ, μηδενικό ποσό, όρια του EPC). */
export function paymentQrPayload(request: PaymentQrRequest): string | null {
  if (request.currency !== EPC_CURRENCY) return null;
  const result = buildEpcQrPayload({
    beneficiaryName: request.beneficiaryName,
    iban: request.account.iban,
    bic: request.account.bic ?? null,
    amount: request.amount,
    remittance: request.remittance,
  });
  return result.ok ? result.payload : null;
}
