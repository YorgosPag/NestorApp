'use client';

/**
 * useBuildingById — Real-time subscription to a single `BUILDINGS` document.
 *
 * Επιστρέφει το πλήρες `Building` doc για το δοθέν `buildingId`, ζωντανά. Φτιάχτηκε
 * ώστε ο DXF viewer να μπορεί να ανοίξει την καρτέλα «Όροφοι» (`FloorsTabContent`)
 * σε modal χωρίς να φύγει στα «Κτίρια» — το `FloorsTabContent` χρειάζεται ένα
 * `Building` object (`id`/`projectId`/`companyId` + vertical-setup πεδία).
 *
 * SSoT: χτίζεται πάνω στο `firestoreQueryService.subscribeDoc` (ίδιος μηχανισμός
 * content-equality guard με το `useFloorsByBuilding`), ώστε όταν το
 * `BuildingVerticalSetupForm` γράφει στο doc (hasFoundation/foundationDepth/…),
 * το modal να ανανεώνεται αυτόματα (μηδέν stale state).
 *
 * @module subapps/dxf-viewer/hooks/data/useBuildingById
 */

import { useEffect, useState } from 'react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { Building } from '@/types/building/contracts';

const logger = createModuleLogger('useBuildingById');

export interface UseBuildingByIdResult {
  building: Building | null;
  loading: boolean;
}

/**
 * Subscribe to one building doc. `enabled=false` (π.χ. κλειστό modal) → κανένας
 * listener, μηδέν κόστος. `null/undefined buildingId` → null χωρίς listener.
 */
export function useBuildingById(
  buildingId: string | null | undefined,
  enabled: boolean = true,
): UseBuildingByIdResult {
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !buildingId) {
      setBuilding(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = firestoreQueryService.subscribeDoc<Building>(
      'BUILDINGS',
      buildingId,
      (doc) => {
        setBuilding(doc);
        setLoading(false);
      },
      (err) => {
        logger.error('Failed to subscribe to building', { error: err.message, buildingId });
        setBuilding(null);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [enabled, buildingId]);

  return { building, loading };
}
