/**
 * Purchase Order PDF Generator — Bilingual (EL/EN)
 *
 * Generates professional A4 portrait PO documents using jsPDF + autoTable.
 * Company branding, line items, totals, supplier notes, T&C footer.
 *
 * @module services/procurement/po-pdf-generator
 * @enterprise ADR-267 Phase B — PDF Export
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types/procurement';

// ============================================================================
// TYPES
// ============================================================================

export interface POPdfCompanyInfo {
  name: string;
  vatNumber: string;
  address: string;
  phone: string;
  email: string;
  logoBase64?: string;
}

export interface POPdfSupplierInfo {
  name: string;
  vatNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface POPdfConfig {
  po: PurchaseOrder;
  companyInfo: POPdfCompanyInfo;
  supplierInfo: POPdfSupplierInfo;
  language: 'el' | 'en';
  termsAndConditions?: string;
}

// ============================================================================
// LABELS
// ============================================================================

type LabelKey =
  | 'title' | 'poNumber' | 'date' | 'dateNeeded' | 'status'
  | 'from' | 'to' | 'vat' | 'address' | 'phone' | 'email'
  | 'itemNo' | 'description' | 'unit' | 'qty' | 'unitPrice' | 'lineTotal'
  | 'subtotal' | 'vatAmount' | 'total' | 'paymentTerms' | 'days'
  | 'deliveryAddress' | 'notes' | 'terms' | 'page';

const LABELS: Record<'el' | 'en', Record<LabelKey, string>> = {
  el: {
    title: 'ΠΑΡΑΓΓΕΛΙΑ ΑΓΟΡΑΣ',
    poNumber: 'Αρ. Παραγγελίας',
    date: 'Ημερομηνία',
    dateNeeded: 'Ημ. Παράδοσης',
    status: 'Κατάσταση',
    from: 'ΑΠΟΣΤΟΛΕΑΣ',
    to: 'ΠΑΡΑΛΗΠΤΗΣ (Προμηθευτής)',
    vat: 'ΑΦΜ',
    address: 'Διεύθυνση',
    phone: 'Τηλέφωνο',
    email: 'Email',
    itemNo: '#',
    description: 'Περιγραφή',
    unit: 'Μ.Μ.',
    qty: 'Ποσ.',
    unitPrice: 'Τιμή',
    lineTotal: 'Σύνολο',
    subtotal: 'Καθαρό Σύνολο',
    vatAmount: 'ΦΠΑ',
    total: 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ',
    paymentTerms: 'Όροι Πληρωμής',
    days: 'ημέρες',
    deliveryAddress: 'Δ/νση Παράδοσης',
    notes: 'Σημειώσεις',
    terms: 'Όροι & Προϋποθέσεις',
    page: 'Σελίδα',
  },
  en: {
    title: 'PURCHASE ORDER',
    poNumber: 'PO Number',
    date: 'Date',
    dateNeeded: 'Date Needed',
    status: 'Status',
    from: 'FROM',
    to: 'TO (Supplier)',
    vat: 'VAT No',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    itemNo: '#',
    description: 'Description',
    unit: 'Unit',
    qty: 'Qty',
    unitPrice: 'Price',
    lineTotal: 'Total',
    subtotal: 'Subtotal',
    vatAmount: 'VAT',
    total: 'GRAND TOTAL',
    paymentTerms: 'Payment Terms',
    days: 'days',
    deliveryAddress: 'Delivery Address',
    notes: 'Notes',
    terms: 'Terms & Conditions',
    page: 'Page',
  },
};

// ============================================================================
// COLORS & LAYOUT
// ============================================================================

type RGB = [number, number, number];

const COLORS = {
  navy: [30, 58, 95] as RGB,
  black: [0, 0, 0] as RGB,
  gray: [107, 114, 128] as RGB,
  grayLight: [229, 231, 235] as RGB,
  white: [255, 255, 255] as RGB,
  blue50: [239, 246, 255] as RGB,
};

const LAYOUT = {
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 20,
  pageWidth: 210,
  pageHeight: 297,
};

// ============================================================================
// HELPERS
// ============================================================================

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoDate: string | null, lang: 'el' | 'en'): string {
  if (!isoDate) return '—';
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoDate));
}

function contentWidth(): number {
  return LAYOUT.pageWidth - LAYOUT.marginLeft - LAYOUT.marginRight;
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > LAYOUT.pageHeight - LAYOUT.marginBottom) {
    pdf.addPage();
    return LAYOUT.marginTop;
  }
  return y;
}

// ============================================================================
// SECTION: HEADER
// ============================================================================

function drawHeader(
  pdf: jsPDF,
  config: POPdfConfig,
  y: number
): number {
  const { po, companyInfo, language } = config;
  const L = LABELS[language];
  const ml = LAYOUT.marginLeft;
  const cw = contentWidth();

  // Logo
  if (companyInfo.logoBase64) {
    try {
      pdf.addImage(companyInfo.logoBase64, 'PNG', ml, y - 2, 28, 10);
    } catch { /* skip logo if invalid */ }
  }

  // Title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...COLORS.navy);
  pdf.text(L.title, ml + cw, y + 4, { align: 'right' });

  y += 14;

  // PO Number + Date
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.black);
  pdf.text(`${L.poNumber}: ${po.poNumber}`, ml, y);
  pdf.text(`${L.date}: ${formatDate(po.dateCreated, language)}`, ml + cw, y, { align: 'right' });

  y += 5;
  if (po.dateNeeded) {
    pdf.text(`${L.dateNeeded}: ${formatDate(po.dateNeeded, language)}`, ml, y);
    y += 5;
  }

  // Divider
  pdf.setDrawColor(...COLORS.grayLight);
  pdf.setLineWidth(0.4);
  pdf.line(ml, y, ml + cw, y);

  return y + 4;
}

// ============================================================================
// SECTION: PARTIES (Company + Supplier)
// ============================================================================

function drawParties(
  pdf: jsPDF,
  config: POPdfConfig,
  y: number
): number {
  const { companyInfo, supplierInfo, language } = config;
  const L = LABELS[language];
  const ml = LAYOUT.marginLeft;
  const halfW = contentWidth() / 2 - 5;

  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.navy);
  pdf.text(L.from, ml, y);
  pdf.text(L.to, ml + halfW + 10, y);

  y += 5;
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.black);

  // Company (left column)
  const companyLines = [
    companyInfo.name,
    `${L.vat}: ${companyInfo.vatNumber}`,
    `${L.address}: ${companyInfo.address}`,
    `${L.phone}: ${companyInfo.phone}`,
    `${L.email}: ${companyInfo.email}`,
  ];

  // Supplier (right column)
  const supplierLines = [
    supplierInfo.name,
    ...(supplierInfo.vatNumber ? [`${L.vat}: ${supplierInfo.vatNumber}`] : []),
    ...(supplierInfo.address ? [`${L.address}: ${supplierInfo.address}`] : []),
    ...(supplierInfo.phone ? [`${L.phone}: ${supplierInfo.phone}`] : []),
    ...(supplierInfo.email ? [`${L.email}: ${supplierInfo.email}`] : []),
  ];

  const maxLines = Math.max(companyLines.length, supplierLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (companyLines[i]) pdf.text(companyLines[i], ml, y);
    if (supplierLines[i]) pdf.text(supplierLines[i], ml + halfW + 10, y);
    y += 4;
  }

  return y + 2;
}

// ============================================================================
// SECTION: LINE ITEMS TABLE
// ============================================================================

function drawLineItems(
  pdf: jsPDF,
  config: POPdfConfig,
  y: number
): number {
  const { po, language } = config;
  const L = LABELS[language];

  const tableData = po.items.map((item: PurchaseOrderItem, idx: number) => [
    String(idx + 1),
    item.description,
    item.unit,
    String(item.quantity),
    formatEuro(item.unitPrice),
    formatEuro(item.total),
  ]);

  autoTable(pdf, {
    startY: y,
    margin: { left: LAYOUT.marginLeft, right: LAYOUT.marginRight },
    head: [[L.itemNo, L.description, L.unit, L.qty, L.unitPrice, L.lineTotal]],
    body: tableData,
    styles: {
      font: 'Roboto',
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: COLORS.navy,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: COLORS.blue50,
    },
  });

  return (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
}

// ============================================================================
// SECTION: TOTALS
// ============================================================================

function drawTotals(
  pdf: jsPDF,
  config: POPdfConfig,
  y: number
): number {
  const { po, language } = config;
  const L = LABELS[language];
  const rightX = LAYOUT.pageWidth - LAYOUT.marginRight;

  y = ensureSpace(pdf, y, 30);
  y += 4;

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.black);

  // Subtotal
  pdf.text(L.subtotal, rightX - 55, y);
  pdf.text(formatEuro(po.subtotal), rightX, y, { align: 'right' });
  y += 5;

  // VAT
  pdf.text(`${L.vatAmount} (${po.taxRate}%)`, rightX - 55, y);
  pdf.text(formatEuro(po.taxAmount), rightX, y, { align: 'right' });
  y += 5;

  // Divider
  pdf.setDrawColor(...COLORS.grayLight);
  pdf.line(rightX - 60, y, rightX, y);
  y += 4;

  // Total
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.navy);
  pdf.text(L.total, rightX - 55, y);
  pdf.text(formatEuro(po.total), rightX, y, { align: 'right' });

  return y + 8;
}

// ============================================================================
// SECTION: FOOTER (Notes, Payment, Delivery, T&C)
// ============================================================================

function drawFooter(
  pdf: jsPDF,
  config: POPdfConfig,
  y: number
): number {
  const { po, language, termsAndConditions } = config;
  const L = LABELS[language];
  const ml = LAYOUT.marginLeft;
  const cw = contentWidth();

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.gray);

  // Payment terms
  if (po.paymentTermsDays != null) {
    y = ensureSpace(pdf, y, 10);
    pdf.text(`${L.paymentTerms}: ${po.paymentTermsDays} ${L.days}`, ml, y);
    y += 5;
  }

  // Delivery address
  if (po.deliveryAddress) {
    y = ensureSpace(pdf, y, 10);
    pdf.text(`${L.deliveryAddress}: ${po.deliveryAddress}`, ml, y);
    y += 5;
  }

  // Supplier notes (visible on PDF)
  if (po.supplierNotes) {
    y = ensureSpace(pdf, y, 15);
    y += 3;
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.navy);
    pdf.text(L.notes, ml, y);
    y += 4;
    pdf.setFont('Roboto', 'normal');
    pdf.setTextColor(...COLORS.black);
    const noteLines = pdf.splitTextToSize(po.supplierNotes, cw);
    pdf.text(noteLines, ml, y);
    y += noteLines.length * 3.5;
  }

  // Terms & Conditions
  if (termsAndConditions) {
    y = ensureSpace(pdf, y, 20);
    y += 5;
    pdf.setDrawColor(...COLORS.grayLight);
    pdf.line(ml, y, ml + cw, y);
    y += 4;
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.gray);
    pdf.text(L.terms, ml, y);
    y += 3.5;
    pdf.setFont('Roboto', 'normal');
    const tcLines = pdf.splitTextToSize(termsAndConditions, cw);
    pdf.text(tcLines, ml, y);
    y += tcLines.length * 3;
  }

  return y;
}

// ============================================================================
// SECTION: PAGE NUMBERS
// ============================================================================

function addPageNumbers(pdf: jsPDF, language: 'el' | 'en'): void {
  const L = LABELS[language];
  const totalPages = pdf.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.gray);
    pdf.text(
      `${L.page} ${i} / ${totalPages}`,
      LAYOUT.pageWidth - LAYOUT.marginRight,
      LAYOUT.pageHeight - 8,
      { align: 'right' }
    );
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generatePurchaseOrderPdf(
  config: POPdfConfig
): Promise<Uint8Array> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  let y = LAYOUT.marginTop;

  y = drawHeader(pdf, config, y);
  y = drawParties(pdf, config, y);
  y = drawLineItems(pdf, config, y);
  y = drawTotals(pdf, config, y);
  y = drawFooter(pdf, config, y);

  addPageNumbers(pdf, config.language);

  return pdf.output('arraybuffer') as unknown as Uint8Array;
}
