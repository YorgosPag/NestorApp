import type { ObligationDocument } from '@/types/obligations';
import type { IPDFDoc, ICoverRenderer, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONT_SIZES } from '../layout';

export class CoverRenderer implements ICoverRenderer {
  private textRenderer: TextRenderer = new TextRenderer();

  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, pageHeight: number, document: ObligationDocument, formatDate: (d: Date) => string): number {
    let currentY = yStart;
    
    doc.setFillColor(...COLORS.RED);
    doc.rect(margins.left, currentY - 5, contentWidth, 15, 'F');
    
    currentY = this.textRenderer.addText({ doc, text: document.contractorCompany, y: currentY, align: 'center', fontSize: FONT_SIZES.H3, bold: true, color: COLORS.WHITE, margins, pageWidth });
    currentY += 5; // Adjust for banner
    this.textRenderer.addText({ doc, text: 'ΤΕΧΝΙΚΗ ΕΤΑΙΡΕΙΑ ΚΑΤΑΣΚΕΥΩΝ', y: currentY, align: 'center', fontSize: FONT_SIZES.BODY, color: COLORS.WHITE, margins, pageWidth });
    currentY += 15;
    
    currentY += 20;
    this.textRenderer.addText({ doc, text: 'ΣΥΓΓΡΑΦΗ ΥΠΟΧΡΕΩΣΕΩΝ', y: currentY, align: 'center', fontSize: FONT_SIZES.H1, bold: true, color: COLORS.RED, margins, pageWidth });
    currentY += 15;

    currentY = this.textRenderer.addText({ doc, text: document.title, y: currentY, align: 'center', fontSize: FONT_SIZES.H2, bold: true, margins, pageWidth });
    currentY += 10;
    currentY = this.textRenderer.addText({ doc, text: document.projectName, y: currentY, align: 'center', fontSize: FONT_SIZES.BODY, margins, pageWidth });
    currentY += 30;

    if (document.owners && document.owners.length > 0) {
      this.textRenderer.addText({ doc, text: 'ΙΔΙΟΚΤΗΤΕΣ', y: currentY, align: 'center', fontSize: FONT_SIZES.H3, bold: true, margins, pageWidth });
      currentY += 10;
      document.owners.forEach(owner => {
        currentY = this.textRenderer.addText({ doc, text: owner.share ? `${owner.name} (${owner.share}%)` : owner.name, y: currentY, align: 'left', fontSize: FONT_SIZES.BODY, margins, pageWidth });
        currentY += 2;
      });
    }

    currentY = pageHeight - 40;
    this.textRenderer.addText({ doc, text: `Θεσσαλονίκη, ${formatDate(new Date())}`, y: currentY, align: 'center', fontSize: FONT_SIZES.BODY, margins, pageWidth });

    return currentY;
  }
}
