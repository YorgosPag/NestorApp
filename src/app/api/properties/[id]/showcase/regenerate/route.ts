/**
 * =============================================================================
 * POST /api/properties/[id]/showcase/regenerate (ADR-312 Phase 3.2)
 * =============================================================================
 *
 * Regenerates the PDF of an EXISTING Property Showcase share in-place.
 * Preserves `token`, `shareId`, and `pdfStoragePath` — any public URL
 * previously distributed keeps working. Adds `pdfRegeneratedAt` on the
 * FILE_SHARES doc for tracking.
 *
 * Use case: fresh data (e.g. new DXF thumbnails) should appear inside a
 * PDF whose URL was already shared with stakeholders. Rotating the token
 * is not acceptable in that flow — we rewrite the blob at the same path.
 *
 * Security:
 *  - withAuth: `properties:properties:update` permission
 *  - withStandardRateLimit: 60 req/min per user
 *  - Ownership: share.companyId must match ctx.companyId AND
 *    share.showcasePropertyId must match URL `[id]`
 *
 * @module app/api/properties/[id]/showcase/regenerate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { regeneratePdfForShare } from '../generate/helpers';

const logger = createModuleLogger('PropertyShowcaseRegenerateRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z
  .object({
    shareId: z.string().min(1),
    locale: z.enum(['el', 'en']).optional(),
    videoUrl: z.string().url().optional(),
  })
  .strict();

interface ShowcaseRegenerateResponse {
  shareId: string;
  token: string;
  pdfUrl: string;
  regeneratedAt: string;
}

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

async function handleRegenerate(
  req: NextRequest,
  ctx: AuthContext,
  propertyId: string
): Promise<NextResponse<ApiSuccessResponse<ShowcaseRegenerateResponse>>> {
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.text();
    if (raw.trim().length === 0) {
      throw new ApiError(400, 'Request body required');
    }
    body = BodySchema.parse(JSON.parse(raw));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, 'Invalid request body');
  }
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

  logger.info('Regenerating property showcase', {
    shareId: body.shareId, propertyId, uid: ctx.uid, companyId: ctx.companyId,
  });

  const baseUrl = buildBaseUrl(req);
  const result = await regeneratePdfForShare({
    shareId: body.shareId,
    propertyId,
    companyId: ctx.companyId,
    baseUrl,
    locale: body.locale,
    videoUrl: body.videoUrl,
  });

  const pdfUrl = `${baseUrl}/api/showcase/${result.token}/pdf`;

  return apiSuccess<ShowcaseRegenerateResponse>(
    {
      shareId: result.shareId,
      token: result.token,
      pdfUrl,
      regeneratedAt: result.regeneratedAt.toISOString(),
    },
    'Property showcase PDF regenerated'
  );
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
  }
  const handler = withStandardRateLimit(
    withAuth<ApiSuccessResponse<ShowcaseRegenerateResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        return handleRegenerate(req, ctx, id);
      },
      { permissions: 'properties:properties:update' }
    )
  );
  return handler(request);
}
