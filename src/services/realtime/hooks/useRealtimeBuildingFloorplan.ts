'use client';

/**
 * ADR-798 §22.6 #1 — παρουσία **κάτοψης κτιρίου**, σε πραγματικό χρόνο.
 *
 * 🔴 **ΤΙ ΔΙΟΡΘΩΘΗΚΕ 2026-08-26**: ο χειριστής σφάλματος ήταν
 * `() => { setLoading(false); }` — **ούτε** σφάλμα, **ούτε** καταγραφή, **ούτε**
 * κριτής. Πραγματική βλάβη ήταν **αόρατη**: το spinner έσβηνε και η οθόνη έλεγε
 * «καμία κάτοψη», δηλαδή **απουσία γνώσης παρουσιασμένη ως γνώση**.
 *
 * Ο κύκλος ζωής ζει πλέον στο `useKeyedRealtimeSubscription` — εδώ μένει **μόνο**
 * η ερώτηση του τομέα.
 *
 * @module services/realtime/hooks/useRealtimeBuildingFloorplan
 * @see ./use-keyed-realtime-subscription.ts
 */

import { where } from 'firebase/firestore';
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { useKeyedRealtimeSubscription } from './use-keyed-realtime-subscription';

const logger = createModuleLogger('useRealtimeBuildingFloorplan');

interface UseRealtimeBuildingFloorplanReturn {
  hasBuildingFloorplan: boolean;
  loading: boolean;
  /** 🆕 Πραγματική βλάβη, **ορατή**. `null` = υγιής — και το άδειο του αυτόνομου είναι υγιές. */
  error: string | null;
}

/**
 * Real-time presence check for building-level floorplan (κάτοψη κτιρίου).
 *
 * Απαιτεί σύνθετο index Firestore: `companyId + entityId + purpose + isDeleted`.
 * Ο ενοικιαστής (`companyId`) μπαίνει **αυτόματα** από το `firestoreQueryService`.
 */
export function useRealtimeBuildingFloorplan(
  buildingId: string | number | null | undefined
): UseRealtimeBuildingFloorplanReturn {
  const { data, loading, error } = useKeyedRealtimeSubscription<boolean>({
    collection: 'FILES',
    logger,
    key: buildingId != null ? String(buildingId) : null,
    empty: false,
    constraints: (id) => [
      where('entityType', '==', ENTITY_TYPES.BUILDING),
      where('entityId', '==', id),
      where('purpose', '==', FLOORPLAN_PURPOSES.BUILDING),
      where('isDeleted', '==', false),
    ],
    select: (result) => result.size > 0,
  });

  return { hasBuildingFloorplan: data, loading, error };
}
