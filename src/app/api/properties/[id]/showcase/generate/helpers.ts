/**
 * Server-only helpers for the Property Showcase generator (ADR-312).
 *
 * Extracted from `route.ts` so the route file stays within the Google-style
 * API size budget (CLAUDE.md N.7.1, 300 LOC for API routes). Every helper
 * here runs under an authenticated route with Admin SDK; no direct client
 * exposure.
 */

import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import {
  countPropertyMedia,
  downloadPropertyMedia,
  type PropertyMediaBuffer,
} from '@/services/property-media/property-media.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  translatePropertyType,
  translateOrientations,
  translatePropertyCondition,
} from '@/services/property-enum-labels/property-enum-labels.service';
import {
  resolveShowcaseCompanyBranding,
  type ShowcaseCompanyBranding,
} from '@/services/company/company-branding-resolver';
import { PropertyShowcasePDFService } from '@/services/pdf/PropertyShowcasePDFService';
import type {
  PropertyShowcasePDFData,
  PropertyShowcasePDFLabels,
  ShowcasePhotoAsset,
} from '@/services/pdf/renderers/PropertyShowcaseRenderer';

const logger = createModuleLogger('PropertyShowcaseHelpers');

export function buildShowcaseLabels(locale: 'el' | 'en'): PropertyShowcasePDFLabels {
  if (locale === 'en') {
    return {
      headerTitle: 'Property Showcase',
      generatedOn: 'Generated on',
      specsSection: 'Specifications',
      featuresSection: 'Features',
      descriptionSection: 'Description',
      photosSection: 'Photos',
      floorplansSection: 'Floorplans',
      fieldType: 'Type',
      fieldBuilding: 'Building',
      fieldFloor: 'Floor',
      fieldCode: 'Code',
      fieldGrossArea: 'Gross area',
      fieldNetArea: 'Net area',
      fieldBalcony: 'Balcony',
      fieldTerrace: 'Terrace',
      fieldBedrooms: 'Bedrooms',
      fieldBathrooms: 'Bathrooms',
      fieldWc: 'WC',
      fieldOrientation: 'Orientation',
      fieldEnergyClass: 'Energy class',
      fieldCondition: 'Condition',
      areaUnit: 'sq.m.',
      footerNote: 'Property showcase',
    };
  }
  return {
    headerTitle: 'Παρουσίαση Ακινήτου',
    generatedOn: 'Δημιουργήθηκε',
    specsSection: 'Χαρακτηριστικά',
    featuresSection: 'Παροχές',
    descriptionSection: 'Περιγραφή',
    photosSection: 'Φωτογραφίες',
    floorplansSection: 'Κατόψεις',
    fieldType: 'Τύπος',
    fieldBuilding: 'Κτίριο',
    fieldFloor: 'Όροφος',
    fieldCode: 'Κωδικός',
    fieldGrossArea: 'Μικτή επιφάνεια',
    fieldNetArea: 'Καθαρή επιφάνεια',
    fieldBalcony: 'Μπαλκόνι',
    fieldTerrace: 'Βεράντα',
    fieldBedrooms: 'Υπνοδωμάτια',
    fieldBathrooms: 'Μπάνια',
    fieldWc: 'Τουαλέτες',
    fieldOrientation: 'Προσανατολισμός',
    fieldEnergyClass: 'Ενεργειακή κλάση',
    fieldCondition: 'Κατάσταση',
    areaUnit: 'τ.μ.',
    footerNote: 'Παρουσίαση ακινήτου',
  };
}

export async function loadShowcaseSources(propertyId: string, companyId: string) {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database connection not available');

  const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!propertyDoc.exists) throw new ApiError(404, 'Property not found');
  const property = propertyDoc.data() ?? {};
  if ((property as { companyId?: string }).companyId !== companyId) {
    throw new ApiError(403, 'Access denied');
  }

  // Branding via hierarchy Property → Project → Contact (ADR-312 Phase 3.7).
  const branding = await resolveShowcaseCompanyBranding({
    adminDb,
    propertyData: property as Record<string, unknown>,
    companyId,
  });

  // Canonical source of photos = `files` coll (ADR-031). Subcoll
  // `properties/{id}/photos` was never populated — the previous count
  // always returned 0. `PropertyMediaService` reads the SSoT used by the
  // public showcase surface so PDF counts match what the browser sees.
  const [photoCount, floorplanCountFromFiles, floorplanCountLegacy] = await Promise.all([
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
        .get()
    ),
  ]);

  const floorplanCount = floorplanCountFromFiles + floorplanCountLegacy;

  return { property, branding, photoCount, floorplanCount };
}

export type ShowcaseSources = Awaited<ReturnType<typeof loadShowcaseSources>>;

async function safeCount(
  run: () => Promise<{ data: () => { count?: number } }>
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
 * Fetch up to `limit` property photos as embeddable PDF assets.
 *
 * Delegates filtering (mime allowlist, active-only) + Storage download to
 * `PropertyMediaService` so the PDF generator uses the same SSoT as the
 * public showcase surface. Never throws — a failure here degrades gracefully
 * to a text-only PDF (ADR-312 Phase 1 behaviour).
 */
export async function loadShowcasePhotos(
  propertyId: string,
  companyId: string,
  limit = 6
): Promise<ShowcasePhotoAsset[]> {
  try {
    const buffers = await downloadPropertyMedia({
      companyId,
      propertyId,
      category: FILE_CATEGORIES.PHOTOS,
      limit,
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
      propertyId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Fetch up to `limit` property floorplans (DXF raster thumbnails or native
 * JPEG/PNG) as embeddable PDF assets. DXFs deliver a PNG sourced from
 * `thumbnailStoragePath`, generated by `onDxfProcessedFinalize` (ADR-312
 * Phase 3). Graceful degradation to [] on any failure.
 */
export async function loadShowcaseFloorplans(
  propertyId: string,
  companyId: string,
  limit = 4
): Promise<ShowcasePhotoAsset[]> {
  try {
    const buffers = await downloadPropertyMedia({
      companyId,
      propertyId,
      category: FILE_CATEGORIES.FLOORPLANS,
      limit,
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
      propertyId,
      error: err instanceof Error ? err.message : String(err),
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

export function buildPdfData(
  propertyId: string,
  sources: ShowcaseSources,
  showcaseUrl: string,
  videoUrl: string | undefined,
  locale: 'el' | 'en',
  photos: ShowcasePhotoAsset[] = [],
  floorplans: ShowcasePhotoAsset[] = []
): PropertyShowcasePDFData {
  const p = sources.property as Record<string, unknown>;
  const branding: ShowcaseCompanyBranding = sources.branding;
  const layout = (p.layout as { bedrooms?: number; bathrooms?: number; wc?: number }) || {};
  const areas = (p.areas as { gross?: number; net?: number; balcony?: number; terrace?: number }) || {};
  const energy = (p.energy as { class?: string }) || {};

  // Enum keys stored in Firestore (`apartment`, `north`, `new`, ...) are
  // translated here via the server-side SSoT so the PDF renderer receives
  // human-readable labels identical to what the showcase web page shows.
  const rawType = (p.type as string) || undefined;
  const rawOrientations = Array.isArray(p.orientations) ? (p.orientations as string[]) : undefined;
  const rawCondition = (p.condition as string) || undefined;

  return {
    property: {
      id: propertyId,
      code: (p.code as string) || undefined,
      name: (p.name as string) || propertyId,
      type: rawType,
      typeLabel: (p.typeLabel as string) || translatePropertyType(rawType, locale) || rawType,
      building: (p.building as string) || undefined,
      floor: typeof p.floor === 'number' ? (p.floor as number) : undefined,
      description: (p.description as string) || undefined,
      layout: { bedrooms: layout.bedrooms, bathrooms: layout.bathrooms, wc: layout.wc },
      areas: { gross: areas.gross, net: areas.net, balcony: areas.balcony, terrace: areas.terrace },
      orientations: translateOrientations(rawOrientations, locale) ?? rawOrientations,
      energyClass: energy.class,
      condition: translatePropertyCondition(rawCondition, locale) ?? rawCondition,
      features: Array.isArray(p.features) ? (p.features as string[]) : undefined,
    },
    company: {
      name: branding.name,
      phone: branding.phone,
      email: branding.email,
      website: branding.website,
    },
    showcaseUrl,
    videoUrl,
    photoCount: sources.photoCount,
    floorplanCount: sources.floorplanCount,
    photos,
    floorplans,
    generatedAt: new Date(),
    labels: buildShowcaseLabels(locale),
  };
}

export async function uploadPdfToStorage(
  pdfBytes: Uint8Array,
  storagePath: string
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
 *
 * Preserves `token`, `shareId`, and `pdfStoragePath` so any previously
 * distributed public URL keeps working. Only the PDF blob at Storage is
 * overwritten and `pdfRegeneratedAt` is stamped on the FILE_SHARES doc.
 *
 * Ownership is enforced BEFORE any work: share must belong to `companyId`,
 * reference `propertyId`, be `showcaseMode=true`, `isActive=true`, and have
 * a `pdfStoragePath` (legacy shares without one cannot be regenerated here).
 *
 * Safety: the orphan-cleanup trigger (`onStorageFinalize`) re-fires on
 * overwrite but `findFileOwner()` resolves the existing FILE_SHARES claim
 * by shareId — no deletion occurs. No pre-upload write needed.
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

  const [sources, photos, floorplans] = await Promise.all([
    loadShowcaseSources(params.propertyId, params.companyId),
    loadShowcasePhotos(params.propertyId, params.companyId),
    loadShowcaseFloorplans(params.propertyId, params.companyId),
  ]);

  const pdfData = buildPdfData(
    params.propertyId, sources, showcaseUrl, params.videoUrl, locale, photos, floorplans
  );

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await new PropertyShowcasePDFService().generate(pdfData);
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
  companyId: string
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
