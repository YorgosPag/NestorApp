'use client';

import { useState, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';

interface UseRealtimeBuildingFloorplanReturn {
  hasBuildingFloorplan: boolean;
  loading: boolean;
}

/**
 * Real-time presence check for building-level floorplan (κάτοψη κτιρίου).
 * Subscribes to FILES collection filtered by entityId + purpose + isDeleted.
 * Uses the centralized firestoreQueryService (auto-injects companyId tenant filter).
 * Requires Firestore composite index: companyId + entityId + purpose + isDeleted.
 */
export function useRealtimeBuildingFloorplan(
  buildingId: string | number | null | undefined
): UseRealtimeBuildingFloorplanReturn {
  const buildingIdStr = buildingId != null ? String(buildingId) : null;
  const [hasBuildingFloorplan, setHasBuildingFloorplan] = useState(false);
  const [loading, setLoading] = useState(!!buildingIdStr);

  useEffect(() => {
    if (!buildingIdStr) {
      setHasBuildingFloorplan(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        setHasBuildingFloorplan(result.size > 0);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      {
        constraints: [
          where('entityType', '==', ENTITY_TYPES.BUILDING),
          where('entityId', '==', buildingIdStr),
          where('purpose', '==', FLOORPLAN_PURPOSES.BUILDING),
          where('isDeleted', '==', false),
        ],
      }
    );

    return () => unsubscribe();
  }, [buildingIdStr]);

  return { hasBuildingFloorplan, loading };
}
