/**
 * Server-only helpers for the Property Showcase generator (ADR-312).
 *
 * Extracted from `route.ts` so the route file stays within the Google-style
 * API size budget (CLAUDE.md N.7.1, 300 LOC for API routes). Every helper
 * here runs under an authenticated route with Admin SDK; no direct client
 * exposure.
 */

import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { generateOpaqueToken } from '@/services/enterprise-id.service';
import type {
  PropertyShowcasePDFData,
  PropertyShowcasePDFLabels,
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
      mediaSection: 'Media & Online Showcase',
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
      fieldPhotos: 'Photos',
      fieldFloorplans: 'Floorplans',
      fieldVideo: 'Video',
      fieldShowcaseUrl: 'Online showcase',
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
    mediaSection: 'Πολυμέσα & Διαδικτυακή Παρουσίαση',
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
    fieldPhotos: 'Φωτογραφίες',
    fieldFloorplans: 'Κατόψεις',
    fieldVideo: 'Βίντεο',
    fieldShowcaseUrl: 'Διαδικτυακή παρουσίαση',
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

  const companyDoc = await adminDb.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  const company = companyDoc.exists ? companyDoc.data() ?? {} : {};

  const photoCount = await safeCount(() =>
    adminDb
      .collection(COLLECTIONS.PROPERTIES)
      .doc(propertyId)
      .collection(SUBCOLLECTIONS.PROPERTY_PHOTOS)
      .count()
      .get()
  );
  const floorplanCount = await safeCount(() =>
    adminDb
      .collection(COLLECTIONS.UNIT_FLOORPLANS)
      .where('companyId', '==', companyId)
      .where('propertyId', '==', propertyId)
      .count()
      .get()
  );

  return { property, company, photoCount, floorplanCount };
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

export function buildPdfData(
  propertyId: string,
  sources: ShowcaseSources,
  showcaseUrl: string,
  videoUrl: string | undefined,
  locale: 'el' | 'en'
): PropertyShowcasePDFData {
  const p = sources.property as Record<string, unknown>;
  const c = sources.company as Record<string, unknown>;
  const layout = (p.layout as { bedrooms?: number; bathrooms?: number; wc?: number }) || {};
  const areas = (p.areas as { gross?: number; net?: number; balcony?: number; terrace?: number }) || {};
  const energy = (p.energy as { class?: string }) || {};

  return {
    property: {
      id: propertyId,
      code: (p.code as string) || undefined,
      name: (p.name as string) || propertyId,
      type: (p.type as string) || undefined,
      typeLabel: (p.typeLabel as string) || (p.type as string) || undefined,
      building: (p.building as string) || undefined,
      floor: typeof p.floor === 'number' ? (p.floor as number) : undefined,
      description: (p.description as string) || undefined,
      layout: { bedrooms: layout.bedrooms, bathrooms: layout.bathrooms, wc: layout.wc },
      areas: { gross: areas.gross, net: areas.net, balcony: areas.balcony, terrace: areas.terrace },
      orientations: Array.isArray(p.orientations) ? (p.orientations as string[]) : undefined,
      energyClass: energy.class,
      condition: (p.condition as string) || undefined,
      features: Array.isArray(p.features) ? (p.features as string[]) : undefined,
    },
    company: {
      name: (c.name as string) || 'Nestor',
      phone: (c.phone as string) || undefined,
      email: (c.email as string) || undefined,
      website: (c.website as string) || undefined,
    },
    showcaseUrl,
    videoUrl,
    photoCount: sources.photoCount,
    floorplanCount: sources.floorplanCount,
    generatedAt: new Date(),
    labels: buildShowcaseLabels(locale),
  };
}

export interface UploadedPdfRef {
  /** Public download URL (Firebase download-token pattern, permanent until file/token is revoked). */
  url: string;
  /** Download token stored in object metadata; persists on the share record for URL reconstruction. */
  downloadToken: string;
}

export async function uploadPdfToStorage(
  pdfBytes: Uint8Array,
  storagePath: string
): Promise<UploadedPdfRef> {
  const bucket = getAdminStorage().bucket();
  const fileRef = bucket.file(storagePath);

  if (pdfBytes.byteLength === 0) {
    throw new Error('PDF buffer is empty — generator produced 0 bytes');
  }

  const downloadToken = generateOpaqueToken();

  logger.info('Uploading showcase PDF', {
    bucket: bucket.name, storagePath, sizeBytes: pdfBytes.byteLength,
  });

  await fileRef.save(Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength), {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'private, max-age=3600' },
    resumable: false,
  });

  // Write the Firebase download-token in a separate setMetadata() call.
  await fileRef.setMetadata({
    metadata: { firebaseStorageDownloadTokens: downloadToken },
  });

  const [exists] = await fileRef.exists();
  if (!exists) {
    throw new Error(`Upload reported success but object is missing: ${bucket.name}/${storagePath}`);
  }

  // Diagnostic: read back metadata to confirm custom field persisted.
  const [metadataSnap] = await fileRef.getMetadata();
  logger.info('Post-setMetadata diagnostic', {
    customMetadata: metadataSnap.metadata ?? null,
    tokenInMetadata: metadataSnap.metadata?.firebaseStorageDownloadTokens ?? null,
    expectedToken: downloadToken,
    match: metadataSnap.metadata?.firebaseStorageDownloadTokens === downloadToken,
  });

  // Firebase download-token URL: works against the `.firebasestorage.app`
  // bucket domain where GCS XML API signed URLs (storage.googleapis.com/...)
  // fail with NoSuchKey because XML API does not resolve the alias host.
  // See ADR-312 2026-04-18 changelog.
  const url = buildDownloadTokenUrl(bucket.name, storagePath, downloadToken);
  return { url, downloadToken };
}

export function buildDownloadTokenUrl(
  bucketName: string,
  storagePath: string,
  downloadToken: string
): string {
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
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
