'use client';

/**
 * 🏢 ADR-258B: Floor-level entity fetching for overlay linking dropdown
 *
 * SSoT hook that provides normalized, floor-filtered entities with linked-state
 * detection for the Properties Panel entity dropdown.
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
import type { OverlayKind, Overlay } from '../overlays/types';

// =============================================================================
// TYPES
// =============================================================================

/** Normalized entity for the linking dropdown — kind-agnostic display */
export interface LinkableEntity {
  /** Firestore document ID */
  id: string;
  /** Human-readable name for dropdown display */
  displayName: string;
  /** Commercial status for color dot (CommercialStatus for units, SpaceCommercialStatus for parking/storage) */
  commercialStatus: CommercialStatus | SpaceCommercialStatus | undefined;
  /** Overlay ID this entity is linked to, or null if free */
  linkedToOverlayId: string | null;
  /** Entity kind for type discrimination */
  kind: 'unit' | 'parking' | 'storage';
}

interface UseFloorEntitiesForLinkingParams {
  /** Current overlay kind — determines which entity type to fetch */
  kind: OverlayKind;
  /** Building ID from ProjectHierarchyContext */
  buildingId: string | undefined;
  /** Floor ID derived from current Level.floorId */
  floorId: string | undefined;
  /** All overlays on current level — for cross-reference of already-linked entities */
  overlays: Record<string, Overlay>;
  /** Whether to enable fetching (false when no overlay selected) */
  enabled: boolean;
}

interface UseFloorEntitiesForLinkingReturn {
  /** Floor-filtered entities with linked state, sorted by displayName */
  entities: LinkableEntity[];
  /** True while any relevant hook is loading */
  loading: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useFloorEntitiesForLinking({
  kind,
  buildingId,
  floorId,
  overlays,
  enabled,
}: UseFloorEntitiesForLinkingParams): UseFloorEntitiesForLinkingReturn {

  const isUnit = kind === 'unit';
  const isParking = kind === 'parking';
  const isStorage = kind === 'storage';

  // All 3 hooks ALWAYS called (React rules of hooks) — autoFetch controls fetching
  // Units: API supports floorId-only query (company-scoped) — buildingId optional
  // Parking/Storage: API requires buildingId — floorId filtered client-side
  const hasFloorOrBuilding = !!buildingId || !!floorId;

  const { properties: units, loading: unitsLoading } = useFirestoreProperties({
    buildingId,
    floorId,
    autoFetch: enabled && isUnit && hasFloorOrBuilding,
  });

  const { parkingSpots, loading: parkingLoading } = useFirestoreParkingSpots({
    buildingId,
    autoFetch: enabled && isParking && !!buildingId,
  });

  const { storages, loading: storagesLoading } = useFirestoreStorages({
    buildingId,
    autoFetch: enabled && isStorage && !!buildingId,
  });

  // Build entityId → overlayId map from ALL overlays (for duplicate detection)
  const linkedEntityIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const ov of Object.values(overlays)) {
      if (ov.linked?.unitId) map.set(ov.linked.unitId, ov.id);
      if (ov.linked?.parkingId) map.set(ov.linked.parkingId, ov.id);
      if (ov.linked?.storageId) map.set(ov.linked.storageId, ov.id);
    }
    return map;
  }, [overlays]);

  // Normalize to LinkableEntity[] — sorted alphabetically by displayName
  const entities = useMemo((): LinkableEntity[] => {
    let result: LinkableEntity[] = [];

    if (isUnit) {
      // useFirestoreProperties already supports floorId in API query — no client filter needed
      result = units.map(u => ({
        id: u.id,
        displayName: u.name || u.unitName || u.code || u.id,
        commercialStatus: u.commercialStatus,
        linkedToOverlayId: linkedEntityIds.get(u.id) ?? null,
        kind: 'unit' as const,
      }));
    } else if (isParking) {
      // Parking hook fetches by building — filter by floorId client-side
      const filtered = floorId
        ? parkingSpots.filter(p => p.floorId === floorId)
        : parkingSpots;
      result = filtered.map(p => ({
        id: p.id,
        displayName: p.number || p.id,
        commercialStatus: p.commercialStatus,
        linkedToOverlayId: linkedEntityIds.get(p.id) ?? null,
        kind: 'parking' as const,
      }));
    } else if (isStorage) {
      // Storage hook fetches by building — filter by floorId client-side
      const filtered = floorId
        ? storages.filter(s => s.floorId === floorId)
        : storages;
      result = filtered.map(s => ({
        id: s.id,
        displayName: s.name || s.id,
        commercialStatus: s.commercialStatus,
        linkedToOverlayId: linkedEntityIds.get(s.id) ?? null,
        kind: 'storage' as const,
      }));
    }
    // kind === 'footprint' → empty array (footprints don't link to entities)

    // Sort alphabetically for consistent dropdown order
    return result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [isUnit, isParking, isStorage, units, parkingSpots, storages, floorId, linkedEntityIds]);

  const loading = (isUnit && unitsLoading) || (isParking && parkingLoading) || (isStorage && storagesLoading);

  return { entities, loading };
}
