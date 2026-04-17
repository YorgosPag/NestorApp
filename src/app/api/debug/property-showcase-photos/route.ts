/**
 * =============================================================================
 * GET /api/debug/property-showcase-photos (ADR-312 Phase 2.1 diagnostic)
 * =============================================================================
 *
 * Dev-only isolation endpoint for the Phase 2 photo-embedding regression
 * (incident 2026-04-17): PDFs reach Giorgio with a photo page but no visible
 * images. Bypasses the full showcase renderer (header, Greek font, footer)
 * so we can confirm whether the failure is in the Storage download path, the
 * Buffer→Uint8Array handoff, or jsPDF's addImage.
 *
 * Modes:
 *   - `mode=json` (default): returns metadata + first-bytes magic of every
 *     embeddable photo — proves `PropertyMediaService.downloadPropertyMedia`
 *     delivers valid, JPEG/PNG-shaped bytes.
 *   - `mode=pdf`: streams a minimal 1-page PDF that contains ONLY the 3×2
 *     photo grid, using a fresh `jsPDF` instance with no Greek font and no
 *     auxiliary renderers. If photos appear here but not in the full showcase
 *     PDF, the regression is in upstream rendering (font, page bookkeeping),
 *     not in the image pipeline.
 *
 * Guards:
 *   - `NODE_ENV !== 'production'` — 404 otherwise.
 *   - `withAuth('properties:properties:update')` — same gate as generator.
 *   - Standard rate limit.
 *
 * Removed once Phase 2 photo embedding is confirmed stable in prod.
 *
 * @module app/api/debug/property-showcase-photos/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { downloadPropertyMedia } from '@/services/property-media/property-media.service';
import { JSPDFAdapter } from '@/services/pdf/adapters/JSPDFAdapter';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('DebugShowcasePhotosRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PhotoDiagnosis {
  id: string;
  displayName?: string;
  format: 'JPEG' | 'PNG';
  contentType?: string;
  bytesLen: number;
  magicHex: string;
  storagePath: string;
}

interface JsonDiagnosisResponse {
  propertyId: string;
  companyId: string;
  count: number;
  totalBytes: number;
  photos: PhotoDiagnosis[];
}

function assertDev(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(404, 'Not found');
  }
}

function toHex(bytes: Uint8Array, n: number): string {
  return Array.from(bytes.slice(0, n))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

async function handleJson(
  propertyId: string,
  companyId: string
): Promise<NextResponse<ApiSuccessResponse<JsonDiagnosisResponse>>> {
  const buffers = await downloadPropertyMedia({
    companyId,
    propertyId,
    category: FILE_CATEGORIES.PHOTOS,
    limit: 6,
  });

  const photos: PhotoDiagnosis[] = buffers.map((b) => ({
    id: b.id,
    displayName: b.displayName,
    format: b.jsPdfFormat,
    contentType: b.contentType,
    bytesLen: b.bytes.byteLength,
    magicHex: toHex(b.bytes, 8),
    storagePath: b.storagePath,
  }));

  const totalBytes = photos.reduce((sum, p) => sum + p.bytesLen, 0);

  logger.info('Debug JSON diagnosis served', {
    propertyId, companyId, count: photos.length, totalBytes,
  });

  return apiSuccess<JsonDiagnosisResponse>(
    { propertyId, companyId, count: photos.length, totalBytes, photos },
    'Showcase photo diagnosis'
  );
}

async function handlePdf(
  propertyId: string,
  companyId: string
): Promise<NextResponse> {
  const buffers = await downloadPropertyMedia({
    companyId,
    propertyId,
    category: FILE_CATEGORIES.PHOTOS,
    limit: 6,
  });

  if (buffers.length === 0) {
    throw new ApiError(404, 'No embeddable photos found');
  }

  // Fresh jsPDF, no Greek font register, no ancillary renderers. If photos
  // appear here, the regression is upstream of the image pipeline.
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const adapter = new JSPDFAdapter(doc);

  const margin = 18;
  const pageWidth = adapter.pageSize.width;
  const contentWidth = pageWidth - margin * 2;
  const cols = 3;
  const gap = 4;
  const cellWidth = (contentWidth - gap * (cols - 1)) / cols;
  const cellHeight = cellWidth * 0.75;

  let col = 0;
  let rowY = margin;
  for (const b of buffers) {
    const x = margin + col * (cellWidth + gap);
    try {
      adapter.addImage(
        b.bytes, b.jsPdfFormat, x, rowY, cellWidth, cellHeight, b.id, 'FAST'
      );
    } catch (err) {
      console.error('[debug-showcase-photos] addImage failed', {
        photoId: b.id, format: b.jsPdfFormat, bytesLen: b.bytes.byteLength,
        magic: toHex(b.bytes, 8),
        error: err instanceof Error ? err.message : String(err),
      });
      adapter.setDrawColor(180, 180, 180);
      adapter.rect(x, rowY, cellWidth, cellHeight, 'S');
    }
    col += 1;
    if (col >= cols) { col = 0; rowY += cellHeight + gap; }
  }

  const ab = adapter.output('arraybuffer');
  const pdfBytes = new Uint8Array(ab);

  logger.info('Debug PDF diagnosis served', {
    propertyId, companyId, photoCount: buffers.length, pdfBytes: pdfBytes.byteLength,
  });

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="debug-showcase-${propertyId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  assertDev();

  const handler = withStandardRateLimit(
    withAuth(async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

      const propertyId = req.nextUrl.searchParams.get('propertyId')?.trim();
      if (!propertyId) throw new ApiError(400, 'propertyId query param is required');

      const mode = req.nextUrl.searchParams.get('mode') ?? 'json';

      if (mode === 'pdf') {
        return handlePdf(propertyId, ctx.companyId);
      }
      return handleJson(propertyId, ctx.companyId);
    }, { permissions: 'properties:properties:update' })
  );

  return handler(request);
}
