/**
 * =============================================================================
 * GET /api/building-showcase/[token] (ADR-320)
 * =============================================================================
 *
 * Public endpoint — no authentication required. Resolves a building showcase
 * token into a `BuildingShowcasePayload`: building info, company branding,
 * published photos, floorplans, PDF download link.
 *
 * Token lookup: unified `shares` collection only — building showcases are
 * always created via UnifiedSharingService (ADR-315).
 *
 * @module app/api/building-showcase/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import { listEntityMedia } from '@/services/property-media/property-media.service';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { BuildingShowcasePayload, BuildingShowcaseMedia } from '@/types/building-showcase';

const logger = createModuleLogger('BuildingShowcasePublicApi');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase?.trim()) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

async function resolveBuildingShowcaseShare(token: string): Promise<{
  entityId: string;
  companyId: string;
  expiresAt: string;
  pdfStoragePath?: string;
} | null> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;

  const snap = await adminDb
    .collection(COLLECTIONS.SHARES)
    .where('token', '==', token)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const d = doc.data() as Record<string, unknown>;

  if (d.entityType !== 'building_showcase') return null;

  const entityId = d.entityId as string | undefined;
  const companyId = d.companyId as string | undefined;
  const expiresAt = d.expiresAt as string | undefined;
  if (!entityId || !companyId || !expiresAt) return null;

  const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };

  return { entityId, companyId, expiresAt, pdfStoragePath: showcaseMeta.pdfStoragePath };
}

async function loadBuildingMedia(
  companyId: string,
  buildingId: string,
  category: typeof FILE_CATEGORIES.PHOTOS | typeof FILE_CATEGORIES.FLOORPLANS,
): Promise<BuildingShowcaseMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    category,
    limit: 30,
  });
  return metas
    .filter((m) => m.downloadUrl)
    .map<BuildingShowcaseMedia>((m) => ({
      id: m.id,
      url: m.downloadUrl!,
      displayName: m.displayName || m.originalFilename || undefined,
      contentType: m.contentType || undefined,
    }));
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> },
) {
  const { token } = await segmentData.params;
  if (!token || token.trim().length === 0) return jsonError(400, 'Token is required');

  const adminDb = getAdminFirestore();
  if (!adminDb) return jsonError(503, 'Database connection not available');

  const share = await resolveBuildingShowcaseShare(token);
  if (!share) return jsonError(404, 'Building showcase link not found or deactivated');

  if (new Date(share.expiresAt).getTime() < Date.now()) {
    return jsonError(410, 'Building showcase link has expired');
  }

  const localeParam = request.nextUrl.searchParams.get('locale');
  const locale: EnumLocale = localeParam === 'en' ? 'en' : 'el';

  let snapshot;
  try {
    snapshot = await buildBuildingShowcaseSnapshot(share.entityId, locale, adminDb, share.companyId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Snapshot build failed', { token, buildingId: share.entityId, error: msg });
    if (msg.includes('not found')) return jsonError(404, 'Building not found');
    if (msg.includes('Tenant')) return jsonError(403, 'Access denied');
    return jsonError(500, 'Failed to load building data');
  }

  const [photos, floorplans] = await Promise.all([
    loadBuildingMedia(share.companyId, share.entityId, FILE_CATEGORIES.PHOTOS).catch(() => []),
    loadBuildingMedia(share.companyId, share.entityId, FILE_CATEGORIES.FLOORPLANS).catch(() => []),
  ]);

  const baseUrl = buildBaseUrl(request);
  const pdfUrl = share.pdfStoragePath
    ? `${baseUrl}/api/building-showcase/${token}/pdf`
    : undefined;

  const payload: BuildingShowcasePayload = {
    building: snapshot.building,
    company: snapshot.company,
    photos,
    floorplans,
    pdfUrl,
    expiresAt: share.expiresAt,
  };

  logger.info('Building showcase resolved', {
    token, buildingId: share.entityId, companyId: share.companyId,
    photoCount: photos.length, floorplanCount: floorplans.length,
  });

  return NextResponse.json(payload);
}
