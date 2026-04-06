/**
 * @fileoverview Invoice PDF Section Renderers (§1-§10)
 * @description Each function draws one section and returns the new Y position.
 * @see ADR-ACC-018 Invoice PDF Generation
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Invoice, InvoiceLineItem } from '../../types';
import {
  COLORS, LAYOUT, LOGO, LABELS, INVOICE_TITLES, PAYMENT_METHOD_LABELS,
  ensureSpace, drawHR, setColor, formatIBAN,
  drawPaymentStamp, buildColumnStyles
} from './invoice-pdf-constants';

/**
 * §1: Header — Logo + Issuer info + Invoice type/number/dates
 */
export function drawHeader(
  pdf: jsPDF, invoice: Invoice, logoBase64: string | null, startY: number
): number {
  let y = startY;
  const rightCol = LAYOUT.pageWidth - LAYOUT.marginRight;

  // Logo
  let issuerStartX = LAYOUT.marginLeft;
  if (logoBase64) {
    try {
      pdf.addImage(
        `data:image/png;base64,${logoBase64}`, 'PNG',
        LAYOUT.marginLeft, y, LOGO.width, LOGO.height
      );
      issuerStartX = LAYOUT.marginLeft + LOGO.width + 4;
    } catch { /* Logo failed — skip */ }
  }

  // Issuer info (left)
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

  const contactParts: string[] = [];
  if (issuer.phone) contactParts.push(`${LABELS.phone}: ${issuer.phone}`);
  if (issuer.mobile) contactParts.push(`${LABELS.mobile}: ${issuer.mobile}`);
  if (issuer.email) contactParts.push(`${LABELS.email}: ${issuer.email}`);
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  |  '), issuerStartX, infoY);
    infoY += 4;
  }

  // Invoice title + number (right)
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
 * §2: Customer section
 */
export function drawCustomerSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  let y = ensureSpace(pdf, startY, 30);
  const { customer } = invoice;

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
  if (customer.vatNumber) {
    pdf.text(`${LABELS.vatNumber}: ${customer.vatNumber}`, LAYOUT.marginLeft + 100, boxY);
  }
  boxY += 4;
  if (customer.address) {
    const addressLine = [customer.address, customer.city, customer.postalCode].filter(Boolean).join(', ');
    pdf.text(addressLine, LAYOUT.marginLeft + 3, boxY);
  }
  if (customer.taxOffice) {
    pdf.text(`${LABELS.taxOffice}: ${customer.taxOffice}`, LAYOUT.marginLeft + 100, boxY);
  }
  boxY += 4;
  if (customer.email) pdf.text(`${LABELS.email}: ${customer.email}`, LAYOUT.marginLeft + 3, boxY);
  if (customer.country && customer.country !== 'GR') {
    pdf.text(`Χώρα / Country: ${customer.country}`, LAYOUT.marginLeft + 100, boxY);
  }

  return y + 32;
}

/**
 * §3: Credit note reference (conditional)
 */
export function drawCreditNoteReference(pdf: jsPDF, invoice: Invoice, startY: number): number {
  if (invoice.type !== 'credit_invoice' || !invoice.relatedInvoiceId) return startY;

  const y = ensureSpace(pdf, startY, 10);
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(`${LABELS.creditRef}: ${invoice.relatedInvoiceId}`, LAYOUT.marginLeft, y + 4);
  return y + 8;
}

/**
 * §4: Line items table
 */
export function drawLineItemsTable(pdf: jsPDF, invoice: Invoice, startY: number): number {
  const y = ensureSpace(pdf, startY, 30);

  const hasDiscount = invoice.lineItems.some((li) => {
    const expected = li.quantity * li.unitPrice;
    return Math.abs(li.netAmount - expected) > 0.01;
  });

  const headers: string[] = [LABELS.lineNumber, LABELS.description, LABELS.unit, LABELS.quantity, LABELS.unitPrice];
  if (hasDiscount) headers.push(LABELS.discount);
  headers.push(LABELS.vatRate, LABELS.lineTotal);

  const colWidths = hasDiscount
    ? [8, 62, 14, 14, 22, 18, 16, 26]
    : [8, 72, 16, 16, 24, 18, 26];

  const body = invoice.lineItems.map((li: InvoiceLineItem) => {
    const expectedNet = li.quantity * li.unitPrice;
    const discountAmount = expectedNet - li.netAmount;
    const discountPct = expectedNet > 0 ? (discountAmount / expectedNet) * 100 : 0;

    const row: string[] = [String(li.lineNumber), li.description, li.unit, String(li.quantity), formatCurrency(li.unitPrice)];
    if (hasDiscount) row.push(discountAmount > 0.01 ? `${discountPct.toFixed(0)}%` : '-');
    row.push(`${li.vatRate}%`, formatCurrency(li.netAmount));
    return row;
  });

  autoTable(pdf, {
    head: [headers], body, startY: y, theme: 'grid',
    styles: { fontSize: 7.5, font: 'Roboto', cellPadding: 1.5, textColor: [COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]] },
    headStyles: { fillColor: [COLORS.navyDark[0], COLORS.navyDark[1], COLORS.navyDark[2]], textColor: [255, 255, 255], fontSize: 7, halign: 'center' },
    columnStyles: buildColumnStyles(colWidths, hasDiscount),
    didParseCell: (data) => { data.cell.styles.font = 'Roboto'; },
  });

  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  return finalY + 3;
}

/**
 * §5: Totals section
 */
export function drawTotalsSection(pdf: jsPDF, invoice: Invoice, startY: number, withholdingAmount: number): number {
  let y = ensureSpace(pdf, startY, 40);
  const rightCol = LAYOUT.pageWidth - LAYOUT.marginRight;
  const labelX = rightCol - 80;
  const valueX = rightCol;

  pdf.setFontSize(8);
  setColor(pdf, COLORS.gray);
  pdf.text(LABELS.subtotal, labelX, y);
  pdf.text(formatCurrency(invoice.totalNetAmount), valueX, y, { align: 'right' });
  y += 5;

  for (const vb of invoice.vatBreakdown) {
    pdf.text(`ΦΠΑ / VAT ${vb.vatRate}%`, labelX, y);
    pdf.text(formatCurrency(vb.vatAmount), valueX, y, { align: 'right' });
    y += 5;
  }

  setColor(pdf, COLORS.navy);
  pdf.setFontSize(9);
  pdf.text(LABELS.grossTotal, labelX, y);
  pdf.text(formatCurrency(invoice.totalGrossAmount), valueX, y, { align: 'right' });
  y += 5;

  if (withholdingAmount > 0) {
    setColor(pdf, COLORS.gray);
    pdf.setFontSize(8);
    pdf.text(LABELS.withholding, labelX, y);
    pdf.text(`-${formatCurrency(withholdingAmount)}`, valueX, y, { align: 'right' });
    y += 5;
  }

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
 * §6: Payment section
 */
export function drawPaymentSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  const y = ensureSpace(pdf, startY, 15);
  setColor(pdf, COLORS.gray);
  pdf.setFontSize(8);
  const methodLabel = PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod;
  pdf.text(`${LABELS.paymentMethod}: ${methodLabel}`, LAYOUT.marginLeft, y + 4);

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
 * §7: Bank accounts section
 */
export function drawBankAccountsSection(
  pdf: jsPDF, bankAccounts: Array<{ bankName: string; iban: string }>, startY: number
): number {
  if (bankAccounts.length === 0) return startY;

  const y = ensureSpace(pdf, startY, 15 + bankAccounts.length * 8);
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(LABELS.bankAccounts, LAYOUT.marginLeft, y + 4);

  const body = bankAccounts.map((ba) => [ba.bankName, formatIBAN(ba.iban)]);

  autoTable(pdf, {
    head: [[LABELS.bank, LABELS.iban]], body, startY: y + 7, theme: 'plain',
    styles: { fontSize: 7.5, font: 'Roboto', cellPadding: 1.5, textColor: [COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]] },
    headStyles: { fillColor: [240, 240, 240], textColor: [COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]], fontSize: 7 },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 65 } },
    didParseCell: (data) => { data.cell.styles.font = 'Roboto'; },
  });

  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  return finalY + 3;
}

/**
 * §8: myDATA section (conditional)
 */
export function drawMyDataSection(pdf: jsPDF, invoice: Invoice, kadCode: string | null, startY: number): number {
  const hasMark = invoice.mydata.mark !== null;
  const hasKad = kadCode !== null;
  if (!hasMark && !hasKad) return startY;

  const y = ensureSpace(pdf, startY, 12);
  setColor(pdf, COLORS.grayLight);
  pdf.setFontSize(7);
  pdf.text(`${LABELS.mydata}`, LAYOUT.marginLeft, y + 4);

  setColor(pdf, COLORS.gray);
  let infoX = LAYOUT.marginLeft + 18;
  if (hasMark) { pdf.text(`${LABELS.mark}: ${invoice.mydata.mark}`, infoX, y + 4); infoX += 60; }
  if (hasKad) { pdf.text(`${LABELS.kad}: ${kadCode}`, infoX, y + 4); }

  return y + 8;
}

/**
 * §9: Notes section (conditional)
 */
export function drawNotesSection(pdf: jsPDF, invoice: Invoice, startY: number): number {
  if (!invoice.notes) return startY;

  const y = ensureSpace(pdf, startY, 15);
  setColor(pdf, COLORS.navy);
  pdf.setFontSize(8);
  pdf.text(LABELS.notes, LAYOUT.marginLeft, y + 4);

  setColor(pdf, COLORS.gray);
  pdf.setFontSize(7.5);
  const lines = pdf.splitTextToSize(invoice.notes, LAYOUT.contentWidth - 5);
  pdf.text(lines, LAYOUT.marginLeft + 2, y + 9);

  return y + 9 + lines.length * 3.5;
}

/**
 * §10: Page footers on ALL pages
 */
export function addPageFooters(pdf: jsPDF, invoice: Invoice): void {
  const totalPages = pdf.getNumberOfPages();
  const footerY = LAYOUT.pageHeight - 10;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);

    setColor(pdf, COLORS.grayLight);
    const footerParts: string[] = [];
    if (invoice.issuer.website) footerParts.push(invoice.issuer.website);
    if (invoice.issuer.email) footerParts.push(invoice.issuer.email);
    if (footerParts.length > 0) {
      pdf.text(footerParts.join('  |  '), LAYOUT.marginLeft, footerY);
    }

    pdf.text(
      `${LABELS.page} ${i} / ${totalPages}`,
      LAYOUT.pageWidth - LAYOUT.marginRight, footerY, { align: 'right' }
    );
  }
}
