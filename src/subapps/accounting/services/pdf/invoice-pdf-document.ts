/**
 * @fileoverview Το PDF ενός τιμολογίου ως **έγγραφο**: όνομα αρχείου, απόδοση (ADR-ACC-018 §16)
 * @description Ο ΕΝΑΣ δρόμος προς το PDF για όλους τους καλούντες, ίδιος σε browser και διακομιστή (το jsPDF είναι
 *   ισόμορφο): λήψη/εκτύπωση από την εφαρμογή (`invoice-pdf-exporter.ts`), συνημμένο email (`send-email`) και
 *   λήψη από τη δημόσια σελίδα πληρωμής. Ως τις 2026-11-11 το λογότυπο και το όνομα αρχείου ήταν γραμμένα δύο φορές
 *   (exporter + email route).
 *
 *   🔑 **Το λογότυπο το φέρνει ο καλών** (ADR-ACC-018 §17.3): τα bytes της αναφοράς `issuer.logo`, με τον φορτωτή του
 *   περιβάλλοντός του — server `readPdfBrandImage` · browser `fetchPdfBrandImage`, ίδιος έλεγχος sha256. Αυτό το
 *   module **δεν** διαβάζει πια ενσωματωμένο λογότυπο (ως τη Φ1β: `logo-data.ts`, το σήμα Παγώνη σε **κάθε** χώρο).
 *
 * @see ADR-ACC-018 §8 (όνομα αρχείου) · §16 · §17.3
 */

import type jsPDF from 'jspdf';

import type { PdfBrandImage } from '@/lib/company/brand-logo-image';

import type { CompanyProfile, Invoice } from '../../types';
import { renderInvoicePDF } from './invoice-pdf-template';

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
  /** Τα bytes της αναφοράς `invoice.issuer.logo` — `null` ⇒ χωρίς λογότυπο (και κάθε τιμολόγιο πριν τη Φ1β). */
  readonly logo: PdfBrandImage | null;
  readonly kadCode: string | null;
  /** Παρακράτηση: 0 σε κάθε σημερινό καλούντα (ADR-ACC-018 §15, «Εκτός εμβέλειας»). */
  readonly withholdingAmount?: number;
  /** Μόνο στο PDF που συνοδεύει σύνδεσμο πληρωμής (email). */
  readonly paymentPageUrl?: string | null;
}

/** Αποδίδει το PDF. Ο καλών αποφασίζει αν θα το αποθηκεύσει, θα το επισυνάψει ή θα το σερβίρει. */
export async function renderInvoicePdfDocument(options: InvoicePdfDocumentOptions): Promise<jsPDF> {
  return renderInvoicePDF({
    invoice: options.invoice,
    logo: options.logo,
    kadCode: options.kadCode,
    withholdingAmount: options.withholdingAmount ?? 0,
    paymentPageUrl: options.paymentPageUrl ?? null,
  });
}
