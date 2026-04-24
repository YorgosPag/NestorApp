/**
 * =============================================================================
 * BUILDING SHOWCASE SHARE RESOLVER (ADR-320 + ADR-321 Phase 2)
 * =============================================================================
 *
 * Delegates all orchestration to `createShowcaseShareResolver` (Phase 1.1 of
 * ADR-321). This file now only owns the surface-specific resolved-data shape
 * + `buildingTitle` mapping; the 95 %-shared resolve/projection/validate/
 * canShare logic lives in the core factory.
 *
 * @module services/sharing/resolvers/building-showcase.resolver
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { createShowcaseShareResolver } from '@/services/showcase-core/share-resolver-factory';
import type { ShareEntityDefinition } from '@/types/sharing';

export interface BuildingShowcaseResolvedData {
  shareId: string;
  token: string;
  buildingId: string;
  buildingTitle: string | null;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
}

export const buildingShowcaseShareResolver: ShareEntityDefinition<BuildingShowcaseResolvedData> =
  createShowcaseShareResolver<BuildingShowcaseResolvedData>({
    entityType: 'building_showcase',
    collection: COLLECTIONS.BUILDINGS,
    entityIdLabel: 'buildingId',
    loggerName: 'BuildingShowcaseShareResolver',
    buildResolvedData: ({ share, data, pdfStoragePath, pdfRegeneratedAt }) => ({
      shareId: share.id,
      token: share.token,
      buildingId: share.entityId,
      buildingTitle:
        (data?.name as string | undefined) ??
        (data?.title as string | undefined) ??
        null,
      pdfStoragePath,
      pdfRegeneratedAt,
      note: share.note ?? null,
    }),
  });
