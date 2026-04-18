/**
 * =============================================================================
 * POST/DELETE /api/properties/[id]/showcase/generate (ADR-312)
 * =============================================================================
 *
 * Property Showcase generator (SSoT composition):
 *  - POST: generates branded PDF, uploads to Storage, creates FILE_SHARES
 *          record, returns `{ token, pdfUrl, richUrl }`
 *  - DELETE: deactivates the share (revokes both rich page and PDF access)
 *
 * Security:
 *  - withAuth: 'properties:properties:update' permission required
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: property companyId must match ctx.companyId
 *
 * Share TTL: fixed 30 days (MVP). No password, no max-download.
 *
 * @module app/api/properties/[id]/showcase/generate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { generateShareId } from '@/services/enterprise-id.service';
import { PropertyShowcasePDFService } from '@/services/pdf/PropertyShowcasePDFService';
import {
  buildPdfData,
  deactivateShowcaseShares,
  deleteShowcaseShareRecord,
  loadShowcaseFloorplans,
  loadShowcasePhotos,
  loadShowcaseSources,
  uploadPdfToStorage,
} from './helpers';

const logger = createModuleLogger('PropertyShowcaseRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SHOWCASE_TTL_HOURS = 24 * 30;

const BodySchema = z
  .object({
    locale: z.enum(['el', 'en']).optional(),
    videoUrl: z.string().url().optional(),
  })
  .strict();

interface ShowcaseGenerateResponse {
  token: string;
  pdfUrl: string;
  richUrl: string;
  expiresAt: string;
}

interface ShowcaseRevokeResponse {
  revoked: true;
  shareIds: string[];
}

function generateUrlSafeToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

async function generatePdfOrThrow(
  propertyId: string,
  pdfData: ReturnType<typeof buildPdfData>
): Promise<Uint8Array> {
  try {
    const pdfService = new PropertyShowcasePDFService();
    return await pdfService.generate(pdfData);
  } catch (err) {
    logger.error('PDF generation failed', {
      propertyId, error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw new ApiError(500, 'PDF generation failed');
  }
}

async function writeShowcaseShareRecord(args: {
  shareId: string;
  token: string;
  propertyId: string;
  companyId: string;
  createdBy: string;
  storagePath: string;
  expiresAt: Date;
}): Promise<void> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');
  await adminDb.collection(COLLECTIONS.FILE_SHARES).doc(args.shareId).set({
    fileId: args.shareId,
    token: args.token,
    createdBy: args.createdBy,
    createdAt: new Date(),
    expiresAt: args.expiresAt.toISOString(),
    isActive: true,
    requiresPassword: false,
    downloadCount: 0,
    maxDownloads: 0,
    companyId: args.companyId,
    showcasePropertyId: args.propertyId,
    showcaseMode: true,
    pdfStoragePath: args.storagePath,
  });
}

async function handleGenerate(
  req: NextRequest,
  ctx: AuthContext,
  propertyId: string
): Promise<NextResponse<ApiSuccessResponse<ShowcaseGenerateResponse>>> {
  let body: z.infer<typeof BodySchema> = {};
  try {
    const raw = await req.text();
    if (raw.trim().length > 0) body = BodySchema.parse(JSON.parse(raw));
  } catch {
    throw new ApiError(400, 'Invalid request body');
  }
  const locale = body.locale ?? 'el';
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

  logger.info('Generating property showcase', { propertyId, uid: ctx.uid, companyId: ctx.companyId });

  const [sources, photos, floorplans] = await Promise.all([
    loadShowcaseSources(propertyId, ctx.companyId),
    loadShowcasePhotos(propertyId, ctx.companyId),
    loadShowcaseFloorplans(propertyId, ctx.companyId),
  ]);

  const token = generateUrlSafeToken();
  const shareId = generateShareId();
  const storagePath = buildStoragePath({
    companyId: ctx.companyId,
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.DOCUMENTS,
    fileId: shareId,
    ext: 'pdf',
  }).path;
  const baseUrl = buildBaseUrl(req);
  const showcaseUrl = `${baseUrl}/showcase/${token}`;

  const pdfData = buildPdfData(propertyId, sources, showcaseUrl, body.videoUrl, locale, photos, floorplans);
  const pdfBytes = await generatePdfOrThrow(propertyId, pdfData);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SHOWCASE_TTL_HOURS);

  // Write the ownership claim BEFORE the Storage upload so the
  // `onStorageFinalize` orphan-cleanup trigger (functions/src/storage) finds
  // a FILE_SHARES record via `findFileOwner()` and skips deletion. Doing it
  // after upload races the trigger and legitimate PDFs get mis-classified
  // as orphans (incident 2026-04-17). ADR-312 §Race.
  await writeShowcaseShareRecord({
    shareId, token, propertyId,
    companyId: ctx.companyId,
    createdBy: ctx.uid,
    storagePath,
    expiresAt,
  });

  try {
    await uploadPdfToStorage(pdfBytes, storagePath);
  } catch (err) {
    // Compensation: remove the orphaned ownership claim so no stale
    // FILE_SHARES record pointing to a missing PDF remains visible.
    await deleteShowcaseShareRecord(shareId).catch((cleanupErr) => {
      logger.error('Failed to compensate orphan showcase share record', {
        shareId, propertyId,
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
    logger.error('PDF upload failed', {
      propertyId, storagePath, error: err instanceof Error ? err.message : String(err),
    });
    throw new ApiError(500, 'PDF upload failed');
  }

  const pdfUrl = `${baseUrl}/api/showcase/${token}/pdf`;

  logger.info('Property showcase generated', {
    propertyId, shareId, token, companyId: ctx.companyId, uid: ctx.uid,
  });

  return apiSuccess<ShowcaseGenerateResponse>(
    { token, pdfUrl, richUrl: showcaseUrl, expiresAt: expiresAt.toISOString() },
    'Property showcase generated'
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
    withAuth<ApiSuccessResponse<ShowcaseGenerateResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        return handleGenerate(req, ctx, id);
      },
      { permissions: 'properties:properties:update' }
    )
  );
  return handler(request);
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
  }
  const handler = withStandardRateLimit(
    withAuth<ApiSuccessResponse<ShowcaseRevokeResponse>>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        if (!ctx.companyId) throw new ApiError(403, 'Missing company context');
        const shareIds = await deactivateShowcaseShares(id, ctx.companyId);
        logger.info('Property showcase revoked', {
          propertyId: id, revokedCount: shareIds.length, companyId: ctx.companyId, uid: ctx.uid,
        });
        return apiSuccess<ShowcaseRevokeResponse>(
          { revoked: true, shareIds },
          'Property showcase share revoked'
        );
      },
      { permissions: 'properties:properties:update' }
    )
  );
  return handler(request);
}
