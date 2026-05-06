'use client';

import { useState, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';

interface UseRealtimeBuildingFloorsReturn {
  floorsCount: number;
  hasFloorsWithoutFloorplan: boolean;
  loading: boolean;
}

/**
 * Real-time floors data for a specific building.
 *
 * Two Firestore subscriptions:
 *  1. FLOORS filtered by buildingId — provides floor IDs and count
 *  2. FILES filtered by entityType=floor + purpose=floor-floorplan + isDeleted=false
 *     (company-wide; cross-referenced in-memory with floor IDs from subscription 1)
 *
 * hasFloorsWithoutFloorplan is true when at least one floor of this building
 * has no active floor-floorplan file record.
 *
 * Requires Firestore composite indexes:
 *  - FLOORS: companyId + buildingId  (existing)
 *  - FILES: companyId + entityType + purpose + isDeleted  (added 2026-05-06)
 */
export function useRealtimeBuildingFloors(
  buildingId: string | null | undefined
): UseRealtimeBuildingFloorsReturn {
  const [floorsCount, setFloorsCount] = useState(0);
  const [floorIds, setFloorIds] = useState<readonly string[]>([]);
  const [floorIdsWithFloorplan, setFloorIdsWithFloorplan] = useState<ReadonlySet<string>>(new Set());
  const [floorsLoading, setFloorsLoading] = useState(!!buildingId);
  const [floorplanLoading, setFloorplanLoading] = useState(!!buildingId);

  // Subscription 1: FLOORS collection filtered by buildingId
  useEffect(() => {
    if (!buildingId) {
      setFloorsCount(0);
      setFloorIds([]);
      setFloorsLoading(false);
      return;
    }

    setFloorsLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FLOORS',
      (result: QueryResult<DocumentData>) => {
        setFloorsCount(result.size);
        setFloorIds(result.documents.map((doc) => doc['id'] as string));
        setFloorsLoading(false);
      },
      () => {
        setFloorsLoading(false);
      },
      { constraints: [where('buildingId', '==', buildingId)] }
    );

    return () => unsubscribe();
  }, [buildingId]);

  // Subscription 2: FILES collection — all active floor floorplans (company-wide)
  // Cross-referenced in-memory with floorIds from subscription 1.
  useEffect(() => {
    if (!buildingId) {
      setFloorIdsWithFloorplan(new Set());
      setFloorplanLoading(false);
      return;
    }

    setFloorplanLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        const ids = new Set(result.documents.map((doc) => doc['entityId'] as string));
        setFloorIdsWithFloorplan(ids);
        setFloorplanLoading(false);
      },
      () => {
        setFloorplanLoading(false);
      },
      {
        constraints: [
          where('entityType', '==', ENTITY_TYPES.FLOOR),
          where('purpose', '==', FLOORPLAN_PURPOSES.FLOOR),
          where('isDeleted', '==', false),
        ],
      }
    );

    return () => unsubscribe();
  }, [buildingId]);

  const loading = floorsLoading || floorplanLoading;
  const hasFloorsWithoutFloorplan =
    !loading &&
    floorIds.length > 0 &&
    floorIds.some((id) => !floorIdsWithFloorplan.has(id));

  return { floorsCount, hasFloorsWithoutFloorplan, loading };
}
