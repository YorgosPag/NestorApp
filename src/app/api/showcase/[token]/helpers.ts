/**
 * =============================================================================
 * GET /api/showcase/[token] — helpers (ADR-312 Phase 4)
 * =============================================================================
 *
 * SRP split from route.ts: share lookup, media mapping, DXF self-heal, linked
 * space floorplan aggregation, base-URL resolution. Route owns the handler
 * flow; helpers own the pure I/O + mapping primitives.
 *
 * @module app/api/showcase/[token]/helpers
 */

import type { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES, type FileCategory } from '@/config/domain-constants';
import {
  listEntityMedia,
  listPropertyMedia,
  type PropertyMediaItem,
} from '@/services/property-media/property-media.service';
import { ensureDxfThumbnail } from '@/services/floorplans/dxf-thumbnail-selfheal';
import type { PropertyShowcaseContext } from '@/services/property-showcase/snapshot-builder';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type {
  ShowcaseMedia,
  ShowcaseLinkedSpaceFloorplans,
  ShowcaseLinkedSpaceFloorplanGroup,
} from '@/components/property-showcase/types';

const logger = createModuleLogger('ShowcasePublicApiHelpers');

export async function loadShareByToken(token: string) {
  const adminDb = getAdminFirestore();
  if (!adminDb) return null;

  // ADR-315 dual-read: try the unified `shares` collection first — new
  // showcases created via UnifiedSharingService land here with a
  // first-class `entityType: 'property_showcase'` + `showcaseMeta` pair.
  const unifiedSnap = await adminDb
    .collection(COLLECTIONS.SHARES)
    .where('token', '==', token)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (!unifiedSnap.empty) {
    const doc = unifiedSnap.docs[0];
    const d = doc.data() as Record<string, unknown>;
    if (d.entityType === 'property_showcase') {
      const showcaseMeta = (d.showcaseMeta ?? {}) as { pdfStoragePath?: string };
      return {
        id: doc.id,
        token: d.token,
        companyId: d.companyId,
        isActive: d.isActive,
        expiresAt: d.expiresAt,
        showcaseMode: true,
        showcasePropertyId: d.entityId,
        pdfStoragePath: showcaseMeta.pdfStoragePath,
        note: d.note,
      } as Record<string, unknown> & { id: string };
    }
  }

  // Legacy fallback — `file_shares` collection (ADR-312).
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
 * Load floorplan media for every parking/storage linked to the property
 * (ADR-312 Phase 7). Each group keeps the space's allocation code so the
 * web+PDF surfaces can label the katopsi pair correctly.
 */
export async function loadLinkedSpaceFloorplans(
  companyId: string,
  context: PropertyShowcaseContext,
): Promise<ShowcaseLinkedSpaceFloorplans> {
  const parking: ShowcaseLinkedSpaceFloorplanGroup[] = [];
  const storage: ShowcaseLinkedSpaceFloorplanGroup[] = [];

  const tasks: Array<Promise<void>> = [];

  for (const [spaceId, doc] of context.parkingSpots.entries()) {
    tasks.push(
      listEntityMedia({
        companyId,
        entityType: ENTITY_TYPES.PARKING_SPOT,
        entityId: spaceId,
        category: FILE_CATEGORIES.FLOORPLANS,
        limit: 6,
      })
        .then((metas) => {
          scheduleDxfSelfheal(metas);
          const media = toShowcaseMedia(metas);
          if (media.length === 0) return;
          parking.push({
            spaceId,
            allocationCode: pickAllocationCode(doc),
            media,
          });
        })
        .catch((err) => {
          logger.warn('Linked parking floorplans load failed; skipping space', {
            spaceId, error: err instanceof Error ? err.message : String(err),
          });
        }),
    );
  }

  for (const [spaceId, doc] of context.storages.entries()) {
    tasks.push(
      listEntityMedia({
        companyId,
        entityType: ENTITY_TYPES.STORAGE,
        entityId: spaceId,
        category: FILE_CATEGORIES.FLOORPLANS,
        limit: 6,
      })
        .then((metas) => {
          scheduleDxfSelfheal(metas);
          const media = toShowcaseMedia(metas);
          if (media.length === 0) return;
          storage.push({
            spaceId,
            allocationCode: pickAllocationCode(doc),
            media,
          });
        })
        .catch((err) => {
          logger.warn('Linked storage floorplans load failed; skipping space', {
            spaceId, error: err instanceof Error ? err.message : String(err),
          });
        }),
    );
  }

  await Promise.all(tasks);
  return { parking, storage };
}

export function pickAllocationCode(doc: Record<string, unknown>): string | undefined {
  const candidates = [doc.name, doc.number, doc.code, doc.allocationCode];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

export function buildBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase && envBase.trim().length > 0) return envBase.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
