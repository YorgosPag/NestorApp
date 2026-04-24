/**
 * Server-only helpers for the Property Showcase generator (ADR-312 Phase 4).
 *
 * Extracted from `route.ts` so the route file stays within the Google-style
 * API size budget (CLAUDE.md N.7.1, 300 LOC for API routes). Every helper
 * here runs under an authenticated route with Admin SDK; no direct client
 * exposure.
 *
 * Phase 4 refactor: every bit of field mapping and label generation is
 * delegated to the SSoT modules `property-showcase/snapshot-builder` and
 * `property-showcase/labels`. This file now only orchestrates I/O (Firestore
 * reads, Storage uploads, share-record lifecycle) — no business logic.
 */

import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { loadBrandLogoAssets } from '@/services/property-showcase/brand-logo-assets';
import {
  countPropertyMedia,
  downloadPropertyMedia,
  downloadEntityMedia,
  type PropertyMediaBuffer,
} from '@/services/property-media/property-media.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildPropertyShowcaseSnapshot,
  loadShowcaseRelations,
  pickFloorLabel,
  resolveFloorId,
  type PropertyShowcaseContext,
} from '@/services/property-showcase/snapshot-builder';
import { loadShowcasePdfLabels } from '@/services/property-showcase/labels';
import { createPropertyShowcasePdfService } from '@/services/pdf/PropertyShowcasePDFService';
import type {
  PropertyFloorFloorplansPdfData,
  PropertyShowcasePDFData,
  ShowcasePhotoAsset,
} from '@/services/pdf/renderers/PropertyShowcaseRenderer';
import type {
  LinkedSpaceFloorplansGroup,
  LinkedSpaceFloorplansPdfData,
} from '@/services/pdf/renderers/PropertyShowcaseSections';

const logger = createModuleLogger('PropertyShowcaseHelpers');

export interface ShowcaseSources {
  context: PropertyShowcaseContext;
  photoCount: number;
  floorplanCount: number;
}

export async function loadShowcaseSources(
  propertyId: string,
  companyId: string,
): Promise<ShowcaseSources> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');

  const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!propertyDoc.exists) throw new ApiError(404, 'Property not found');
  const property = (propertyDoc.data() ?? {}) as Record<string, unknown>;
  if ((property as { companyId?: string }).companyId !== companyId) {
    throw new ApiError(403, 'Access denied');
  }

  const branding = await resolveShowcaseCompanyBranding({
    adminDb,
    propertyData: property,
    companyId,
  });

  // Canonical source of photos = `files` coll (ADR-031). Subcoll
  // `properties/{id}/photos` was never populated — the previous count
  // always returned 0. `PropertyMediaService` reads the SSoT used by the
  // public showcase surface so PDF counts match what the browser sees.
  const [context, photoCount, floorplanCountFromFiles, floorplanCountLegacy] = await Promise.all([
    loadShowcaseRelations({ adminDb, propertyId, property, branding }),
    countPropertyMedia({
      companyId, propertyId, category: FILE_CATEGORIES.PHOTOS, limit: 100,
    }).catch((err) => {
      logger.warn('Showcase photo count failed; defaulting to 0', {
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }),
    countPropertyMedia({
      companyId, propertyId, category: FILE_CATEGORIES.FLOORPLANS, limit: 100,
    }).catch(() => 0),
    safeCount(() =>
      adminDb
        .collection(COLLECTIONS.UNIT_FLOORPLANS)
        .where('companyId', '==', companyId)
        .where('propertyId', '==', propertyId)
        .count()
        .get(),
    ),
  ]);

  const floorplanCount = floorplanCountFromFiles + floorplanCountLegacy;
  return { context, photoCount, floorplanCount };
}

async function safeCount(
  run: () => Promise<{ data: () => { count?: number } }>,
): Promise<number> {
  try {
    const snap = await run();
    return snap.data().count ?? 0;
  } catch (err) {
    logger.warn('Showcase count query failed; defaulting to 0', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Fetch up to `limit` property photos as embeddable PDF assets. Never
 * throws — a failure degrades gracefully to a text-only PDF.
 */
export async function loadShowcasePhotos(
  propertyId: string,
  companyId: string,
  limit = 6,
): Promise<ShowcasePhotoAsset[]> {
  try {
    const buffers = await downloadPropertyMedia({
      companyId, propertyId, category: FILE_CATEGORIES.PHOTOS, limit,
    });
    const assets = buffers.map(toShowcasePhotoAsset);
    logger.info('Showcase photos ready for PDF embedding', {
      propertyId,
      count: assets.length,
      totalBytes: assets.reduce((sum, a) => sum + a.bytes.byteLength, 0),
      formats: assets.map((a) => a.format),
    });
    return assets;
  } catch (err) {
    logger.warn('Showcase photo embedding failed; PDF will render text-only', {
      propertyId, error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Fetch up to `limit` property floorplans (DXF raster thumbnails or native
 * JPEG/PNG) as embeddable PDF assets.
 */
export async function loadShowcaseFloorplans(
  propertyId: string,
  companyId: string,
  limit = 4,
): Promise<ShowcasePhotoAsset[]> {
  try {
    const buffers = await downloadPropertyMedia({
      companyId, propertyId, category: FILE_CATEGORIES.FLOORPLANS, limit,
    });
    const assets = buffers.map(toShowcasePhotoAsset);
    logger.info('Showcase floorplans ready for PDF embedding', {
      propertyId,
      count: assets.length,
      totalBytes: assets.reduce((sum, a) => sum + a.bytes.byteLength, 0),
      formats: assets.map((a) => a.format),
      fromThumbnailCount: buffers.filter((b) => b.fromThumbnail).length,
    });
    return assets;
  } catch (err) {
    logger.warn('Showcase floorplan embedding failed; PDF will omit the plan page', {
      propertyId, error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

function toShowcasePhotoAsset(m: PropertyMediaBuffer): ShowcasePhotoAsset {
  return {
    id: m.id,
    bytes: m.bytes,
    format: m.jsPdfFormat,
    displayName: m.displayName,
  };
}

function pickAllocationCode(doc: Record<string, unknown>): string | undefined {
  const candidates = [doc.name, doc.number, doc.code, doc.allocationCode];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

/**
 * SSoT — download buffers for an entity's floorplan category. Thin wrapper
 * used by both property-floor and linked-space helpers below so every PDF
 * consumer goes through one codepath (raster fallback included).
 */
async function downloadFloorplanBuffers(
  companyId: string,
  entityType: string,
  entityId: string,
  limit: number,
): Promise<ShowcasePhotoAsset[]> {
  const buffers = await downloadEntityMedia({
    companyId, entityType, entityId, category: FILE_CATEGORIES.FLOORPLANS, limit,
  });
  return buffers.map(toShowcasePhotoAsset);
}

/**
 * Load buffers for the property's own κάτοψη ορόφου (Phase 7.5). The floor
 * is resolved via the SSoT `resolveFloorId()` using the preloaded
 * `context.floors` map — same rule used by the web showcase route.
 */
export async function loadShowcasePropertyFloorFloorplans(
  context: PropertyShowcaseContext,
  companyId: string,
  limit = 2,
): Promise<PropertyFloorFloorplansPdfData | undefined> {
  const floorId = resolveFloorId(context.property, context.floors);
  if (!floorId) return undefined;
  try {
    const assets = await downloadFloorplanBuffers(companyId, ENTITY_TYPES.FLOOR, floorId, limit);
    if (assets.length === 0) return undefined;
    return { label: pickFloorLabel(context.floors.get(floorId)), assets };
  } catch (err) {
    logger.warn('Property floor floorplan buffer load failed; omitting page', {
      floorId, error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Download rasterised Κατόψεις (PNG thumbnails from DXFs) for every parking
 * spot and storage unit linked to the property. One Firestore + Storage read
 * per linked space; failures on a single space never fail the whole load.
 *
 * Phase 7.5 — also downloads each space's floor plan (κάτοψη ορόφου) via
 * `resolveFloorId()` so the PDF can stack space-κάτοψη + floor-κάτοψη.
 */
export async function loadShowcaseLinkedSpaceFloorplans(
  context: PropertyShowcaseContext,
  companyId: string,
  perSpaceLimit = 1,
): Promise<LinkedSpaceFloorplansPdfData> {
  const parkingTasks = Array.from(context.parkingSpots.entries()).map((entry) =>
    loadLinkedSpaceGroupForPdf(context, companyId, entry, ENTITY_TYPES.PARKING_SPOT, perSpaceLimit, 'Parking floorplan buffer load failed; skipping space'),
  );
  const storageTasks = Array.from(context.storages.entries()).map((entry) =>
    loadLinkedSpaceGroupForPdf(context, companyId, entry, ENTITY_TYPES.STORAGE, perSpaceLimit, 'Storage floorplan buffer load failed; skipping space'),
  );

  const [parkingResolved, storageResolved] = await Promise.all([
    Promise.all(parkingTasks),
    Promise.all(storageTasks),
  ]);

  const parking = parkingResolved.filter((g): g is LinkedSpaceFloorplansGroup => g !== null);
  const storage = storageResolved.filter((g): g is LinkedSpaceFloorplansGroup => g !== null);

  logger.info('Linked-space floorplans ready for PDF embedding', {
    parkingGroupCount: parking.length,
    storageGroupCount: storage.length,
  });

  return { parking, storage };
}

async function loadLinkedSpaceGroupForPdf(
  context: PropertyShowcaseContext,
  companyId: string,
  [spaceId, doc]: [string, Record<string, unknown>],
  entityType: string,
  perSpaceLimit: number,
  failMessage: string,
): Promise<LinkedSpaceFloorplansGroup | null> {
  try {
    const assets = await downloadFloorplanBuffers(companyId, entityType, spaceId, perSpaceLimit);

    const floorId = resolveFloorId(doc, context.floors);
    const floorAssets = floorId
      ? await downloadFloorplanBuffers(companyId, ENTITY_TYPES.FLOOR, floorId, perSpaceLimit).catch(() => [])
      : [];
    const floorLabel = floorId ? pickFloorLabel(context.floors.get(floorId)) : undefined;

    if (assets.length === 0 && floorAssets.length === 0) return null;
    return {
      allocationCode: pickAllocationCode(doc),
      assets,
      floorAssets: floorAssets.length > 0 ? floorAssets : undefined,
      floorLabel,
    } satisfies LinkedSpaceFloorplansGroup;
  } catch (err) {
    logger.warn(failMessage, {
      spaceId, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface BuildPdfDataExtras {
  photos?: ShowcasePhotoAsset[];
  floorplans?: ShowcasePhotoAsset[];
  linkedSpaceFloorplans?: LinkedSpaceFloorplansPdfData;
  propertyFloorFloorplans?: PropertyFloorFloorplansPdfData;
  /** Company + Nestor App logos for header/footer branding (ADR-312 Phase 8). */
  companyLogo?: ShowcasePhotoAsset;
  nestorAppLogo?: ShowcasePhotoAsset;
}

export function buildPdfData(
  propertyId: string,
  sources: ShowcaseSources,
  showcaseUrl: string,
  videoUrl: string | undefined,
  locale: 'el' | 'en',
  extras: BuildPdfDataExtras = {},
): PropertyShowcasePDFData {
  void propertyId;
  const snapshot = buildPropertyShowcaseSnapshot(sources.context, locale);
  const { photos = [], floorplans = [], linkedSpaceFloorplans, propertyFloorFloorplans,
    companyLogo, nestorAppLogo } = extras;
  const hasLinked = !!linkedSpaceFloorplans &&
    (linkedSpaceFloorplans.parking.length > 0 || linkedSpaceFloorplans.storage.length > 0);
  const hasPropertyFloor = !!propertyFloorFloorplans && propertyFloorFloorplans.assets.length > 0;
  return {
    snapshot, showcaseUrl, videoUrl,
    photoCount: sources.photoCount, floorplanCount: sources.floorplanCount,
    photos, floorplans,
    propertyFloorFloorplans: hasPropertyFloor ? propertyFloorFloorplans : undefined,
    linkedSpaceFloorplans: hasLinked ? linkedSpaceFloorplans : undefined,
    companyLogo, nestorAppLogo,
    generatedAt: new Date(), labels: loadShowcasePdfLabels(locale), locale,
  };
}

export async function uploadPdfToStorage(
  pdfBytes: Uint8Array,
  storagePath: string,
): Promise<void> {
  const bucket = getAdminBucket();
  const fileRef = bucket.file(storagePath);

  if (pdfBytes.byteLength === 0) {
    throw new Error('PDF buffer is empty — generator produced 0 bytes');
  }

  logger.info('Uploading showcase PDF', {
    bucket: bucket.name, storagePath, sizeBytes: pdfBytes.byteLength,
  });

  await fileRef.save(Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength), {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'private, max-age=3600' },
    resumable: false,
  });

  const [exists] = await fileRef.exists();
  if (!exists) {
    throw new Error(`Upload reported success but object is missing: ${bucket.name}/${storagePath}`);
  }
}

/**
 * Compensation delete for a FILE_SHARES record created pre-upload.
 *
 * The showcase generator writes the ownership claim BEFORE the actual
 * Storage upload (so the `onStorageFinalize` orphan-cleanup trigger finds
 * the claim and skips deletion — see ADR-312 §Race). If the upload then
 * fails, the claim becomes orphaned metadata — this helper removes it.
 * Idempotent: deleting a non-existent doc is a no-op in Admin SDK.
 */
export async function deleteShowcaseShareRecord(shareId: string): Promise<void> {
  const adminDb = getAdminFirestore();
  if (!adminDb) return;
  await adminDb.collection(COLLECTIONS.FILE_SHARES).doc(shareId).delete();
}

/**
 * Regenerate the PDF for an existing showcase share IN-PLACE (ADR-312 Phase 3.2).
 */
export async function regeneratePdfForShare(params: {
  shareId: string;
  propertyId: string;
  companyId: string;
  baseUrl: string;
  locale?: 'el' | 'en';
  videoUrl?: string;
}): Promise<{
  shareId: string;
  token: string;
  pdfStoragePath: string;
  regeneratedAt: Date;
}> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');

  const shareRef = adminDb.collection(COLLECTIONS.FILE_SHARES).doc(params.shareId);
  const shareSnap = await shareRef.get();
  if (!shareSnap.exists) throw new ApiError(404, 'Share not found');
  const share = shareSnap.data() ?? {};

  if ((share as { companyId?: string }).companyId !== params.companyId) {
    throw new ApiError(403, 'Access denied');
  }
  if ((share as { showcaseMode?: boolean }).showcaseMode !== true) {
    throw new ApiError(400, 'Share is not a Property Showcase');
  }
  if ((share as { showcasePropertyId?: string }).showcasePropertyId !== params.propertyId) {
    throw new ApiError(403, 'Share does not belong to this property');
  }
  if ((share as { isActive?: boolean }).isActive !== true) {
    throw new ApiError(400, 'Share is deactivated');
  }
  const pdfStoragePath = (share as { pdfStoragePath?: string }).pdfStoragePath;
  if (!pdfStoragePath || pdfStoragePath.trim().length === 0) {
    throw new ApiError(400, 'Legacy share without pdfStoragePath cannot be regenerated');
  }
  const token = (share as { token?: string }).token;
  if (!token || token.trim().length === 0) {
    throw new ApiError(500, 'Share record is missing token');
  }

  const locale = params.locale ?? 'el';
  const showcaseUrl = `${params.baseUrl.replace(/\/$/, '')}/showcase/${token}`;

  const sources = await loadShowcaseSources(params.propertyId, params.companyId);
  const [photos, floorplans, linkedSpaceFloorplans, propertyFloorFloorplans, logos] = await Promise.all([
    loadShowcasePhotos(params.propertyId, params.companyId),
    loadShowcaseFloorplans(params.propertyId, params.companyId),
    loadShowcaseLinkedSpaceFloorplans(sources.context, params.companyId).catch((err) => {
      logger.warn('Regenerate: linked-space floorplan load failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { parking: [], storage: [] } satisfies LinkedSpaceFloorplansPdfData;
    }),
    loadShowcasePropertyFloorFloorplans(sources.context, params.companyId).catch((err) => {
      logger.warn('Regenerate: property-floor floorplan load failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }),
    loadBrandLogoAssets(sources.context.branding),
  ]);

  const pdfData = buildPdfData(
    params.propertyId, sources, showcaseUrl, params.videoUrl, locale,
    { photos, floorplans, linkedSpaceFloorplans, propertyFloorFloorplans, ...logos },
  );

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await createPropertyShowcasePdfService().generate(pdfData);
  } catch (err) {
    logger.error('Regenerate: PDF generation failed', {
      shareId: params.shareId, propertyId: params.propertyId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw new ApiError(500, 'PDF generation failed');
  }

  await uploadPdfToStorage(pdfBytes, pdfStoragePath);

  const regeneratedAt = new Date();
  await shareRef.update({ pdfRegeneratedAt: regeneratedAt });

  logger.info('Showcase PDF regenerated in-place', {
    shareId: params.shareId, propertyId: params.propertyId,
    companyId: params.companyId, pdfStoragePath,
  });

  return { shareId: params.shareId, token, pdfStoragePath, regeneratedAt };
}

export async function deactivateShowcaseShares(
  propertyId: string,
  companyId: string,
): Promise<string[]> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');
  const snap = await adminDb
    .collection(COLLECTIONS.FILE_SHARES)
    .where('companyId', '==', companyId)
    .where('showcasePropertyId', '==', propertyId)
    .where('isActive', '==', true)
    .get();
  const ids: string[] = [];
  for (const docSnap of snap.docs) {
    await docSnap.ref.update({ isActive: false });
    ids.push(docSnap.id);
  }
  return ids;
}
