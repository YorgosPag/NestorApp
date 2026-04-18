/**
 * =============================================================================
 * POST /api/properties/[id]/showcase/pdf (ADR-315 Phase M3)
 * =============================================================================
 *
 * Standalone PDF generator for the Property Showcase — generates the branded
 * PDF, uploads it to Storage, and returns the storage path WITHOUT creating
 * any share record. The UnifiedShareDialog calls this BEFORE invoking
 * UnifiedSharingService.createShare, which then persists the share with
 * `showcaseMeta.pdfStoragePath` attached.
 *
 * Split from `/showcase/generate` so that the unified dialog can drive all
 * three entity types (file / contact / property_showcase) through the same
 * createShare flow. The legacy `/showcase/generate` endpoint is kept for
 * retro-compat until Phase M5 cleanup.
 *
 * Security:
 *  - withAuth: `properties:properties:update`
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: property.companyId must match ctx.companyId
 *
 * Orphan risk: if the caller never invokes createShare, the uploaded PDF
 * remains without an owner and `onStorageFinalize` orphan-cleanup reaps it.
 * Acceptable — no Firestore residue.
 *
 * @module app/api/properties/[id]/showcase/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { generateShareId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { nowISO } from '@/lib/date-local';
import { PropertyShowcasePDFService } from '@/services/pdf/PropertyShowcasePDFService';
import {
  buildPdfData,
  deleteShowcaseShareRecord,
  loadShowcaseFloorplans,
  loadShowcaseLinkedSpaceFloorplans,
  loadShowcasePhotos,
  loadShowcaseSources,
  uploadPdfToStorage,
} from '../generate/helpers';

const logger = createModuleLogger('PropertyShowcasePdfRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z
  .object({
    locale: z.enum(['el', 'en']).optional(),
    videoUrl: z.string().url().optional(),
  })
  .strict();

interface ShowcasePdfResponse {
  pdfStoragePath: string;
  pdfRegeneratedAt: string;
}

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

async function handlePdf(
  req: NextRequest,
  ctx: AuthContext,
  propertyId: string
): Promise<NextResponse<ApiSuccessResponse<ShowcasePdfResponse>>> {
  let body: z.infer<typeof BodySchema> = {};
  try {
    const raw = await req.text();
    if (raw.trim().length > 0) body = BodySchema.parse(JSON.parse(raw));
  } catch {
    throw new ApiError(400, 'Invalid request body');
  }
  const locale = body.locale ?? 'el';
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

  logger.info('Generating standalone showcase PDF', {
    propertyId, uid: ctx.uid, companyId: ctx.companyId,
  });

  const sources = await loadShowcaseSources(propertyId, ctx.companyId);
  const [photos, floorplans, linkedSpaceFloorplans] = await Promise.all([
    loadShowcasePhotos(propertyId, ctx.companyId),
    loadShowcaseFloorplans(propertyId, ctx.companyId),
    loadShowcaseLinkedSpaceFloorplans(sources.context, ctx.companyId).catch((err) => {
      logger.warn('Linked-space floorplan load failed; continuing without', {
        propertyId, error: err instanceof Error ? err.message : String(err),
      });
      return { parking: [], storage: [] };
    }),
  ]);

  const pdfFileId = generateShareId();
  const storagePath = buildStoragePath({
    companyId: ctx.companyId,
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.DOCUMENTS,
    fileId: pdfFileId,
    ext: 'pdf',
  }).path;

  // `showcaseUrl` inside the PDF points to the unified public route. The
  // token is not known yet — createShare produces it AFTER the PDF is built.
  // Use the base URL so the PDF remains branded but the link is filled in
  // by the unified share token later. Omit token placeholder to avoid stale URLs.
  const baseUrl = buildBaseUrl(req);
  const showcaseUrl = `${baseUrl}/shared`;

  const pdfData = buildPdfData(
    propertyId, sources, showcaseUrl, body.videoUrl, locale, photos, floorplans,
    linkedSpaceFloorplans,
  );

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await new PropertyShowcasePDFService().generate(pdfData);
  } catch (err) {
    logger.error('PDF generation failed', {
      propertyId, error: err instanceof Error ? err.message : String(err),
    });
    throw new ApiError(500, 'PDF generation failed');
  }

  // Pre-upload ownership claim in FILE_SHARES (inert, isActive=false) so the
  // `onStorageFinalize` orphan-cleanup trigger finds the PDF via
  // `findFileOwner()` and skips deletion. Without this, the reaper runs
  // between upload and the later `shares` record creation (UnifiedSharingService.createShare)
  // and deletes the just-uploaded PDF. Pattern mirrors ADR-312 §Race.
  // The claim becomes inert metadata after `shares` creation — acceptable
  // for test data; a future M5 pass can migrate the resolver to also query
  // `shares` by `showcaseMeta.pdfStoragePath` and drop this pre-write.
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');
  await adminDb.collection(COLLECTIONS.FILE_SHARES).doc(pdfFileId).set({
    fileId: pdfFileId,
    createdBy: ctx.uid,
    createdAt: new Date(),
    isActive: false,
    requiresPassword: false,
    downloadCount: 0,
    maxDownloads: 0,
    companyId: ctx.companyId,
    showcasePropertyId: propertyId,
    showcaseMode: true,
    pdfStoragePath: storagePath,
    note: 'ADR-315 M3 pre-upload claim (unified flow)',
  });

  try {
    await uploadPdfToStorage(pdfBytes, storagePath);
  } catch (err) {
    await deleteShowcaseShareRecord(pdfFileId).catch((cleanupErr) => {
      logger.error('Failed to compensate orphan pre-upload claim', {
        pdfFileId, propertyId,
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
    logger.error('PDF upload failed', {
      propertyId, storagePath, error: err instanceof Error ? err.message : String(err),
    });
    throw new ApiError(500, 'PDF upload failed');
  }

  const pdfRegeneratedAt = nowISO();

  logger.info('Standalone showcase PDF ready', {
    propertyId, storagePath, companyId: ctx.companyId,
  });

  return apiSuccess<ShowcasePdfResponse>(
    { pdfStoragePath: storagePath, pdfRegeneratedAt },
    'Property showcase PDF generated'
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
    withAuth<ApiSuccessResponse<ShowcasePdfResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        return handlePdf(req, ctx, id);
      },
      { permissions: 'properties:properties:update' }
    )
  );
  return handler(request);
}
