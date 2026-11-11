/**
 * @fileoverview Το PDF ενός τιμολογίου ως **έγγραφο**: λογότυπο, όνομα αρχείου, απόδοση (ADR-ACC-018 §16)
 * @description Ο ΕΝΑΣ δρόμος προς το PDF για όλους τους καλούντες, ίδιος σε browser και διακομιστή (το jsPDF είναι
 *   ισόμορφο): λήψη/εκτύπωση από την εφαρμογή (`invoice-pdf-exporter.ts`), συνημμένο email (`send-email`) και
 *   λήψη από τη δημόσια σελίδα πληρωμής. Ως τις 2026-11-11 το λογότυπο και το όνομα αρχείου ήταν γραμμένα δύο φορές
 *   (exporter + email route).
 *
 * @see ADR-ACC-018 §8 (όνομα αρχείου) · §16
 */

import type jsPDF from 'jspdf';

import type { CompanyProfile, Invoice } from '../../types';
import { renderInvoicePDF } from './invoice-pdf-template';

/** Το λογότυπο (base64 PNG), ή `null` αν δεν φορτώνεται: το PDF αποδίδεται και χωρίς αυτό. */
export async function loadInvoiceLogo(): Promise<string | null> {
  try {
    const { PAGONIS_LOGO_BASE64 } = await import('./logo-data');
    return PAGONIS_LOGO_BASE64;
  } catch {
    return null;
  }
}

/** Ο κύριος ΚΑΔ της εταιρείας για την ενότητα myDATA, ή `null`. */
export function extractKadFromProfile(profile: CompanyProfile | null): string | null {
  if (!profile) return null;
  return profile.mainKad?.code ?? null;
}

/** Το όνομα αρχείου (ADR-ACC-018 §8): `{σειρά}-{αριθμός}_{πελάτης}_{ΕΕΕΕΜΜΗΗ}.pdf`. */
export function invoicePdfFilename(invoice: Pick<Invoice, 'series' | 'number' | 'customer' | 'issueDate'>): string {
  const customer = invoice.customer.name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  const date = invoice.issueDate.replace(/-/g, '');
  return `${invoice.series}-${invoice.number}_${customer}_${date}.pdf`;
}

export interface InvoicePdfDocumentOptions {
  readonly invoice: Invoice;
  readonly kadCode: string | null;
  /** Παρακράτηση: 0 σε κάθε σημερινό καλούντα (ADR-ACC-018 §15, «Εκτός εμβέλειας»). */
  readonly withholdingAmount?: number;
  /** Μόνο στο PDF που συνοδεύει σύνδεσμο πληρωμής (email). */
  readonly paymentPageUrl?: string | null;
}

/** Αποδίδει το PDF με το λογότυπο. Ο καλών αποφασίζει αν θα το αποθηκεύσει, θα το επισυνάψει ή θα το σερβίρει. */
export async function renderInvoicePdfDocument(options: InvoicePdfDocumentOptions): Promise<jsPDF> {
  return renderInvoicePDF({
    invoice: options.invoice,
    logoBase64: await loadInvoiceLogo(),
    kadCode: options.kadCode,
    withholdingAmount: options.withholdingAmount ?? 0,
    paymentPageUrl: options.paymentPageUrl ?? null,
  });
}
