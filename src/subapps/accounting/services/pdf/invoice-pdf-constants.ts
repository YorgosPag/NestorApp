/**
 * @fileoverview Invoice PDF Constants — Brand colors, layout, labels, helpers
 * @description Shared constants for invoice PDF rendering (ADR-065 SRP split).
 * @see ADR-ACC-018 Invoice PDF Generation
 */

import type jsPDF from 'jspdf';
import type { InvoiceType } from '../../types';

// ============================================================================
// CONSTANTS — Brand Colors & Layout
// ============================================================================

/** RGB color tuple type */
export type RGB = readonly [number, number, number];

/** Pagonis brand colors (RGB tuples) */
export const COLORS: Record<string, RGB> = {
  navy: [30, 58, 95],
  navyDark: [21, 45, 74],
  gray: [74, 74, 74],
  grayLight: [130, 130, 130],
  grayBorder: [220, 220, 220],
  white: [255, 255, 255],
  greenPaid: [34, 139, 34],
  orangePartial: [255, 140, 0],
  redUnpaid: [200, 50, 50],
};

/** Page layout constants (mm) */
export const LAYOUT = {
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 20,
  pageWidth: 210,
  pageHeight: 297,
  contentWidth: 180,
};

/** Logo dimensions (mm) */
export const LOGO = {
  width: 25,
  height: 25,
};

// ============================================================================
// BILINGUAL LABELS
// ============================================================================

export const LABELS = {
  issuer: 'ΕΚΔΟΤΗΣ / ISSUER',
  customer: 'ΠΕΛΑΤΗΣ / CUSTOMER',
  vatNumber: 'ΑΦΜ / VAT No',
  taxOffice: 'ΔΟΥ / Tax Office',
  profession: 'Δραστηριότητα / Activity',
  address: 'Διεύθυνση / Address',
  phone: 'Τηλ / Tel',
  mobile: 'Κιν / Mob',
  email: 'Email',
  invoiceDate: 'Ημ/νία Έκδοσης / Issue Date',
  dueDate: 'Ημ/νία Λήξης / Due Date',
  lineNumber: '#',
  description: 'Περιγραφή / Description',
  unit: 'Μ.Μ. / Unit',
  quantity: 'Ποσ. / Qty',
  unitPrice: 'Τιμή / Price',
  discount: 'Έκπτ. / Disc.',
  vatRate: 'ΦΠΑ% / VAT%',
  lineTotal: 'Σύνολο / Total',
  subtotal: 'Καθαρό Σύνολο / Subtotal',
  vatAmount: 'Σύνολο ΦΠΑ / VAT Total',
  grossTotal: 'Γενικό Σύνολο / Grand Total',
  withholding: 'Παρακράτηση / Withholding',
  payable: 'ΠΛΗΡΩΤΕΟ / PAYABLE',
  paymentMethod: 'Τρόπος Πληρωμής / Payment Method',
  bankAccounts: 'ΤΡΑΠΕΖΙΚΟΙ ΛΟΓΑΡΙΑΣΜΟΙ / BANK ACCOUNTS',
  bank: 'Τράπεζα / Bank',
  iban: 'IBAN',
  mydata: 'myDATA',
  mark: 'ΜΑΡΚ',
  kad: 'ΚΑΔ',
  notes: 'Σημειώσεις / Notes',
  creditRef: 'Σχετ. Παραστατικό / Related Document',
  page: 'Σελίδα / Page',
} as const;

/** Invoice type titles — bilingual */
export const INVOICE_TITLES: Record<InvoiceType, { el: string; en: string }> = {
  service_invoice: { el: 'ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ', en: 'SERVICE INVOICE' },
  sales_invoice: { el: 'ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ', en: 'SALES INVOICE' },
  retail_receipt: { el: 'ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ ΠΩΛΗΣΗΣ', en: 'RETAIL RECEIPT' },
  service_receipt: { el: 'ΑΠΟΔΕΙΞΗ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ', en: 'SERVICE RECEIPT' },
  credit_invoice: { el: 'ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ', en: 'CREDIT INVOICE' },
  service_invoice_eu: { el: 'ΤΙΜΟΛΟΓΙΟ Π.Υ. ΕΝΔΟΚΟΙΝΟΤΙΚΟ', en: 'EU SERVICE INVOICE' },
  service_invoice_3rd: { el: 'ΤΙΜΟΛΟΓΙΟ Π.Υ. ΤΡΙΤΕΣ ΧΩΡΕΣ', en: '3RD COUNTRY SERVICE INVOICE' },
};

/** Payment method labels — bilingual */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Μετρητά / Cash',
  bank_transfer: 'Τραπεζική Μεταφορά / Bank Transfer',
  card: 'Κάρτα / Card',
  check: 'Επιταγή / Check',
  credit: 'Πίστωση / Credit',
};

// ============================================================================
// HELPERS
// ============================================================================

/** Check if content needs a page break; if so, add page and return reset Y. */
export function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > LAYOUT.pageHeight - LAYOUT.marginBottom) {
    pdf.addPage();
    return LAYOUT.marginTop;
  }
  return y;
}

/** Draw a horizontal rule. */
export function drawHR(pdf: jsPDF, y: number, color: RGB = COLORS.grayBorder): number {
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.3);
  pdf.line(LAYOUT.marginLeft, y, LAYOUT.pageWidth - LAYOUT.marginRight, y);
  return y + 2;
}

/** Set text color from RGB tuple. */
export function setColor(pdf: jsPDF, color: readonly [number, number, number]): void {
  pdf.setTextColor(color[0], color[1], color[2]);
}

/** Format IBAN with spaces every 4 characters. */
export function formatIBAN(iban: string): string {
  return iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** Draw a payment status stamp (rotated rectangle with text). */
export function drawPaymentStamp(
  pdf: jsPDF, text: string, x: number, y: number,
  color: readonly [number, number, number]
): void {
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(x, y, 35, 10, 1, 1);
  pdf.setTextColor(color[0], color[1], color[2]);
  pdf.setFontSize(8);
  pdf.text(text, x + 17.5, y + 6.5, { align: 'center' });
}

/** Build column styles for autoTable (alignment + widths). */
export function buildColumnStyles(
  widths: number[], hasDiscount: boolean
): Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> {
  const styles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};
  widths.forEach((w, i) => {
    let halign: 'left' | 'center' | 'right' = 'center';
    if (i === 1) halign = 'left';
    if (i === widths.length - 1) halign = 'right';
    if (i === (hasDiscount ? 4 : 4)) halign = 'right';
    if (i === widths.length - 1) halign = 'right';
    styles[i] = { cellWidth: w, halign };
  });
  return styles;
}
