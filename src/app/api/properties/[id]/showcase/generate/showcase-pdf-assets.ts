/**
 * Binary assets for the Property Showcase PDF — the *bytes*, not the record.
 *
 * Extracted from `./helpers.ts` (CLAUDE.md N.7.1 — that file crossed the 500
 * LOC budget). The cut follows the responsibility, not the line count:
 * `helpers.ts` keeps the **lifecycle** (Firestore reads of the showcase
 * sources, share-record creation/regeneration/deactivation, Storage upload),
 * while everything here answers a single question — *which image buffers go
 * into the document?*
 *
 * Every loader in this module is **non-throwing by contract**: a missing or
 * unreadable asset degrades the PDF (text-only page, omitted plan) instead of
 * failing the request. That is why they are separable at all — they have no
 * say in whether the generation succeeds, so no caller has to unwind them.
 *
 * Ownership is **not** re-checked here: the caller has already resolved the
 * property/share against its tenant (`helpers.ts`, ADR-742 §7undecies) and the
 * ids handed down are consequences of that decision, never raw client input.
 *
 * @module api/properties/showcase/generate/showcase-pdf-assets
 * @enterprise ADR-312 — Property Showcase (Phase 4 · Phase 7.5)
 */

import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import {
  downloadPropertyMedia,
  downloadEntityMedia,
  type PropertyMediaBuffer,
} from '@/services/property-media/property-media.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  pickFloorLabel,
  resolveFloorId,
  type PropertyShowcaseContext,
} from '@/services/property-showcase/snapshot-builder';
import type {
  PropertyFloorFloorplansPdfData,
  ShowcasePhotoAsset,
} from '@/services/pdf/renderers/PropertyShowcaseRenderer';
import type {
  LinkedSpaceFloorplansGroup,
  LinkedSpaceFloorplansPdfData,
} from '@/services/pdf/renderers/PropertyShowcaseSections';

const logger = createModuleLogger('PropertyShowcasePdfAssets');

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
