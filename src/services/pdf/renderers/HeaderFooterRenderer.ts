import type { IPDFDoc, IHeaderFooterRenderer, Margins } from '../contracts';
import { COLORS, LINE_WIDTHS, FONTS, FONT_SIZES } from '../layout';

export class HeaderFooterRenderer implements IHeaderFooterRenderer {
  addHeader(doc: IPDFDoc, margins: Margins, contentWidth: number): void {
    const headerY = 15;
    doc.setDrawColor(...COLORS.RED);
    doc.setLineWidth(LINE_WIDTHS.HEADER);
    doc.line(margins.left, headerY + 3, margins.left + contentWidth, headerY + 3);
  }

  addFooter(doc: IPDFDoc, margins: Margins, contentWidth: number, pageWidth: number, pageNum: number, totalPages: number): void {
    const footerY = doc.pageSize.height - 15;
    
    doc.setDrawColor(...COLORS.RED);
    doc.setLineWidth(LINE_WIDTHS.FOOTER);
    doc.line(margins.left, footerY - 5, margins.left + contentWidth, footerY - 5);
    
    doc.setFont(FONTS.HELVETICA, FONT_STYLES.NORMAL);
    doc.setFontSize(FONT_SIZES.SMALL);
    doc.setTextColor(...COLORS.BLACK);
    
    doc.text(`Σελίδα ${pageNum} από ${totalPages}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text('Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.', margins.left, footerY);
    doc.text('Συγγραφή Υποχρεώσεων', pageWidth - margins.right, footerY, { align: 'right' });
  }
}
