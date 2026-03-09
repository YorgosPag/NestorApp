/**
 * =============================================================================
 * PDF Generation API — Generate PDF from HTML template
 * =============================================================================
 *
 * Renders HTML content to a PDF document using jsPDF.
 * Used for generating documents from templates (Phase 4.1 + Phase 5.2).
 *
 * @module api/files/generate-pdf
 * @enterprise ADR-191 Phase 5.2 — Automated PDF Generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

export const maxDuration = 30;

async function handler(
  request: NextRequest,
  _ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  try {
    const { html, filename = 'document.pdf', title = '' } = await request.json();

    if (!html) {
      return NextResponse.json(
        { error: 'Missing html content' },
        { status: 400 }
      );
    }

    // Dynamic import of pdf-lib for server-side PDF generation
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Simple HTML-to-text extraction (strip tags)
    const textContent = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    // Page dimensions (A4)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const maxWidth = pageWidth - 2 * margin;
    const lineHeight = 16;
    const fontSize = 11;
    const titleFontSize = 18;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPos = pageHeight - margin;

    // Title
    if (title) {
      page.drawText(title, {
        x: margin,
        y: yPos,
        size: titleFontSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      yPos -= titleFontSize + 20;
    }

    // Split text into lines
    const lines = textContent.split('\n');

    for (const line of lines) {
      if (line.trim() === '') {
        yPos -= lineHeight;
        continue;
      }

      // Word-wrap
      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = helvetica.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
          // Draw current line
          if (yPos < margin) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPos = pageHeight - margin;
          }
          page.drawText(currentLine, {
            x: margin,
            y: yPos,
            size: fontSize,
            font: helvetica,
            color: rgb(0, 0, 0),
          });
          yPos -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      // Draw remaining text
      if (currentLine) {
        if (yPos < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPos = pageHeight - margin;
        }
        page.drawText(currentLine, {
          x: margin,
          y: yPos,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
        yPos -= lineHeight;
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[PDF Generation] Error:', error);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
