/**
 * =============================================================================
 * GET /api/showcase/[token] (ADR-312)
 * =============================================================================
 *
 * Public endpoint — no authentication required. Resolves a showcase token into
 * a read-only snapshot of the property: core fields, company branding,
 * published photos, floorplans, optional video link, PDF link.
 *
 * Validation:
 *  - Share exists, is active, has showcaseMode=true
 *  - Share is not expired
 *
 * @module app/api/showcase/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES, type FileCategory } from '@/config/domain-constants';
import { listPropertyMedia } from '@/services/property-media/property-media.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('ShowcasePublicApi');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ShowcaseMedia {
  id: string;
  url: string;
  displayName?: string;
  previewUrl?: string;
  ext?: string;
}

interface ShowcasePublicResponse {
  property: {
    id: string;
    code?: string;
    name: string;
    type?: string;
    building?: string;
    floor?: number;
    description?: string;
    layout?: { bedrooms?: number; bathrooms?: number; wc?: number };
    areas?: { gross?: number; net?: number; balcony?: number; terrace?: number };
    orientations?: string[];
    energyClass?: string;
    condition?: string;
    features?: string[];
  };
  company: {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  photos: ShowcaseMedia[];
  floorplans: ShowcaseMedia[];
  videoUrl?: string;
  pdfUrl?: string;
  expiresAt: string;
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function loadShareByToken(token: string) {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;
  const snap = await adminDb
    .collection(COLLECTIONS.FILE_SHARES)
    .where('token', '==', token)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string };
}

async function loadFilesByCategory(
  companyId: string,
  propertyId: string,
  category: FileCategory
): Promise<ShowcaseMedia[]> {
  const metas = await listPropertyMedia({ companyId, propertyId, category, limit: 30 });
  const items: ShowcaseMedia[] = [];
  for (const m of metas) {
    if (!m.downloadUrl) continue;
    items.push({
      id: m.id,
      url: m.downloadUrl,
      displayName: m.displayName || m.originalFilename || undefined,
      previewUrl: m.thumbnailUrl || undefined,
      ext: m.ext || undefined,
    });
  }
  return items;
}

function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> }
) {
  const { token } = await segmentData.params;
  if (!token || token.trim().length === 0) {
    return jsonError(400, 'Token is required');
  }

  const adminDb = getAdminFirestore();
  if (!adminDb) return jsonError(503, 'Database connection not available');

  const share = await loadShareByToken(token);
  if (!share) return jsonError(404, 'Showcase link not found or deactivated');

  const showcaseMode = share.showcaseMode as boolean | undefined;
  const showcasePropertyId = share.showcasePropertyId as string | undefined;
  const companyId = share.companyId as string | undefined;
  const expiresAt = share.expiresAt as string | undefined;

  if (!showcaseMode || !showcasePropertyId || !companyId || !expiresAt) {
    return jsonError(400, 'Share is not a property showcase');
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    return jsonError(410, 'Showcase link has expired');
  }

  const propertySnap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(showcasePropertyId).get();
  if (!propertySnap.exists) return jsonError(404, 'Property not found');
  const p = propertySnap.data() ?? {};
  if ((p as { companyId?: string }).companyId !== companyId) {
    return jsonError(403, 'Tenant mismatch');
  }

  const companySnap = await adminDb.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  const c = companySnap.exists ? companySnap.data() ?? {} : {};

  const [photos, floorplans] = await Promise.all([
    loadFilesByCategory(companyId, showcasePropertyId, FILE_CATEGORIES.PHOTOS),
    loadFilesByCategory(companyId, showcasePropertyId, FILE_CATEGORIES.FLOORPLANS),
  ]);

  const layout = (p as { layout?: Record<string, unknown> }).layout || {};
  const areas = (p as { areas?: Record<string, unknown> }).areas || {};
  const energy = (p as { energy?: Record<string, unknown> }).energy || {};

  const response: ShowcasePublicResponse = {
    property: {
      id: showcasePropertyId,
      code: (p as Record<string, unknown>).code as string | undefined,
      name: ((p as Record<string, unknown>).name as string) || showcasePropertyId,
      type: (p as Record<string, unknown>).type as string | undefined,
      building: (p as Record<string, unknown>).building as string | undefined,
      floor: typeof (p as Record<string, unknown>).floor === 'number' ? ((p as Record<string, unknown>).floor as number) : undefined,
      description: (p as Record<string, unknown>).description as string | undefined,
      layout: {
        bedrooms: layout.bedrooms as number | undefined,
        bathrooms: layout.bathrooms as number | undefined,
        wc: layout.wc as number | undefined,
      },
      areas: {
        gross: areas.gross as number | undefined,
        net: areas.net as number | undefined,
        balcony: areas.balcony as number | undefined,
        terrace: areas.terrace as number | undefined,
      },
      orientations: Array.isArray((p as Record<string, unknown>).orientations)
        ? ((p as Record<string, unknown>).orientations as string[])
        : undefined,
      energyClass: energy.class as string | undefined,
      condition: (p as Record<string, unknown>).condition as string | undefined,
      features: Array.isArray((p as Record<string, unknown>).features)
        ? ((p as Record<string, unknown>).features as string[])
        : undefined,
    },
    company: {
      name: ((c as Record<string, unknown>).name as string) || 'Nestor',
      phone: (c as Record<string, unknown>).phone as string | undefined,
      email: (c as Record<string, unknown>).email as string | undefined,
      website: (c as Record<string, unknown>).website as string | undefined,
    },
    photos,
    floorplans,
    videoUrl: (share.note as string | undefined) || undefined,
    pdfUrl: share.pdfStoragePath ? `${buildBaseUrl(request)}/api/showcase/${token}/pdf` : undefined,
    expiresAt,
  };

  logger.info('Showcase resolved', {
    token, propertyId: showcasePropertyId, companyId,
    photoCount: photos.length, floorplanCount: floorplans.length,
  });

  return NextResponse.json(response);
}
