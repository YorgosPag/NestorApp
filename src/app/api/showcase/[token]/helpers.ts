/**
 * =============================================================================
 * GET /api/showcase/[token] — helpers (ADR-312 Phase 4)
 * =============================================================================
 *
 * SRP split from route.ts: media mapping, DXF self-heal, linked
 * space floorplan aggregation, base-URL resolution. Route owns the handler
 * flow; helpers own the pure I/O + mapping primitives.
 *
 * @module app/api/showcase/[token]/helpers
 */

import { ENTITY_TYPES, FILE_CATEGORIES, type FileCategory } from '@/config/domain-constants';
import {
  listEntityMedia,
  listPropertyMedia,
  type PropertyMediaItem,
} from '@/services/property-media/property-media.service';
import { ensureDxfThumbnail } from '@/services/floorplans/dxf-thumbnail-selfheal';
import {
  pickFloorLabel,
  resolveFloorId,
  type PropertyShowcaseContext,
} from '@/services/property-showcase/snapshot-builder';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type {
  ShowcaseMedia,
  ShowcaseLinkedSpaceFloorplans,
  ShowcaseLinkedSpaceFloorplanGroup,
  ShowcasePropertyFloorFloorplans,
} from '@/components/property-showcase/types';

const logger = createModuleLogger('ShowcasePublicApiHelpers');

export function toShowcaseMedia(metas: PropertyMediaItem[]): ShowcaseMedia[] {
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

/**
 * ADR-312 Phase 7.3 — any DXF discovered without a `thumbnailUrl` triggers the
 * SSoT pipeline (`.processed.json` generation + PNG raster) in the background.
 */
export function scheduleDxfSelfheal(metas: PropertyMediaItem[]): void {
  for (const m of metas) {
    if (m.ext === 'dxf' && !m.thumbnailUrl) {
      ensureDxfThumbnail(m.id).catch((err) => {
        logger.warn('DXF self-heal failed', {
          fileId: m.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }
}

export async function loadFilesByCategory(
  companyId: string,
  propertyId: string,
  category: FileCategory,
): Promise<ShowcaseMedia[]> {
  const metas = await listPropertyMedia({ companyId, propertyId, category, limit: 30 });
  scheduleDxfSelfheal(metas);
  return toShowcaseMedia(metas);
}

/**
 * SSoT — load κάτοψη ορόφου metadata by floorId. Thin wrapper over
 * `listEntityMedia(entityType=FLOOR, ...)` so every consumer (property card,
 * linked-space groups, PDF path) goes through the same pipeline and triggers
 * the same DXF self-heal.
 */
export async function loadFloorFloorplans(
  companyId: string,
  floorId: string,
): Promise<ShowcaseMedia[]> {
  const metas = await listEntityMedia({
    companyId,
    entityType: ENTITY_TYPES.FLOOR,
    entityId: floorId,
    category: FILE_CATEGORIES.FLOORPLANS,
    limit: 6,
  });
  scheduleDxfSelfheal(metas);
  return toShowcaseMedia(metas);
}

/**
 * Load κάτοψη ορόφου for the property itself (Phase 7.5). Returns undefined
 * when the property doesn't resolve to a floor or the floor has no plans.
 */
export async function loadPropertyFloorFloorplans(
  companyId: string,
  context: PropertyShowcaseContext,
): Promise<ShowcasePropertyFloorFloorplans | undefined> {
  const floorId = resolveFloorId(context.property, context.floors);
  if (!floorId) return undefined;
  const media = await loadFloorFloorplans(companyId, floorId).catch((err) => {
    logger.warn('Property floor floorplans load failed; continuing without', {
      floorId, error: err instanceof Error ? err.message : String(err),
    });
    return [] as ShowcaseMedia[];
  });
  if (media.length === 0) return undefined;
  return {
    floorLabel: pickFloorLabel(context.floors.get(floorId)),
    media,
  };
}

/**
 * Load floorplan media for every parking/storage linked to the property
 * (ADR-312 Phase 7). Each group keeps the space's allocation code so the
 * web+PDF surfaces can label the katopsi pair correctly.
 *
 * Phase 7.5 — each group also gets `floorFloorplans` + `floorLabel` when the
 * space resolves to a floor via the SSoT `resolveFloorId()`.
 */
export async function loadLinkedSpaceFloorplans(
  companyId: string,
  context: PropertyShowcaseContext,
): Promise<ShowcaseLinkedSpaceFloorplans> {
  const parking: ShowcaseLinkedSpaceFloorplanGroup[] = [];
  const storage: ShowcaseLinkedSpaceFloorplanGroup[] = [];

  const tasks: Array<Promise<void>> = [];

  for (const [spaceId, doc] of context.parkingSpots.entries()) {
    tasks.push(loadLinkedSpaceGroup({
      companyId, context, spaceId, doc, entityType: ENTITY_TYPES.PARKING_SPOT, bucket: parking,
      failMessage: 'Linked parking floorplans load failed; skipping space',
    }));
  }

  for (const [spaceId, doc] of context.storages.entries()) {
    tasks.push(loadLinkedSpaceGroup({
      companyId, context, spaceId, doc, entityType: ENTITY_TYPES.STORAGE, bucket: storage,
      failMessage: 'Linked storage floorplans load failed; skipping space',
    }));
  }

  await Promise.all(tasks);
  return { parking, storage };
}

interface LoadLinkedSpaceGroupArgs {
  companyId: string;
  context: PropertyShowcaseContext;
  spaceId: string;
  doc: Record<string, unknown>;
  entityType: string;
  bucket: ShowcaseLinkedSpaceFloorplanGroup[];
  failMessage: string;
}

async function loadLinkedSpaceGroup(args: LoadLinkedSpaceGroupArgs): Promise<void> {
  const { companyId, context, spaceId, doc, entityType, bucket, failMessage } = args;
  try {
    const metas = await listEntityMedia({
      companyId,
      entityType,
      entityId: spaceId,
      category: FILE_CATEGORIES.FLOORPLANS,
      limit: 6,
    });
    scheduleDxfSelfheal(metas);
    const media = toShowcaseMedia(metas);

    const floorId = resolveFloorId(doc, context.floors);
    const floorFloorplans = floorId
      ? await loadFloorFloorplans(companyId, floorId).catch(() => [] as ShowcaseMedia[])
      : [];
    const floorLabel = floorId ? pickFloorLabel(context.floors.get(floorId)) : undefined;

    if (media.length === 0 && floorFloorplans.length === 0) return;
    bucket.push({
      spaceId,
      allocationCode: pickAllocationCode(doc),
      media,
      floorFloorplans: floorFloorplans.length > 0 ? floorFloorplans : undefined,
      floorLabel,
    });
  } catch (err) {
    logger.warn(failMessage, {
      spaceId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function pickAllocationCode(doc: Record<string, unknown>): string | undefined {
  const candidates = [doc.name, doc.number, doc.code, doc.allocationCode];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

