'use client';

/**
 * useFloorsByBuilding — Real-time floor subscription scoped to a building
 *
 * Returns sorted floor list (basement → ground → upper) for the given building.
 * Used by ADR-329 BOQ scope pickers (FloorSelectByBuilding) and any consumer
 * needing floor-scoped data.
 *
 * @module components/properties/shared/useFloorsByBuilding
 * @see ADR-329 §3.4 (Floor Select)
 */

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useAuth } from '@/auth/contexts/AuthContext';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorsByBuilding');

export interface FloorOption {
  id: string;
  number: number;
  name: string;
  buildingId: string;
}

export interface UseFloorsByBuildingResult {
  floors: FloorOption[];
  loading: boolean;
}

export function useFloorsByBuilding(
  buildingId: string | null | undefined,
  enabled: boolean = true,
): UseFloorsByBuildingResult {
  const { user } = useAuth();
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !buildingId || !user) {
      setFloors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'FLOORS',
      (result) => {
        const items: FloorOption[] = result.documents
          .map((data) => ({
            id: data.id,
            number: typeof data.number === 'number' ? data.number : 0,
            name: (data.name as string) || '',
            buildingId: (data.buildingId as string) || '',
          }))
          .sort((a, b) => a.number - b.number);
        setFloors(items);
        setLoading(false);
      },
      (err) => {
        logger.error('Failed to subscribe to floors', { error: err.message, buildingId });
        setFloors([]);
        setLoading(false);
      },
      {
        constraints: [where('buildingId', '==', buildingId)],
      },
    );
    return () => unsubscribe();
  }, [enabled, buildingId, user]);

  return { floors, loading };
}
