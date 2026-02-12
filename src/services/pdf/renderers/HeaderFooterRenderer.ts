import type { ObligationDocument } from '@/types/obligations';
import type { PDFExportOptions, IPDFDoc, IHeaderFooterRenderer, Margins } from '../contracts';
import { COLORS, LINE_WIDTHS, FONTS, FONT_SIZES, FONT_STYLES } from '../layout';

const PDF_LABELS = {
  defaultHeader: 'ΣΥΓΓΡΑΦΗ ΥΠΟΧΡΕΩΣΕΩΝ',
  defaultFooter: 'Συγγραφή Υποχρεώσεων',
  pagePrefix: 'Σελίδα',
  pageConnector: 'από',
  revisionPrefix: 'Rev',
} as const;

const safeText = (value?: string | number): string => {
  if (value === undefined || value === null) {
    return '';
  }
  const normalized = String(value).trim();
  return normalized;
};

export class HeaderFooterRenderer implements IHeaderFooterRenderer {
  addHeader(
    doc: IPDFDoc,
    margins: Margins,
    contentWidth: number,
    pageWidth: number,
    document: ObligationDocument,
    options?: PDFExportOptions
  ): void {
    const headerY = 15;

    doc.setDrawColor(...COLORS.RED);
    doc.setLineWidth(LINE_WIDTHS.HEADER);
    doc.line(margins.left, headerY + 3, margins.left + contentWidth, headerY + 3);

    doc.setFont(FONTS.HELVETICA, FONT_STYLES.BOLD);
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.BLACK);

    const headerText = safeText(options?.headerText) || PDF_LABELS.defaultHeader;
    const projectName = safeText(document.projectName);
    const docNumber = safeText(document.docNumber) || safeText(document.id);
    const revision = document.revision !== undefined ? `${PDF_LABELS.revisionPrefix} ${document.revision}` : '';

    doc.text(headerText, margins.left, headerY, { align: 'left' });
    if (projectName) {
      doc.text(projectName, pageWidth / 2, headerY, { align: 'center' });
    }

    const rightTokens = [docNumber, revision].filter((token) => token.length > 0);
    if (rightTokens.length > 0) {
      doc.text(rightTokens.join(' | '), pageWidth - margins.right, headerY, { align: 'right' });
    }
  }

  addFooter(
    doc: IPDFDoc,
    margins: Margins,
    contentWidth: number,
    pageWidth: number,
    pageNum: number,
    totalPages: number,
    document: ObligationDocument,
    options?: PDFExportOptions
  ): void {
    const footerY = doc.pageSize.height - 15;

    doc.setDrawColor(...COLORS.RED);
    doc.setLineWidth(LINE_WIDTHS.FOOTER);
    doc.line(margins.left, footerY - 5, margins.left + contentWidth, footerY - 5);

    doc.setFont(FONTS.HELVETICA, FONT_STYLES.NORMAL);
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.BLACK);

    const pageInfo = `${PDF_LABELS.pagePrefix} ${pageNum} ${PDF_LABELS.pageConnector} ${totalPages}`;
    doc.text(pageInfo, pageWidth / 2, footerY, { align: 'center' });

    const companyName = safeText(document.companyDetails?.name) || safeText(document.contractorCompany) || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Nestor';
    doc.text(companyName, margins.left, footerY, { align: 'left' });

    const footerText = safeText(options?.footerText) || PDF_LABELS.defaultFooter;
    const statusText = safeText(document.status);
    const rightText = [footerText, statusText].filter((token) => token.length > 0).join(' | ');
    doc.text(rightText, pageWidth - margins.right, footerY, { align: 'right' });
  }
}
