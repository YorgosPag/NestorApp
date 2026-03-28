/**
 * @fileoverview APY Certificate PDF Template — Section Renderers
 * @description Renders each section of a Βεβαίωση Παρακράτησης Φόρου PDF using jsPDF + autoTable.
 *   Reuses COLORS, LAYOUT, LOGO constants and helper patterns from invoice-pdf-template.ts.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '../../utils/format';
import type { APYCertificate, APYCertificateLineItem } from '../../types';

// ============================================================================
// CONSTANTS — Reuse from invoice-pdf-template pattern
// ============================================================================

/** RGB color tuple type */
type RGB = readonly [number, number, number];

/** Pagonis brand colors (RGB tuples) — ίδιο με invoice-pdf-template */
const COLORS: Record<string, RGB> = {
  navy: [30, 58, 95],           // #1E3A5F — headers, titles
  navyDark: [21, 45, 74],       // #152D4A — table headers
  gray: [74, 74, 74],           // #4A4A4A — body text
  grayLight: [130, 130, 130],   // #828282 — secondary text
  grayBorder: [220, 220, 220],  // #DCDCDC — borders
  white: [255, 255, 255],
  green: [34, 139, 34],         // received stamp
  orange: [255, 140, 0],        // pending stamp
};

/** Page layout constants (mm) — ίδιο με invoice-pdf-template */
const LAYOUT = {
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 20,
  pageWidth: 210,   // A4
  pageHeight: 297,  // A4
  contentWidth: 180, // 210 - 15 - 15
};

/** Logo dimensions (mm) — ίδιο με invoice-pdf-template */
const LOGO = { width: 25, height: 25 };

// ============================================================================
// BILINGUAL LABELS
// ============================================================================

const LABELS = {
  documentTitle: 'ΒΕΒΑΙΩΣΗ ΠΑΡΑΚΡΑΤΗΣΗΣ ΦΟΡΟΥ',
  documentTitleEn: 'WITHHOLDING TAX CERTIFICATE',
  provider: 'ΠΑΡΟΧΟΣ ΥΠΗΡΕΣΙΩΝ / SERVICE PROVIDER',
  customer: 'ΥΠΟΧΡΕΟΣ ΠΑΡΑΚΡΑΤΗΣΗΣ / WITHHOLDER',
  vatNumber: 'ΑΦΜ / VAT No',
  taxOffice: 'ΔΟΥ / Tax Office',
  profession: 'Δραστηριότητα / Activity',
  address: 'Διεύθυνση / Address',
  fiscalYear: 'Φορολογικό Έτος / Fiscal Year',
  invoiceNumber: 'Αρ. Τιμολογίου / Invoice No',
  issueDate: 'Ημ/νία Έκδοσης / Issue Date',
  netAmount: 'Καθαρό Ποσό / Net Amount',
  withholdingRate: 'Συντ. % / Rate %',
  withholdingAmount: 'Παρακράτηση / Withholding',
  lineNumber: '#',
  totalNetAmount: 'Σύνολο Καθαρών Ποσών / Total Net Amount',
  totalWithholding: 'ΣΥΝΟΛΟ ΠΑΡΑΚΡΑΤΗΣΗΣ / TOTAL WITHHOLDING',
  legalBasis: 'Νομική Βάση / Legal Basis',
  legalBasisText: 'Ν. 4172/2013 άρθρο 64 | Art. 64 Law 4172/2013',
  stampReceived: 'ΕΛΛΗΦΘΗ / RECEIVED',
  stampPending: 'ΕΚΚΡΕΜΕΙ / PENDING',
  page: 'Σελίδα / Page',
} as const;

// ============================================================================
// HELPERS
// ============================================================================

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > LAYOUT.pageHeight - LAYOUT.marginBottom) {
    pdf.addPage();
    return LAYOUT.marginTop;
  }
  return y;
}

function drawHR(pdf: jsPDF, y: number, color: RGB = COLORS.grayBorder): number {
  pdf.setDrawColor(color[0], color[1], color[2]);
  pdf.setLineWidth(0.3);
  pdf.line(LAYOUT.marginLeft, y, LAYOUT.pageWidth - LAYOUT.marginRight, y);
  return y + 2;
}

function setColor(pdf: jsPDF, color: RGB): void {
  pdf.setTextColor(color[0], color[1], color[2]);
}

// ============================================================================
// SECTION RENDERERS
// ============================================================================

/**
 * §1: APY Header — Logo (αριστερά) + Provider info + Document title/year (δεξιά)
 * Ξεχωριστή υλοποίηση από drawHeader() — το document type είναι "Βεβαίωση", όχι "Τιμολόγιο"
 */
function drawAPYHeader(
  pdf: jsPDF,
  cert: APYCertificate,
  logoBase64: string | null,
  startY: number
): number {
  let y = startY;
  const rightCol = LAYOUT.pageWidth - LAYOUT.marginRight;

  // ─── Logo ─────────────────────────────────────────────────────────────
  let providerStartX = LAYOUT.marginLeft;
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
      providerStartX = LAYOUT.marginLeft + LOGO.width + 4;
    } catch {
      // Logo failed — proceed without
    }
  }

  // ─── Provider info (αριστερά) ─────────────────────────────────────────
  const { provider } = cert;
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(11);
  pdf.text(provider.name, providerStartX, y + 5);

  pdf.setFontSize(8);
  setColor(pdf, COLORS.gray);
  let infoY = y + 10;
  pdf.text(`${LABELS.vatNumber}: ${provider.vatNumber}`, providerStartX, infoY);
  infoY += 4;
  pdf.text(`${LABELS.taxOffice}: ${provider.taxOffice}`, providerStartX, infoY);
  infoY += 4;
  pdf.text(`${provider.address}, ${provider.city} ${provider.postalCode}`, providerStartX, infoY);
  infoY += 4;
  pdf.text(`${LABELS.profession}: ${provider.profession}`, providerStartX, infoY);
  infoY += 4;

  const contactParts: string[] = [];
  if (provider.phone) contactParts.push(`Τηλ: ${provider.phone}`);
  if (provider.email) contactParts.push(`Email: ${provider.email}`);
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  |  '), providerStartX, infoY);
    infoY += 4;
  }

  // ─── Document title + fiscal year (δεξιά) ────────────────────────────
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(12);
  pdf.text(LABELS.documentTitle, rightCol, y + 5, { align: 'right' });

  pdf.setFontSize(8);
  setColor(pdf, COLORS.grayLight);
  pdf.text(LABELS.documentTitleEn, rightCol, y + 10, { align: 'right' });

  pdf.setFontSize(14);
  setColor(pdf, COLORS.navy);
  pdf.text(String(cert.fiscalYear), rightCol, y + 20, { align: 'right' });

  pdf.setFontSize(8);
  setColor(pdf, COLORS.grayLight);
  pdf.text(LABELS.fiscalYear, rightCol, y + 25, { align: 'right' });

  y = Math.max(infoY, y + 30) + 3;
  y = drawHR(pdf, y);
  return y;
}

/**
 * §2: Customer / Withholder section box
 */
function drawAPYCustomerSection(pdf: jsPDF, cert: APYCertificate, startY: number): number {
  let y = ensureSpace(pdf, startY, 30);
  const { customer } = cert;

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(9);
  pdf.text(LABELS.customer, LAYOUT.marginLeft, y + 4);

  pdf.setDrawColor(COLORS.grayBorder[0], COLORS.grayBorder[1], COLORS.grayBorder[2]);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(LAYOUT.marginLeft, y + 6, LAYOUT.contentWidth, 22, 1, 1);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(8);
  let boxY = y + 11;

  pdf.text(customer.name, LAYOUT.marginLeft + 3, boxY);
  pdf.text(`${LABELS.vatNumber}: ${customer.vatNumber}`, LAYOUT.marginLeft + 100, boxY);
  boxY += 4;

  if (customer.address) {
    const addressLine = [customer.address, customer.city]
      .filter(Boolean)
      .join(', ');
    pdf.text(addressLine, LAYOUT.marginLeft + 3, boxY);
  }
  if (customer.taxOffice) {
    pdf.text(`${LABELS.taxOffice}: ${customer.taxOffice}`, LAYOUT.marginLeft + 100, boxY);
  }

  return y + 32;
}

/**
 * §3: Invoice table — Α/Α | Αρ. ΤΠΥ | Ημερομηνία | Καθαρό Ποσό | Συντ.% | Παρακράτηση
 */
function drawAPYInvoiceTable(
  pdf: jsPDF,
  lineItems: APYCertificateLineItem[],
  startY: number
): number {
  const y = ensureSpace(pdf, startY, 40);

  const head = [[
    LABELS.lineNumber,
    LABELS.invoiceNumber,
    LABELS.issueDate,
    LABELS.netAmount,
    LABELS.withholdingRate,
    LABELS.withholdingAmount,
  ]];

  const body = lineItems.map((item, idx) => [
    String(idx + 1),
    item.invoiceNumber,
    formatDate(item.issueDate),
    formatCurrency(item.netAmount),
    `${item.withholdingRate}%`,
    formatCurrency(item.withholdingAmount),
  ]);

  autoTable(pdf, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [COLORS.navyDark[0], COLORS.navyDark[1], COLORS.navyDark[2]],
      textColor: [COLORS.white[0], COLORS.white[1], COLORS.white[2]],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, halign: 'left' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 38, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: LAYOUT.marginLeft, right: LAYOUT.marginRight },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
}

/**
 * §4: Totals section — Σύνολο Καθαρών + ΣΥΝΟΛΟ ΠΑΡΑΚΡΑΤΗΣΗΣ (prominent)
 */
function drawAPYTotalsSection(pdf: jsPDF, cert: APYCertificate, startY: number): number {
  let y = ensureSpace(pdf, startY, 30);
  const rightCol = LAYOUT.pageWidth - LAYOUT.marginRight;
  const labelX = rightCol - 80;

  // ─── Σύνολο καθαρών ─────────────────────────────────────────────────
  setColor(pdf, COLORS.gray);
  pdf.setFontSize(9);
  pdf.text(LABELS.totalNetAmount, labelX, y + 4);
  setColor(pdf, COLORS.navy);
  pdf.text(formatCurrency(cert.totalNetAmount), rightCol, y + 4, { align: 'right' });

  y += 8;
  y = drawHR(pdf, y, COLORS.navy);

  // ─── ΣΥΝΟΛΟ ΠΑΡΑΚΡΑΤΗΣΗΣ (prominent) ────────────────────────────────
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(11);
  pdf.text(LABELS.totalWithholding, labelX, y + 6);
  pdf.setFontSize(13);
  pdf.text(formatCurrency(cert.totalWithholdingAmount), rightCol, y + 6, { align: 'right' });

  y += 12;
  y = drawHR(pdf, y, COLORS.navy);

  // ─── Νομική βάση ─────────────────────────────────────────────────────
  setColor(pdf, COLORS.grayLight);
  pdf.setFontSize(7);
  pdf.text(`${LABELS.legalBasis}: ${LABELS.legalBasisText}`, LAYOUT.marginLeft, y + 4);

  return y + 10;
}

/**
 * §5: Received stamp — ορατό μόνο αν cert.isReceived === true
 */
function drawAPYStatusStamp(pdf: jsPDF, cert: APYCertificate, startY: number): number {
  const y = ensureSpace(pdf, startY, 20);

  const stampColor = cert.isReceived ? COLORS.green : COLORS.orange;
  const stampText = cert.isReceived ? LABELS.stampReceived : LABELS.stampPending;

  pdf.setDrawColor(stampColor[0], stampColor[1], stampColor[2]);
  pdf.setLineWidth(1.0);
  pdf.roundedRect(LAYOUT.marginLeft, y, 55, 12, 2, 2);

  pdf.setTextColor(stampColor[0], stampColor[1], stampColor[2]);
  pdf.setFontSize(9);
  pdf.text(stampText, LAYOUT.marginLeft + 27.5, y + 7.5, { align: 'center' });

  return y + 18;
}

/**
 * §6: Page footers — provider contact + page numbers
 */
function addAPYPageFooters(pdf: jsPDF, cert: APYCertificate): void {
  const totalPages = pdf.getNumberOfPages();
  const footerY = LAYOUT.pageHeight - LAYOUT.marginBottom + 5;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);

    setColor(pdf, COLORS.grayLight);
    const footerParts: string[] = [];
    if (cert.provider.email) footerParts.push(cert.provider.email);
    if (cert.provider.phone) footerParts.push(cert.provider.phone);
    if (footerParts.length > 0) {
      pdf.text(footerParts.join('  |  '), LAYOUT.marginLeft, footerY);
    }

    pdf.text(
      `${LABELS.page} ${i} / ${totalPages}`,
      LAYOUT.pageWidth - LAYOUT.marginRight,
      footerY,
      { align: 'right' }
    );
  }
}

// ============================================================================
// RENDER OPTIONS
// ============================================================================

export interface APYCertificatePDFRenderOptions {
  /** The APY certificate to render */
  cert: APYCertificate;
  /** Logo as base64 PNG string (null = skip) */
  logoBase64: string | null;
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render a complete Βεβαίωση Παρακράτησης Φόρου PDF document.
 *
 * @returns The jsPDF instance (caller decides: save, blob, or print)
 */
export async function renderAPYCertificatePDF(
  options: APYCertificatePDFRenderOptions
): Promise<jsPDF> {
  const { cert, logoBase64 } = options;

  // Dynamic imports for code-splitting (ίδιο pattern με invoice-pdf-template)
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Greek font registration — SSOT: src/services/pdf/greek-font-loader.ts
  const { registerGreekFont } = await import('@/services/pdf/greek-font-loader');
  await registerGreekFont(pdf);

  // ─── Render sections sequentially ─────────────────────────────────────
  let y = LAYOUT.marginTop;

  y = drawAPYHeader(pdf, cert, logoBase64, y);
  y = drawAPYCustomerSection(pdf, cert, y);
  y = drawAPYInvoiceTable(pdf, cert.lineItems, y);
  y = drawAPYTotalsSection(pdf, cert, y);
  y = drawAPYStatusStamp(pdf, cert, y);

  // Page footers on ALL pages
  addAPYPageFooters(pdf, cert);

  return pdf;
}
