'use client';

/**
 * 🏢 ADR-258B: Floor-level entity fetching for overlay linking dropdown
 *
 * Fetches ALL entity types (properties + parking + storages) from current floor
 * and returns a unified sorted list for the overlay property selector.
 *
 * Reuses existing centralized hooks:
 * - useFirestoreProperties (supports floorId via API)
 * - useFirestoreParkingSpots (building-level, filtered client-side by floorId)
 * - useFirestoreStorages (building-level, filtered client-side by floorId)
 *
 * @see SPEC-258B-properties-panel-entity-linking.md
 */

import { useMemo } from 'react';
import { useFirestoreProperties } from '@/hooks/useFirestoreProperties';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import type { CommercialStatus } from '@/types/property';
import type { SpaceCommercialStatus } from '@/types/sales-shared';
import type { Overlay } from '../overlays/types';

// =============================================================================
// TYPES
// =============================================================================

/** Normalized entity for the linking dropdown — kind-agnostic display */
export interface LinkableEntity {
  /** Firestore document ID */
  id: string;
  /** Human-readable name for dropdown display */
  displayName: string;
  /** Commercial status for color dot */
  commercialStatus: CommercialStatus | SpaceCommercialStatus | undefined;
  /** Overlay ID this entity is linked to, or null if free */
  linkedToOverlayId: string | null;
  /** Entity kind — auto-set on overlay when this entity is selected */
  kind: 'property' | 'parking' | 'storage';
}

interface UseFloorEntitiesForLinkingParams {
  /** Building ID from ProjectHierarchyContext (required for parking/storage) */
  buildingId: string | undefined;
  /** Floor ID derived from current Level.floorId (required for properties) */
  floorId: string | undefined;
  /** All overlays on current level — for cross-reference of already-linked entities */
  overlays: Record<string, Overlay>;
  /** Whether to enable fetching (false when no overlay selected) */
  enabled: boolean;
}

interface UseFloorEntitiesForLinkingReturn {
  /** All floor entities (properties + parking + storages) sorted by displayName */
  entities: LinkableEntity[];
  /** True while any hook is loading */
  loading: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useFloorEntitiesForLinking({
  buildingId,
  floorId,
  overlays,
  enabled,
}: UseFloorEntitiesForLinkingParams): UseFloorEntitiesForLinkingReturn {

  const hasFloorOrBuilding = !!buildingId || !!floorId;

  // All 3 hooks ALWAYS called (React rules of hooks) — autoFetch controls fetching
  // Properties: API supports floorId-only query (company-scoped)
  // Parking/Storage: API requires buildingId — floorId filtered client-side
  const { properties: units, loading: unitsLoading } = useFirestoreProperties({
    buildingId,
    floorId,
    autoFetch: enabled && hasFloorOrBuilding,
  });

  const { parkingSpots, loading: parkingLoading } = useFirestoreParkingSpots({
    buildingId,
    autoFetch: enabled && !!buildingId,
  });

  const { storages, loading: storagesLoading } = useFirestoreStorages({
    buildingId,
    autoFetch: enabled && !!buildingId,
  });

  // Build entityId → overlayId map from ALL overlays (for duplicate detection)
  const linkedEntityIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const ov of Object.values(overlays)) {
      if (ov.linked?.propertyId) map.set(ov.linked.propertyId, ov.id);
      if (ov.linked?.parkingId) map.set(ov.linked.parkingId, ov.id);
      if (ov.linked?.storageId) map.set(ov.linked.storageId, ov.id);
    }
    return map;
  }, [overlays]);

  // Merge all entity types into a unified sorted list
  const entities = useMemo((): LinkableEntity[] => {
    const unitEntities: LinkableEntity[] = units.map(u => ({
      id: u.id,
      displayName: u.name || u.code || u.id,
      commercialStatus: u.commercialStatus,
      linkedToOverlayId: linkedEntityIds.get(u.id) ?? null,
      kind: 'property' as const,
    }));

    const filteredParking = floorId
      ? parkingSpots.filter(p => p.floorId === floorId)
      : parkingSpots;
    const parkingEntities: LinkableEntity[] = filteredParking.map(p => ({
      id: p.id,
      displayName: p.number || p.id,
      commercialStatus: p.commercialStatus,
      linkedToOverlayId: linkedEntityIds.get(p.id) ?? null,
      kind: 'parking' as const,
    }));

    const filteredStorages = floorId
      ? storages.filter(s => s.floorId === floorId)
      : storages;
    const storageEntities: LinkableEntity[] = filteredStorages.map(s => ({
      id: s.id,
      displayName: s.name || s.id,
      commercialStatus: s.commercialStatus,
      linkedToOverlayId: linkedEntityIds.get(s.id) ?? null,
      kind: 'storage' as const,
    }));

    return [...unitEntities, ...parkingEntities, ...storageEntities]
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [units, parkingSpots, storages, floorId, linkedEntityIds]);

  const loading = unitsLoading || parkingLoading || storagesLoading;

  return { entities, loading };
}
