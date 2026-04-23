/**
 * =============================================================================
 * POST /api/buildings/[buildingId]/showcase/pdf (ADR-320)
 * =============================================================================
 *
 * Authenticated PDF generator for the Building Showcase. Generates a branded
 * PDF, uploads it to Storage, and returns the storage path. The
 * UnifiedShareDialog calls this as `preSubmit` BEFORE invoking
 * UnifiedSharingService.createShare, which then persists the share record with
 * `showcaseMeta.pdfStoragePath`.
 *
 * Security:
 *  - withAuth: `buildings:buildings:update`
 *  - withStandardRateLimit: 60 req/min per user
 *  - Tenant isolation: enforced by buildBuildingShowcaseSnapshot (throws on mismatch)
 *
 * @module app/api/buildings/[buildingId]/showcase/pdf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { generateShareId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { nowISO } from '@/lib/date-local';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import { loadBuildingShowcasePdfLabels } from '@/services/building-showcase/labels';
import { BuildingShowcasePDFService } from '@/services/pdf/BuildingShowcasePDFService';
import { loadBrandLogoAssets } from '@/services/property-showcase/brand-logo-assets';
import { downloadEntityMedia } from '@/services/property-media/property-media.service';
import type { ShowcasePhotoAsset } from '@/services/pdf/renderers/BuildingShowcaseRenderer';
import type { PropertyMediaBuffer } from '@/services/property-media/property-media.service';

const logger = createModuleLogger('BuildingShowcasePdfRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({ locale: z.enum(['el', 'en']).optional() }).strict();

interface ShowcasePdfResponse {
  pdfStoragePath: string;
  pdfRegeneratedAt: string;
}

function toPhotoAsset(buf: PropertyMediaBuffer): ShowcasePhotoAsset {
  return {
    id: buf.id,
    bytes: buf.bytes,
    format: buf.jsPdfFormat,
    displayName: buf.displayName || buf.originalFilename || undefined,
  };
}

async function uploadToStorage(pdfBytes: Uint8Array, storagePath: string): Promise<void> {
  const bucket = getAdminBucket();
  const fileRef = bucket.file(storagePath);
  if (pdfBytes.byteLength === 0) throw new Error('PDF buffer is empty');
  await fileRef.save(Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength), {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'private, max-age=3600' },
    resumable: false,
  });
  const [exists] = await fileRef.exists();
  if (!exists) throw new Error(`Upload succeeded but object missing: ${storagePath}`);
}

async function handlePdf(
  req: NextRequest,
  ctx: AuthContext,
  buildingId: string,
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

  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');

  logger.info('Generating building showcase PDF', { buildingId, uid: ctx.uid, companyId: ctx.companyId });

  const snapshot = await buildBuildingShowcaseSnapshot(buildingId, locale, adminDb, ctx.companyId);

  const mediaOpts = { companyId: ctx.companyId, entityType: ENTITY_TYPES.BUILDING, entityId: buildingId, limit: 20 };
  const [photoBuffers, floorplanBuffers, logos] = await Promise.all([
    downloadEntityMedia({ ...mediaOpts, category: FILE_CATEGORIES.PHOTOS }).catch((err) => {
      logger.warn('Photo download failed; continuing without', { buildingId, error: String(err) });
      return [];
    }),
    downloadEntityMedia({ ...mediaOpts, category: FILE_CATEGORIES.FLOORPLANS }).catch((err) => {
      logger.warn('Floorplan download failed; continuing without', { buildingId, error: String(err) });
      return [];
    }),
    loadBrandLogoAssets(snapshot.company),
  ]);

  const labels = loadBuildingShowcasePdfLabels(locale);
  const pdfData = {
    snapshot,
    photos: photoBuffers.map(toPhotoAsset),
    floorplans: floorplanBuffers.map(toPhotoAsset),
    companyLogo: logos.companyLogo,
    nestorAppLogo: logos.nestorAppLogo,
    generatedAt: new Date(),
    labels,
    locale,
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await new BuildingShowcasePDFService().generate(pdfData);
  } catch (err) {
    logger.error('PDF generation failed', { buildingId, error: String(err) });
    throw new ApiError(500, 'PDF generation failed');
  }

  const pdfFileId = generateShareId();
  const storagePath = buildStoragePath({
    companyId: ctx.companyId,
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.DOCUMENTS,
    fileId: pdfFileId,
    ext: 'pdf',
  }).path;

  await adminDb.collection(COLLECTIONS.FILE_SHARES).doc(pdfFileId).set({
    fileId: pdfFileId,
    createdBy: ctx.uid,
    createdAt: new Date(),
    isActive: false,
    requiresPassword: false,
    downloadCount: 0,
    maxDownloads: 0,
    companyId: ctx.companyId,
    showcaseBuildingId: buildingId,
    showcaseMode: true,
    pdfStoragePath: storagePath,
    note: 'ADR-320 pre-upload claim (building showcase)',
  });

  try {
    await uploadToStorage(pdfBytes, storagePath);
  } catch (err) {
    await adminDb.collection(COLLECTIONS.FILE_SHARES).doc(pdfFileId).delete().catch((cleanupErr) => {
      logger.error('Failed to compensate orphan pre-upload claim', { pdfFileId, error: String(cleanupErr) });
    });
    logger.error('PDF upload failed', { buildingId, storagePath, error: String(err) });
    throw new ApiError(500, 'PDF upload failed');
  }

  const pdfRegeneratedAt = nowISO();
  logger.info('Building showcase PDF ready', { buildingId, storagePath });

  return apiSuccess<ShowcasePdfResponse>(
    { pdfStoragePath: storagePath, pdfRegeneratedAt },
    'Building showcase PDF generated',
  );
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await segmentData.params;
  if (!buildingId || buildingId.trim().length === 0) {
    return NextResponse.json({ error: 'Building ID is required' }, { status: 400 });
  }
  const handler = withStandardRateLimit(
    withAuth<ApiSuccessResponse<ShowcasePdfResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        return handlePdf(req, ctx, buildingId);
      },
      { permissions: 'buildings:buildings:update' },
    ),
  );
  return handler(request);
}
