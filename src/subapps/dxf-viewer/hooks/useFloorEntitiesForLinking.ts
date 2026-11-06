'use client';

/**
 * 🏢 ADR-258B: Floor-level entity fetching for overlay linking dropdown
 *
 * Fetches ALL entity types (properties + parking + storages + common spaces) from current floor
 * and returns a unified sorted list for the overlay property selector.
 *
 * ADR-931 Β1 — common spaces: those hosted on the current floor **and** those without a floor (they span the
 * whole building — stairwell, lift — Revit Area per level, the space drawn on every plan it crosses).
 *
 * Reuses existing centralized hooks:
 * - useFirestoreProperties (supports floorId via API)
 * - useFirestoreParkingSpots (building-level, filtered client-side by floorId)
 * - useFirestoreStorages (building-level, filtered client-side by floorId)
 * - useFirestoreCommonSpaces (building-level, live — filtered client-side: floorId or building-wide)
 *
 * @see SPEC-258B-properties-panel-entity-linking.md
 */

import { useMemo } from 'react';
import { useFirestoreProperties } from '@/hooks/useFirestoreProperties';
import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import { useFirestoreCommonSpaces } from '@/hooks/useFirestoreCommonSpaces';
import { linkedEntityIdsOf } from '@/types/floorplan-overlays';
import { isCommonSpaceOnPlan } from '@/lib/common-spaces/common-space-plan';
import type { CommercialStatus } from '@/types/property';
import type { Overlay } from '../overlays/types';
import { compareByLocale } from '@/lib/intl-formatting';

// =============================================================================
// TYPES
// =============================================================================

/** Normalized entity for the linking dropdown — kind-agnostic display */
export interface LinkableEntity {
  /** Firestore document ID */
  id: string;
  /** Human-readable name for dropdown display */
  displayName: string;
  /** Commercial status for color dot — always `undefined` for a common space (ΑΚ 1117: not for sale). */
  commercialStatus: CommercialStatus | undefined;
  /** Overlay ID this entity is linked to, or null if free */
  linkedToOverlayId: string | null;
  /** Entity kind — auto-set on overlay when this entity is selected */
  kind: 'property' | 'parking' | 'storage' | 'common_space';
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
  /** All floor entities (properties + parking + storages + common spaces) sorted by displayName */
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

  const { commonSpaces, loading: commonSpacesLoading } = useFirestoreCommonSpaces({
    buildingId,
    enabled: enabled && !!buildingId,
  });

  // Build entityId → overlayId map from ALL overlays (for duplicate detection)
  const linkedEntityIds = useMemo(() => {
    const map = new Map<string, string>();
    // SSoT: κάθε κλειδί σύνδεσης (`OVERLAY_LINK_KEYS`) — νέο είδος δεν χρειάζεται γραμμή εδώ (ADR-931 Β1).
    for (const ov of Object.values(overlays)) {
      for (const entityId of linkedEntityIdsOf(ov.linked)) map.set(entityId, ov.id);
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
      // ADR-903 §6 — η θέση φιλοξενείται σε όροφο μέσω `floorId` (ως τις 2026-10-03 συγκρινόταν το ελεύθερο
      // κείμενο `floor` με ταυτότητα εγγράφου ⇒ καμία θέση δεν εμφανιζόταν ποτέ για σύνδεση σε κάτοψη ορόφου).
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

    const commonSpaceEntities: LinkableEntity[] = commonSpaces
      .filter((space) => isCommonSpaceOnPlan(space, floorId))
      .map((space) => ({
        id: space.id,
        displayName: space.code ? `${space.code} · ${space.name}` : space.name,
        commercialStatus: undefined,
        linkedToOverlayId: linkedEntityIds.get(space.id) ?? null,
        kind: 'common_space' as const,
      }));

    return [...unitEntities, ...parkingEntities, ...storageEntities, ...commonSpaceEntities]
      .sort((a, b) => compareByLocale(a.displayName, b.displayName));
  }, [units, parkingSpots, storages, commonSpaces, floorId, linkedEntityIds]);

  const loading = unitsLoading || parkingLoading || storagesLoading || commonSpacesLoading;

  return { entities, loading };
}
