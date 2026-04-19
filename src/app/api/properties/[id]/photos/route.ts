/**
 * =============================================================================
 * GET /api/properties/[id]/photos (ADR-312 Phase 9.17)
 * =============================================================================
 *
 * Lightweight JSON endpoint used by the UnifiedShareDialog channel surface to
 * pre-fill `PhotoPickerGrid` with the property's real photo URLs. Without
 * this pre-fill the Telegram/WhatsApp share flow had no image payload and
 * always collapsed into the link-only fallback (Phase 9.16).
 *
 * - Tenant-scoped: property must belong to `ctx.companyId`.
 * - Photos are read via `listPropertyMedia` (SSoT reader of the `files`
 *   collection) and filtered to JPEG/PNG with a non-empty `downloadUrl`.
 * - Returned URLs are the Firebase Storage `getDownloadURL` tokens captured
 *   at upload time — the same URLs the server-side multipart uploader
 *   (Phase 9.14) re-fetches to forward to Telegram.
 *
 * @module app/api/properties/[id]/photos/route
 * @see ADR-312 Property Showcase
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { listPropertyMedia } from '@/services/property-media/property-media.service';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PropertyPhotosRoute');

export const dynamic = 'force-dynamic';

const ALLOWED_MIMES: ReadonlySet<string> = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_PHOTOS = 20;

interface PropertyPhotoItem {
  id: string;
  url: string;
  displayName?: string;
  contentType?: string;
}

interface PropertyPhotosResponse {
  photos: PropertyPhotoItem[];
}

async function handleGet(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<PropertyPhotosResponse>>> {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

  const propertyId = extractNestedIdFromUrl(request.url, 'properties');
  if (!propertyId) throw new ApiError(400, 'Property ID is required');

  await requirePropertyInTenantScope({
    ctx,
    propertyId,
    path: request.nextUrl.pathname,
  });

  const metas = await listPropertyMedia({
    companyId: ctx.companyId,
    propertyId,
    category: FILE_CATEGORIES.PHOTOS,
    limit: MAX_PHOTOS,
  });

  const photos: PropertyPhotoItem[] = [];
  for (const m of metas) {
    if (!m.downloadUrl) continue;
    const mime = (m.contentType ?? '').toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) continue;
    photos.push({
      id: m.id,
      url: m.downloadUrl,
      displayName: m.displayName || m.originalFilename || undefined,
      contentType: m.contentType,
    });
  }

  logger.info('Property photos listed for share dialog', {
    propertyId, companyId: ctx.companyId, count: photos.length,
  });

  return apiSuccess<PropertyPhotosResponse>({ photos });
}

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PropertyPhotosResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleGet(request, ctx),
    { permissions: 'properties:properties:view' },
  ),
);
