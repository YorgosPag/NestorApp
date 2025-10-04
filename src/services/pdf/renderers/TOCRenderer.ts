import type { TableOfContentsItem } from '@/types/obligations';
import type { IPDFDoc, ITOCRenderer, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONTS, FONT_STYLES, FONT_SIZES } from '../layout';

export class TOCRenderer implements ITOCRenderer {
  private textRenderer = new TextRenderer();

  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, toc: TableOfContentsItem[], addNewPage: () => void): void {
    let currentY = yStart;

    currentY = this.textRenderer.addText({ doc, text: 'ΠΙΝΑΚΑΣ ΠΕΡΙΕΧΟΜΕΝΩΝ', y: currentY, align: 'center', fontSize: 16, bold: true, color: COLORS.RED, margins, pageWidth });
    currentY += 10;

    doc.setDrawColor(...COLORS.RED);
    doc.line(margins.left, currentY, margins.left + contentWidth, currentY);
    currentY += 10;

    const renderItem = (item: TableOfContentsItem, level: number) => {
      if (currentY > doc.pageSize.height - margins.bottom - 20) {
        addNewPage();
        currentY = margins.top;
      }
      
      const indent = (level - 1) * 10;
      const maxWidth = contentWidth - indent - 20;
      const pageNum = item.page?.toString() || '';
      
      doc.setFont(FONTS.HELVETICA, level === 1 ? FONT_STYLES.BOLD : FONT_STYLES.NORMAL);
      doc.setFontSize(level === 1 ? 11 : 10);
      doc.setTextColor(...COLORS.BLACK);
      
      doc.text(item.title, margins.left + indent, currentY);
      
      const titleWidth = doc.getTextWidth(item.title);
      const pageNumWidth = doc.getTextWidth(pageNum);
      const dotsWidth = maxWidth - titleWidth - pageNumWidth;
      const dots = '.'.repeat(Math.floor(dotsWidth / doc.getTextWidth('.')));
      
      doc.text(dots, margins.left + indent + titleWidth + 2, currentY);
      doc.text(pageNum, pageWidth - margins.right - pageNumWidth, currentY, { align: 'right' });
      
      currentY += level === 1 ? 8 : 6;
      item.children?.forEach(child => renderItem(child, level + 1));
    };

    toc.forEach(item => renderItem(item, 1));
  }
}
