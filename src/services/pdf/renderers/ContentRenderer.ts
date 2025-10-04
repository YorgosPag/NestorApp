import type { ObligationDocument } from '@/types/obligations';
import { stripHtmlTags } from '@/lib/obligations-utils';
import type { IPDFDoc, IContentRenderer, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONTS, FONT_STYLES, FONT_SIZES, LINE_SPACING } from '../layout';

export class ContentRenderer implements IContentRenderer {
  private textRenderer = new TextRenderer();
  private currentY: number = 0;
  private doc!: IPDFDoc;
  private margins!: Margins;
  private contentWidth!: number;
  private addNewPageCb!: () => number;

  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, pageHeight: number, document: ObligationDocument, helpers: { addNewPage: () => number }): number {
    this.doc = doc;
    this.margins = margins;
    this.contentWidth = contentWidth;
    this.currentY = yStart;
    this.addNewPageCb = helpers.addNewPage;
    
    document.sections.forEach(section => {
      this.addSectionHeader(section.number, section.title, 1);
      if (section.content) this.addParagraph(section.content);
      section.articles?.forEach(article => {
        this.addSectionHeader(article.number, article.title, 2);
        if (article.content) this.addParagraph(article.content);
        article.paragraphs?.forEach(p => this.addNumberedParagraph(p.number, p.content));
      });
      this.currentY += 10;
    });

    return this.currentY;
  }
  
  private addSectionHeader(number: string, title: string, level: number) {
    if ((level === 1 && this.currentY > this.margins.top + 20) || (this.currentY > this.doc.pageSize.height - this.margins.bottom - 30)) {
        this.currentY = this.addNewPageCb();
    }
    
    this.currentY += level === 1 ? LINE_SPACING.H1 : LINE_SPACING.H2;
    
    if (level === 1) {
        this.doc.setDrawColor(...COLORS.RED);
        this.doc.setLineWidth(0.5);
        this.doc.line(this.margins.left, this.currentY - 5, this.margins.left + this.contentWidth, this.currentY - 5);
    }
    
    const fontSize = level === 1 ? FONT_SIZES.H2 : FONT_SIZES.H3;
    const color = level === 1 ? COLORS.RED : COLORS.BLACK;
    const headerText = level === 1 ? `Άρθρο ${number}° - ${title.toUpperCase()}` : `${number}. ${title}`;
    
    this.currentY = this.textRenderer.addText({ doc: this.doc, text: headerText, y: this.currentY, fontSize, bold: true, color, margins: this.margins, pageWidth: this.doc.pageSize.width });
  }

  private addParagraph(content: string) {
    const cleanContent = stripHtmlTags(content);
    this.currentY = this.textRenderer.addWrappedText({
        doc: this.doc, text: cleanContent, y: this.currentY, maxWidth: this.contentWidth, margins: this.margins, onPageBreak: this.addNewPageCb
    });
    this.currentY += 6;
  }

  private addNumberedParagraph(number: string, content: string) {
    if (this.currentY > this.doc.pageSize.height - this.margins.bottom - 15) {
        this.currentY = this.addNewPageCb();
    }

    const cleanContent = stripHtmlTags(content);
    this.doc.setFont(FONTS.HELVETICA, FONT_STYLES.NORMAL);
    this.doc.setFontSize(FONT_SIZES.BODY);
    this.doc.setTextColor(...COLORS.BLACK);
    
    this.doc.text(`${number}.`, this.margins.left + 10, this.currentY);
    
    const lines = this.doc.splitTextToSize(cleanContent, this.contentWidth - 25);
    lines.forEach((line: string) => {
      if (this.currentY > this.doc.pageSize.height - this.margins.bottom - 10) {
        this.currentY = this.addNewPageCb();
      }
      this.doc.text(line, this.margins.left + 20, this.currentY);
      this.currentY += LINE_SPACING.BODY;
    });
    
    this.currentY += 3;
  }
}
