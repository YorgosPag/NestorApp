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

import { getAdminBucket } from '@/lib/firebaseAdmin';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { loadBrandLogoAssets } from '@/services/property-showcase/brand-logo-assets';
import { countPropertyMedia } from '@/services/property-media/property-media.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import {
  buildPropertyShowcaseSnapshot,
  loadShowcaseRelations,
  type PropertyShowcaseContext,
} from '@/services/property-showcase/snapshot-builder';
import { loadShowcasePdfLabels } from '@/services/property-showcase/labels';
import { createPropertyShowcasePdfService } from '@/services/pdf/PropertyShowcasePDFService';
// Τα *bytes* του εγγράφου ζουν δίπλα (N.7.1 — αυτό το αρχείο πέρασε τις 500
// γραμμές). Εδώ μένει ο **κύκλος ζωής**: πηγές, εγγραφή share, ανέβασμα.
import {
  loadShowcaseFloorplans,
  loadShowcaseLinkedSpaceFloorplans,
  loadShowcasePhotos,
  loadShowcasePropertyFloorFloorplans,
} from './showcase-pdf-assets';
import type {
  PropertyFloorFloorplansPdfData,
  PropertyShowcasePDFData,
  ShowcasePhotoAsset,
} from '@/services/pdf/renderers/PropertyShowcaseRenderer';
import type { LinkedSpaceFloorplansPdfData } from '@/services/pdf/renderers/PropertyShowcaseSections';

const logger = createModuleLogger('PropertyShowcaseHelpers');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΔΥΟ «ΔΕΝ ΒΡΕΘΗΚΕ» ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ (ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Δύο ανεξάρτητα σημεία εδώ έλεγαν `404` για την **απουσία** και `403 'Access
 * denied'` για την **ξένη ιδιοκτησία** — δηλαδή επιβεβαίωναν στον καλούντα ότι
 * το id υπάρχει και ανήκει αλλού (§3.3). Και τα δύο ήταν **αόρατα** στον
 * ανιχνευτή του anchor: το ένα συγκρίνει με **γυμνή παράμετρο** (`!== companyId`),
 * το άλλο με **αντικείμενο παραμέτρων** (`!== params.companyId`) — καμία από τις
 * δύο μορφές δεν ήταν `ctx.companyId` (μάθημα #1).
 *
 * Και τα δύο έγραφαν επίσης σκέτο `!==` πάνω σε `as { companyId?: string }`:
 * **ο τύπος υπόσχεται, η βάση δεν εγγυάται** (§4, μάθημα #8).
 *
 * ⚠️ **Εδώ ΔΕΝ προστίθεται κλάδος bypass**, σε αντίθεση με τους υπόλοιπους
 * πόρους της Ομάδας 6 — και αυτό είναι **επιλογή, όχι παράλειψη**: οι τρεις
 * καλούντες περνούν `ctx.companyId`, δηλαδή έναν **tenant**, όχι έναν καλούντα.
 * Ένας ρόλος που δεν υπάρχει στην υπογραφή δεν μπορεί να κριθεί, και το να
 * «κατασκευαστεί» καλών εδώ θα ήταν χειρότερο από την απουσία του: θα έμοιαζε
 * με απόφαση ενώ θα ήταν μαντεψιά.
 */
const PROPERTY_NOT_FOUND_MESSAGE = 'Property not found';
const SHARE_NOT_FOUND_MESSAGE = 'Share not found';

/** Το **ένα** «δεν βρέθηκε» του ακινήτου — και οι δύο κλάδοι, μηδέν ορίσματα (§7.1). */
const propertyNotFound = (): ApiError => new ApiError(404, PROPERTY_NOT_FOUND_MESSAGE);

/** Το **ένα** «δεν βρέθηκε» του share — και οι δύο κλάδοι, μηδέν ορίσματα (§7.1). */
const shareNotFound = (): ApiError => new ApiError(404, SHARE_NOT_FOUND_MESSAGE);

export interface ShowcaseSources {
  context: PropertyShowcaseContext;
  photoCount: number;
  floorplanCount: number;
}

export async function loadShowcaseSources(
  propertyId: string,
  companyId: string,
): Promise<ShowcaseSources> {
  const adminDb = requireAdminFirestore();

  const propertyDoc = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  if (!propertyDoc.exists) throw propertyNotFound();
  const property = (propertyDoc.data() ?? {}) as Record<string, unknown>;
  if (!isPayloadOwnedByCompany(property, companyId)) throw propertyNotFound();

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
  const adminDb = requireAdminFirestore();
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
  const adminDb = requireAdminFirestore();

  const shareRef = adminDb.collection(COLLECTIONS.FILE_SHARES).doc(params.shareId);
  const shareSnap = await shareRef.get();
  if (!shareSnap.exists) throw shareNotFound();
  const share = shareSnap.data() ?? {};

  if (!isPayloadOwnedByCompany(share, params.companyId)) throw shareNotFound();
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
  const adminDb = requireAdminFirestore();
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
