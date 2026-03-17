/**
 * @fileoverview Invoice PDF Template — Section Renderers
 * @description Renders each section of an invoice PDF using jsPDF + autoTable.
 *   Each section function returns the new Y position after drawing.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-018 Invoice PDF Generation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Invoice, InvoiceType, InvoiceLineItem } from '../../types';

// ============================================================================
// CONSTANTS — Brand Colors & Layout
// ============================================================================

/** RGB color tuple type */
type RGB = readonly [number, number, number];

/** Pagonis brand colors (RGB tuples) */
const COLORS: Record<string, RGB> = {
  navy: [30, 58, 95],        // #1E3A5F — headers, titles
  navyDark: [21, 45, 74],     // #152D4A — table headers
  gray: [74, 74, 74],         // #4A4A4A — body text
  grayLight: [130, 130, 130], // #828282 — secondary text
  grayBorder: [220, 220, 220], // #DCDCDC — borders
  white: [255, 255, 255],
  greenPaid: [34, 139, 34],   // paid stamp
  orangePartial: [255, 140, 0], // partial stamp
  redUnpaid: [200, 50, 50],   // unpaid
};

/** Page layout constants (mm) */
const LAYOUT = {
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 20,
  pageWidth: 210,  // A4
  pageHeight: 297, // A4
  contentWidth: 180, // 210 - 15 - 15
};

/** Logo dimensions (mm) */
const LOGO = {
  width: 25,
  height: 25,
};

// ============================================================================
// BILINGUAL LABELS
// ============================================================================

const LABELS = {
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
const INVOICE_TITLES: Record<InvoiceType, { el: string; en: string }> = {
  service_invoice: { el: 'ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ', en: 'SERVICE INVOICE' },
  sales_invoice: { el: 'ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ', en: 'SALES INVOICE' },
  retail_receipt: { el: 'ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ ΠΩΛΗΣΗΣ', en: 'RETAIL RECEIPT' },
  service_receipt: { el: 'ΑΠΟΔΕΙΞΗ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ', en: 'SERVICE RECEIPT' },
  credit_invoice: { el: 'ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ', en: 'CREDIT INVOICE' },
  service_invoice_eu: { el: 'ΤΙΜΟΛΟΓΙΟ Π.Υ. ΕΝΔΟΚΟΙΝΟΤΙΚΟ', en: 'EU SERVICE INVOICE' },
  service_invoice_3rd: { el: 'ΤΙΜΟΛΟΓΙΟ Π.Υ. ΤΡΙΤΕΣ ΧΩΡΕΣ', en: '3RD COUNTRY SERVICE INVOICE' },
};

/** Payment method labels — bilingual */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Μετρητά / Cash',
  bank_transfer: 'Τραπεζική Μεταφορά / Bank Transfer',
  card: 'Κάρτα / Card',
  check: 'Επιταγή / Check',
  credit: 'Πίστωση / Credit',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if content needs a page break; if so, add page and return reset Y.
 */
function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > LAYOUT.pageHeight - LAYOUT.marginBottom) {
    pdf.addPage();
    return LAYOUT.marginTop;
  }
  return y;
}

/**
 * Draw a horizontal rule.
 */
function drawHR(pdf: jsPDF, y: number, color: RGB = COLORS.grayBorder): number {
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.3);
  pdf.line(LAYOUT.marginLeft, y, LAYOUT.pageWidth - LAYOUT.marginRight, y);
  return y + 2;
}

/**
 * Set text color from RGB tuple.
 */
function setColor(pdf: jsPDF, color: readonly [number, number, number]): void {
  pdf.setTextColor(color[0], color[1], color[2]);
}

/**
 * Format IBAN with spaces every 4 characters (standard display format).
 */
function formatIBAN(iban: string): string {
  return iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

// ============================================================================
// SECTION RENDERERS
// ============================================================================

/**
 * §1: Header — Logo (πάνω αριστερά) + Issuer info + Invoice type/number/dates (δεξιά)
 */
export function drawHeader(
  pdf: jsPDF,
  invoice: Invoice,
  logoBase64: string | null,
  startY: number
): number {
  let y = startY;
  const rightCol = LAYOUT.pageWidth - LAYOUT.marginRight;
  const midX = LAYOUT.marginLeft + LAYOUT.contentWidth / 2;

  // ─── Logo ─────────────────────────────────────────────────────────────
  let issuerStartX = LAYOUT.marginLeft;
  if (logoBase64) {
    try {
      pdf.addImage(
        `data:image/png;base64,${logoBase64}`,
        'PNG',
        LAYOUT.marginLeft,
        y,
        LOGO.width,
        LOGO.height
      );
      issuerStartX = LAYOUT.marginLeft + LOGO.width + 4;
    } catch {
      // Logo failed to load — skip, proceed without
    }
  }

  // ─── Issuer info (αριστερά) ───────────────────────────────────────────
  const { issuer } = invoice;

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(11);
  pdf.text(issuer.name, issuerStartX, y + 5);

  pdf.setFontSize(8);
  setColor(pdf, COLORS.gray);
  let infoY = y + 10;
  pdf.text(`${LABELS.vatNumber}: ${issuer.vatNumber}`, issuerStartX, infoY);
  infoY += 4;
  pdf.text(`${LABELS.taxOffice}: ${issuer.taxOffice}`, issuerStartX, infoY);
  infoY += 4;
  pdf.text(`${issuer.address}, ${issuer.city} ${issuer.postalCode}`, issuerStartX, infoY);
  infoY += 4;
  pdf.text(`${LABELS.profession}: ${issuer.profession}`, issuerStartX, infoY);
  infoY += 4;

  // Contact line
  const contactParts: string[] = [];
  if (issuer.phone) contactParts.push(`${LABELS.phone}: ${issuer.phone}`);
  if (issuer.mobile) contactParts.push(`${LABELS.mobile}: ${issuer.mobile}`);
  if (issuer.email) contactParts.push(`${LABELS.email}: ${issuer.email}`);
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  |  '), issuerStartX, infoY);
    infoY += 4;
  }

  // ─── Invoice title + number (δεξιά) ──────────────────────────────────
  const title = INVOICE_TITLES[invoice.type];
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(12);
  pdf.text(title.el, rightCol, y + 5, { align: 'right' });
  pdf.setFontSize(8);
  setColor(pdf, COLORS.grayLight);
  pdf.text(title.en, rightCol, y + 10, { align: 'right' });

  pdf.setFontSize(10);
  setColor(pdf, COLORS.navy);
  pdf.text(`${invoice.series}-${invoice.number}`, rightCol, y + 17, { align: 'right' });

  pdf.setFontSize(8);
  setColor(pdf, COLORS.gray);
  pdf.text(`${LABELS.invoiceDate}: ${formatDate(invoice.issueDate)}`, rightCol, y + 23, { align: 'right' });
  if (invoice.dueDate) {
    pdf.text(`${LABELS.dueDate}: ${formatDate(invoice.dueDate)}`, rightCol, y + 27, { align: 'right' });
  }

  y = Math.max(infoY, y + 30) + 3;
  y = drawHR(pdf, y);
  return y;
}

/**
 * §2: Customer section — ΠΕΛΑΤΗΣ / CUSTOMER box
 */
export function drawCustomerSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  let y = ensureSpace(pdf, startY, 30);

  const { customer } = invoice;

  // Section label
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(9);
  pdf.text(LABELS.customer, LAYOUT.marginLeft, y + 4);

  // Box
  pdf.setDrawColor(COLORS.grayBorder[0], COLORS.grayBorder[1], COLORS.grayBorder[2]);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(LAYOUT.marginLeft, y + 6, LAYOUT.contentWidth, 22, 1, 1);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(8);
  let boxY = y + 11;

  pdf.text(customer.name, LAYOUT.marginLeft + 3, boxY);
  if (customer.vatNumber) {
    pdf.text(`${LABELS.vatNumber}: ${customer.vatNumber}`, LAYOUT.marginLeft + 100, boxY);
  }
  boxY += 4;
  if (customer.address) {
    const addressLine = [customer.address, customer.city, customer.postalCode]
      .filter(Boolean)
      .join(', ');
    pdf.text(addressLine, LAYOUT.marginLeft + 3, boxY);
  }
  if (customer.taxOffice) {
    pdf.text(`${LABELS.taxOffice}: ${customer.taxOffice}`, LAYOUT.marginLeft + 100, boxY);
  }
  boxY += 4;
  if (customer.email) {
    pdf.text(`${LABELS.email}: ${customer.email}`, LAYOUT.marginLeft + 3, boxY);
  }
  if (customer.country && customer.country !== 'GR') {
    pdf.text(`Χώρα / Country: ${customer.country}`, LAYOUT.marginLeft + 100, boxY);
  }

  return y + 32;
}

/**
 * §3: Credit note reference (conditional — μόνο credit_invoice)
 */
export function drawCreditNoteReference(pdf: jsPDF, invoice: Invoice, startY: number): number {
  if (invoice.type !== 'credit_invoice' || !invoice.relatedInvoiceId) {
    return startY;
  }

  let y = ensureSpace(pdf, startY, 10);

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(
    `${LABELS.creditRef}: ${invoice.relatedInvoiceId}`,
    LAYOUT.marginLeft,
    y + 4
  );

  return y + 8;
}

/**
 * §4: Line items table — autoTable with dynamic discount column
 */
export function drawLineItemsTable(pdf: jsPDF, invoice: Invoice, startY: number): number {
  let y = ensureSpace(pdf, startY, 30);

  const hasDiscount = invoice.lineItems.some((li) => {
    const expected = li.quantity * li.unitPrice;
    return Math.abs(li.netAmount - expected) > 0.01;
  });

  // Column headers
  const headers: string[] = [
    LABELS.lineNumber,
    LABELS.description,
    LABELS.unit,
    LABELS.quantity,
    LABELS.unitPrice,
  ];
  if (hasDiscount) headers.push(LABELS.discount);
  headers.push(LABELS.vatRate, LABELS.lineTotal);

  // Column widths (proportional)
  const colWidths = hasDiscount
    ? [8, 62, 14, 14, 22, 18, 16, 26]
    : [8, 72, 16, 16, 24, 18, 26];

  // Body rows
  const body = invoice.lineItems.map((li: InvoiceLineItem) => {
    const expectedNet = li.quantity * li.unitPrice;
    const discountAmount = expectedNet - li.netAmount;
    const discountPct = expectedNet > 0 ? (discountAmount / expectedNet) * 100 : 0;

    const row: string[] = [
      String(li.lineNumber),
      li.description,
      li.unit,
      String(li.quantity),
      formatCurrency(li.unitPrice),
    ];
    if (hasDiscount) {
      row.push(discountAmount > 0.01 ? `${discountPct.toFixed(0)}%` : '-');
    }
    row.push(`${li.vatRate}%`, formatCurrency(li.netAmount));
    return row;
  });

  autoTable(pdf, {
    head: [headers],
    body,
    startY: y,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      font: 'Roboto',
      cellPadding: 1.5,
      textColor: [COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]],
    },
    headStyles: {
      fillColor: [COLORS.navyDark[0], COLORS.navyDark[1], COLORS.navyDark[2]],
      textColor: [255, 255, 255],
      fontSize: 7,
      halign: 'center',
    },
    columnStyles: buildColumnStyles(colWidths, hasDiscount),
    didParseCell: (data) => {
      data.cell.styles.font = 'Roboto';
    },
  });

  // Get final Y from autoTable
  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  return finalY + 3;
}

/**
 * §5: Totals section — Net, VAT per rate, Gross, Withholding, PAYABLE
 */
export function drawTotalsSection(
  pdf: jsPDF,
  invoice: Invoice,
  startY: number,
  withholdingAmount: number
): number {
  let y = ensureSpace(pdf, startY, 40);

  const rightCol = LAYOUT.pageWidth - LAYOUT.marginRight;
  const labelX = rightCol - 80;
  const valueX = rightCol;

  pdf.setFontSize(8);

  // Subtotal
  setColor(pdf, COLORS.gray);
  pdf.text(LABELS.subtotal, labelX, y);
  pdf.text(formatCurrency(invoice.totalNetAmount), valueX, y, { align: 'right' });
  y += 5;

  // VAT breakdown
  for (const vb of invoice.vatBreakdown) {
    pdf.text(`ΦΠΑ / VAT ${vb.vatRate}%`, labelX, y);
    pdf.text(formatCurrency(vb.vatAmount), valueX, y, { align: 'right' });
    y += 5;
  }

  // Gross total
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(9);
  pdf.text(LABELS.grossTotal, labelX, y);
  pdf.text(formatCurrency(invoice.totalGrossAmount), valueX, y, { align: 'right' });
  y += 5;

  // Withholding (if applicable)
  if (withholdingAmount > 0) {
    setColor(pdf, COLORS.gray);
    pdf.setFontSize(8);
    pdf.text(LABELS.withholding, labelX, y);
    pdf.text(`-${formatCurrency(withholdingAmount)}`, valueX, y, { align: 'right' });
    y += 5;
  }

  // Payable
  const payable = invoice.totalGrossAmount - withholdingAmount;
  y = drawHR(pdf, y, COLORS.navy);
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(11);
  pdf.text(LABELS.payable, labelX, y + 3);
  pdf.text(formatCurrency(payable), valueX, y + 3, { align: 'right' });
  y += 8;

  return y + 3;
}

/**
 * §6: Payment section — Τρόπος πληρωμής + Payment status stamp
 */
export function drawPaymentSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  let y = ensureSpace(pdf, startY, 15);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(8);
  const methodLabel = PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod;
  pdf.text(`${LABELS.paymentMethod}: ${methodLabel}`, LAYOUT.marginLeft, y + 4);

  // Payment status stamp (right side)
  const stampX = LAYOUT.pageWidth - LAYOUT.marginRight - 35;
  const stampY = y - 2;

  if (invoice.paymentStatus === 'paid') {
    drawPaymentStamp(pdf, 'ΕΞΟΦΛΗΘΗΚΕ / PAID', stampX, stampY, COLORS.greenPaid);
  } else if (invoice.paymentStatus === 'partial') {
    drawPaymentStamp(pdf, 'ΜΕΡΙΚΗ / PARTIAL', stampX, stampY, COLORS.orangePartial);
  }

  return y + 10;
}

/**
 * §7: Bank accounts section — ΟΛΟΙ οι τραπεζικοί λογαριασμοί
 */
export function drawBankAccountsSection(
  pdf: jsPDF,
  bankAccounts: Array<{ bankName: string; iban: string }>,
  startY: number
): number {
  if (bankAccounts.length === 0) return startY;

  let y = ensureSpace(pdf, startY, 15 + bankAccounts.length * 8);

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(LABELS.bankAccounts, LAYOUT.marginLeft, y + 4);
  y += 7;

  const body = bankAccounts.map((ba) => [ba.bankName, formatIBAN(ba.iban)]);

  autoTable(pdf, {
    head: [[LABELS.bank, LABELS.iban]],
    body,
    startY: y,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      font: 'Roboto',
      cellPadding: 1.5,
      textColor: [COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]],
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]],
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 65 },
    },
    didParseCell: (data) => {
      data.cell.styles.font = 'Roboto';
    },
  });

  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  return finalY + 3;
}

/**
 * §8: myDATA section — MARK + ΚΑΔ (conditional)
 */
export function drawMyDataSection(
  pdf: jsPDF,
  invoice: Invoice,
  kadCode: string | null,
  startY: number
): number {
  const hasMark = invoice.mydata.mark !== null;
  const hasKad = kadCode !== null;
  if (!hasMark && !hasKad) return startY;

  let y = ensureSpace(pdf, startY, 12);

  setColor(pdf, COLORS.grayLight);
  pdf.setFontSize(7);
  pdf.text(`${LABELS.mydata}`, LAYOUT.marginLeft, y + 4);

  setColor(pdf, COLORS.gray);
  let infoX = LAYOUT.marginLeft + 18;
  if (hasMark) {
    pdf.text(`${LABELS.mark}: ${invoice.mydata.mark}`, infoX, y + 4);
    infoX += 60;
  }
  if (hasKad) {
    pdf.text(`${LABELS.kad}: ${kadCode}`, infoX, y + 4);
  }

  return y + 8;
}

/**
 * §9: Notes section (conditional)
 */
export function drawNotesSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  if (!invoice.notes) return startY;

  let y = ensureSpace(pdf, startY, 15);

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(LABELS.notes, LAYOUT.marginLeft, y + 4);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(7.5);
  // Split long notes into lines
  const lines = pdf.splitTextToSize(invoice.notes, LAYOUT.contentWidth - 5);
  pdf.text(lines, LAYOUT.marginLeft + 2, y + 9);

  return y + 9 + lines.length * 3.5;
}

/**
 * §10: Page footers — Website + email + page number (ALL pages)
 */
export function addPageFooters(
  pdf: jsPDF,
  invoice: Invoice
): void {
  const totalPages = pdf.getNumberOfPages();
  const footerY = LAYOUT.pageHeight - 10;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);

    // Website + email (left)
    setColor(pdf, COLORS.grayLight);
    const footerParts: string[] = [];
    if (invoice.issuer.website) footerParts.push(invoice.issuer.website);
    if (invoice.issuer.email) footerParts.push(invoice.issuer.email);
    if (footerParts.length > 0) {
      pdf.text(footerParts.join('  |  '), LAYOUT.marginLeft, footerY);
    }

    // Page number (right)
    pdf.text(
      `${LABELS.page} ${i} / ${totalPages}`,
      LAYOUT.pageWidth - LAYOUT.marginRight,
      footerY,
      { align: 'right' }
    );
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Build column styles for autoTable (alignment + widths).
 */
function buildColumnStyles(
  widths: number[],
  hasDiscount: boolean
): Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> {
  const styles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};

  widths.forEach((w, i) => {
    // First column (#) and middle columns: center, Description: left, amounts: right
    let halign: 'left' | 'center' | 'right' = 'center';
    if (i === 1) halign = 'left'; // description
    if (i === widths.length - 1) halign = 'right'; // total
    if (i === (hasDiscount ? 4 : 4)) halign = 'right'; // unitPrice
    if (i === widths.length - 1) halign = 'right'; // lineTotal

    styles[i] = { cellWidth: w, halign };
  });

  return styles;
}

/**
 * Draw a payment status stamp (rotated rectangle with text).
 */
function drawPaymentStamp(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  color: readonly [number, number, number]
): void {
  // Stamp border
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(x, y, 35, 10, 1, 1);

  // Stamp text
  pdf.setTextColor(color[0], color[1], color[2]);
  pdf.setFontSize(8);
  pdf.text(text, x + 17.5, y + 6.5, { align: 'center' });
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

export interface InvoicePDFRenderOptions {
  /** The invoice to render */
  invoice: Invoice;
  /** Logo as base64 PNG string (null = skip) */
  logoBase64: string | null;
  /** Bank accounts (from invoice snapshot, or fallback from settings) */
  bankAccounts: Array<{ bankName: string; iban: string }>;
  /** KAD code for myDATA section (null = skip) */
  kadCode: string | null;
  /** Withholding tax amount (default: 0) */
  withholdingAmount: number;
}

/**
 * Render a complete invoice PDF document.
 *
 * @returns The jsPDF instance (caller decides: save, blob, or print)
 */
export async function renderInvoicePDF(options: InvoicePDFRenderOptions): Promise<jsPDF> {
  const { invoice, logoBase64, bankAccounts, kadCode, withholdingAmount } = options;

  // Dynamic imports for code-splitting
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  // Create PDF — portrait A4
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Register Roboto font for Greek character support
  const { ROBOTO_REGULAR_BASE64 } = await import('@/services/gantt-export/roboto-font-data');
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold', undefined, 'Identity-H');
  pdf.setFont('Roboto', 'normal');

  // ─── Render sections sequentially ─────────────────────────────────────
  let y = LAYOUT.marginTop;

  y = drawHeader(pdf, invoice, logoBase64, y);
  y = drawCustomerSection(pdf, invoice, y);
  y = drawCreditNoteReference(pdf, invoice, y);
  y = drawLineItemsTable(pdf, invoice, y);
  y = drawTotalsSection(pdf, invoice, y, withholdingAmount);
  y = drawPaymentSection(pdf, invoice, y);
  y = drawBankAccountsSection(pdf, bankAccounts, y);
  y = drawMyDataSection(pdf, invoice, kadCode, y);
  y = drawNotesSection(pdf, invoice, y);

  // Page footers on ALL pages (after all content is rendered)
  addPageFooters(pdf, invoice);

  return pdf;
}
