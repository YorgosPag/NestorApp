'use client';

/**
 * =============================================================================
 * ENTERPRISE: Entity Status Resolver Hook (SSoT)
 * =============================================================================
 *
 * Real-time resolution: overlay → linked entity → commercialStatus → PropertyStatus
 *
 * Used by useFloorOverlays to enrich overlays with dynamic status from their
 * linked entities (units, parking_spots, storage_units). Replaces the deprecated
 * static overlay.status field with live data from Firestore.
 *
 * Architecture:
 * 1. Extract unique entity IDs per collection from overlays
 * 2. Set up firestoreQueryService subscriptions per collection (chunked at FIRESTORE_LIMITS)
 * 3. Map each overlay to its resolved PropertyStatus
 *
 * @module hooks/useEntityStatusResolver
 * @enterprise ADR-258 / SPEC-258C — Entity Status Resolver SSoT Hook
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  where,
  documentId,
  type Unsubscribe,
} from 'firebase/firestore';
import { FIRESTORE_LIMITS, type CollectionKey } from '@/config/firestore-collections';
import { chunkArray } from '@/lib/array-utils';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { commercialToPropertyStatus } from '@/subapps/dxf-viewer/config/color-mapping';
import { createModuleLogger } from '@/lib/telemetry';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';
import type { OverlayKind } from '@/subapps/dxf-viewer/overlays/types';
import type { CommercialStatus } from '@/types/property';
import type { SpaceCommercialStatus } from '@/types/sales-shared';

const logger = createModuleLogger('useEntityStatusResolver');

// ============================================================================
// TYPES
// ============================================================================

/** Minimal overlay shape required by the resolver — decoupled from FloorOverlayItem */
export interface ResolvableOverlay {
  readonly id: string;
  readonly kind: OverlayKind;
  readonly status?: PropertyStatus;
  readonly linked?: {
    readonly propertyId?: string;
    readonly parkingId?: string;
    readonly storageId?: string;
  };
}

/** Internal cache: entityId → raw commercial status from Firestore */
type EntityStatusCache = Map<string, CommercialStatus | SpaceCommercialStatus>;

/** Collection subscription config */
interface CollectionSubscription {
  collectionKey: CollectionKey;
  entityIds: readonly string[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract the linked entity ID for an overlay based on its kind.
 * Returns undefined for footprint or unlinked overlays.
 */
function getLinkedEntityId(overlay: ResolvableOverlay): string | undefined {
  switch (overlay.kind) {
    case 'property': return overlay.linked?.propertyId;
    case 'parking': return overlay.linked?.parkingId;
    case 'storage': return overlay.linked?.storageId;
    default: return undefined;
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * ENTERPRISE: Real-time Entity Status Resolver
 *
 * Resolves each overlay's PropertyStatus dynamically from its linked entity's
 * commercialStatus via firestoreQueryService subscriptions (ADR-214 SSoT).
 *
 * Resolution priority (ADR-258):
 * 1. Linked entity found in Firestore → commercialToPropertyStatus(entity.commercialStatus)
 * 2. Linked entity ID exists but document missing (deleted) → 'unavailable'
 * 3. No linked entity, legacy overlay.status exists → overlay.status
 * 4. Fallback → 'unavailable'
 *
 * @param overlays - Floor overlays from useFloorOverlays (footprints already filtered)
 * @returns Map<overlayId, PropertyStatus> — resolved status per overlay
 */
export function useEntityStatusResolver(
  overlays: ReadonlyArray<ResolvableOverlay>
): Map<string, PropertyStatus> {

  // ── Step A: Extract + deduplicate entity IDs per collection ────────────
  const entityGroups = useMemo(() => {
    const propertyIds = new Set<string>();
    const parkingIds = new Set<string>();
    const storageIds = new Set<string>();

    for (const overlay of overlays) {
      if (overlay.kind === 'property' && overlay.linked?.propertyId) {
        propertyIds.add(overlay.linked.propertyId);
      }
      if (overlay.kind === 'parking' && overlay.linked?.parkingId) {
        parkingIds.add(overlay.linked.parkingId);
      }
      if (overlay.kind === 'storage' && overlay.linked?.storageId) {
        storageIds.add(overlay.linked.storageId);
      }
    }

    return {
      units: Array.from(propertyIds).sort(),
      parking: Array.from(parkingIds).sort(),
      storage: Array.from(storageIds).sort(),
    };
  }, [overlays]);

  // Stable key — only changes when actual entity IDs change
  const subscriptionKey = useMemo(
    () => JSON.stringify(entityGroups),
    [entityGroups]
  );

  // ── Step B: Real-time subscriptions per collection/chunk ──────────────
  const [entityStatusCache, setEntityStatusCache] = useState<EntityStatusCache>(new Map());

  // Mutable ref for accumulating status updates across multiple subscription callbacks
  const liveMapRef = useRef<EntityStatusCache>(new Map());

  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];
    // Reset live map on new subscription cycle
    liveMapRef.current = new Map();

    const subscriptions: CollectionSubscription[] = [
      { collectionKey: 'PROPERTIES', entityIds: entityGroups.units },
      { collectionKey: 'PARKING_SPACES', entityIds: entityGroups.parking },
      { collectionKey: 'STORAGE', entityIds: entityGroups.storage },
    ];

    let totalChunks = 0;
    let loadedChunks = 0;

    for (const { collectionKey, entityIds } of subscriptions) {
      if (entityIds.length === 0) continue;

      const chunks = chunkArray([...entityIds], FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);
      totalChunks += chunks.length;

      for (const chunk of chunks) {
        // 🏢 ADR-214 (C.5.31): subscribe via firestoreQueryService SSoT.
        // 🔒 tenantOverride: 'skip' — batch-get by documentId() for units /
        // parking_spots / storage_units whose tenant scope is resolved via
        // buildingId / projectId (not a companyId field). entityIds come
        // from a tenant-scoped upstream query + Firestore rules enforce.
        const unsub = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
          collectionKey,
          (result) => {
            const foundIds = new Set<string>();

            for (const docData of result.documents) {
              const commercialStatus = docData.commercialStatus as
                | CommercialStatus
                | SpaceCommercialStatus
                | undefined;
              liveMapRef.current.set(docData.id, commercialStatus ?? 'unavailable');
              foundIds.add(docData.id);
            }

            // Mark missing IDs as 'unavailable' (entity deleted)
            for (const id of chunk) {
              if (!foundIds.has(id)) {
                liveMapRef.current.set(id, 'unavailable');
              }
            }

            // Track initial loading
            loadedChunks++;

            // Trigger re-render with immutable copy
            setEntityStatusCache(new Map(liveMapRef.current));

            if (loadedChunks === totalChunks) {
              logger.debug('All entity statuses resolved', {
                data: { entities: liveMapRef.current.size },
              });
            }
          },
          (error) => {
            logger.error('Entity status subscription error', {
              error,
              data: { collectionKey },
            });
          },
          {
            constraints: [where(documentId(), 'in', chunk)],
            tenantOverride: 'skip',
          }
        );

        unsubscribes.push(unsub);
      }
    }

    // No subscriptions needed — clear cache
    if (totalChunks === 0) {
      liveMapRef.current = new Map();
      setEntityStatusCache(new Map());
    }

    return () => {
      unsubscribes.forEach((fn) => fn());
    };
  }, [subscriptionKey]);

  // ── Step C: Build overlayId → PropertyStatus result map ───────────────
  const resolvedStatusMap = useMemo(() => {
    const result = new Map<string, PropertyStatus>();

    for (const overlay of overlays) {
      const linkedId = getLinkedEntityId(overlay);

      if (linkedId && entityStatusCache.has(linkedId)) {
        // Entity found (or marked 'unavailable' if deleted)
        const rawStatus = entityStatusCache.get(linkedId)!;
        result.set(overlay.id, commercialToPropertyStatus(rawStatus));
      } else if (linkedId) {
        // Entity subscriptions still loading — use legacy status as temp value
        result.set(overlay.id, overlay.status ?? 'unavailable');
      } else {
        // No linked entity — legacy overlay or unlinked
        result.set(overlay.id, overlay.status ?? 'unavailable');
      }
    }

    return result;
  }, [overlays, entityStatusCache]);

  return resolvedStatusMap;
}
