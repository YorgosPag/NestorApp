/**
 * =============================================================================
 * Watermark API — Add watermark to PDF documents
 * =============================================================================
 *
 * Adds diagonal text watermark to PDF files for confidential documents.
 * Uses pdf-lib (MIT license) for server-side PDF manipulation.
 *
 * @module api/files/watermark
 * @enterprise ADR-191 Phase 3.4 — Watermarking
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';

export const maxDuration = 30;

async function handler(
  request: NextRequest,
  _ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  try {
    const { url, text, opacity = 0.15, fontSize = 48 } = await request.json();

    if (!url || !text) {
      return NextResponse.json(
        { error: 'Missing url or text' },
        { status: 400 }
      );
    }

    // Fetch original PDF
    const pdfResponse = await fetch(url);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch PDF' },
        { status: 502 }
      );
    }

    const pdfBytes = await pdfResponse.arrayBuffer();

    // Dynamic import of pdf-lib (tree-shaking friendly)
    const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = helvetica.widthOfTextAtSize(text, fontSize);

      // Diagonal watermark from bottom-left to top-right
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font: helvetica,
        color: rgb(0.7, 0.7, 0.7),
        opacity,
        rotate: degrees(45),
      });
    }

    const watermarkedBytes = await pdfDoc.save();

    return new NextResponse(new Blob([watermarkedBytes]), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="watermarked.pdf"',
      },
    });
  } catch (error) {
    console.error('[Watermark API] Error:', error);
    return NextResponse.json(
      { error: 'Watermark failed' },
      { status: 500 }
    );
  }
}

export const POST = withHeavyRateLimit(withAuth(handler));
