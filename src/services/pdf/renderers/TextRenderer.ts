import type { IPDFDoc, ITextRenderer, Margins } from '../contracts';
import { FONTS, FONT_STYLES, FONT_SIZES, LINE_SPACING, COLORS } from '../layout';

export interface TextRendererConfig {
  /**
   * Font family the renderer will pass to `doc.setFont()`. Defaults to
   * `FONTS.HELVETICA` (legacy Latin-only) to preserve backward compatibility
   * with callers that do not register a Unicode font. Pass `FONTS.UNICODE`
   * (`'Roboto'`) when the caller has invoked `registerGreekFont(doc)` and
   * needs Greek/CJK glyph support (ADR-267, ADR-312).
   */
  font?: string;
}

export class TextRenderer implements ITextRenderer {
  private readonly font: string;

  constructor(config: TextRendererConfig = {}) {
    this.font = config.font ?? FONTS.HELVETICA;
  }

  addText(args: {
    doc: IPDFDoc;
    text: string;
    y: number;
    align?: 'left' | 'center' | 'right';
    fontSize?: number;
    bold?: boolean;
    color?: [number, number, number];
    margins: Margins;
    pageWidth: number;
  }): number {
    const {
      doc, text, y, align = 'left', fontSize = FONT_SIZES.BODY,
      bold = false, color = COLORS.BLACK, margins, pageWidth
    } = args;

    doc.setFont(this.font, bold ? FONT_STYLES.BOLD : FONT_STYLES.NORMAL);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    let x = margins.left;
    if (align === 'center') {
      x = pageWidth / 2;
    } else if (align === 'right') {
      x = pageWidth - margins.right;
    }

    doc.text(text, x, y, { align });
    doc.setTextColor(...COLORS.BLACK); // Reset color

    return y + LINE_SPACING.BODY; // Assume single line height
  }

  addWrappedText(args: {
    doc: IPDFDoc; text: string; y: number; fontSize?: number;
    bold?: boolean; maxWidth: number; margins: Margins;
    onPageBreak: () => number; lineStep?: number;
  }): number {
    let {
      doc, text, y, fontSize = FONT_SIZES.BODY, bold = false,
      maxWidth, margins, onPageBreak, lineStep = LINE_SPACING.BODY,
    } = args;

    doc.setFont(this.font, bold ? FONT_STYLES.BOLD : FONT_STYLES.NORMAL);
    doc.setFontSize(fontSize);

    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      if (y > doc.pageSize.height - margins.bottom - 10) {
        y = onPageBreak();
      }
      doc.text(line, margins.left, y);
      y += lineStep;
    });

    return y;
  }
}
