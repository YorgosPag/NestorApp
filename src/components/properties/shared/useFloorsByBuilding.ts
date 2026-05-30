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
import { isFloorKind, type FloorKind } from '@/utils/floor-naming';

const logger = createModuleLogger('useFloorsByBuilding');

export interface FloorOption {
  id: string;
  number: number;
  name: string;
  buildingId: string;
  /** ADR-399: Greek canonical label (ADR-369) — used by the floor-tab strip. */
  longName?: string;
  /** ADR-399: Revit-style classification (ADR-369) — drives label fallback. */
  kind?: FloorKind;
  /**
   * ADR-369 storey elevation in **metres** (world Y), as entered in the building
   * «Όροφοι» tab (default = number × 3.0m). Canonical source for 3D multi-floor
   * stacking (ADR-399 Phase B) — read straight from the FLOORS doc here so the
   * stack height matches the tab, bypassing the lossy ProjectHierarchyContext.
   */
  elevation?: number;
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
            longName: typeof data.longName === 'string' ? data.longName : undefined,
            kind: isFloorKind(data.kind) ? data.kind : undefined,
            elevation: typeof data.elevation === 'number' ? data.elevation : undefined,
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
