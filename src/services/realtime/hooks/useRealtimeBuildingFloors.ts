'use client';

/**
 * ADR-798 §22.6 #1 — όροφοι κτιρίου + **ποιοι δεν έχουν κάτοψη**, σε πραγματικό χρόνο.
 *
 * 🔴 **ΤΙ ΔΙΟΡΘΩΘΗΚΕ 2026-08-26**: **δύο** χειριστές σφάλματος ήταν
 * `() => { setLoading(false); }` — σιωπηλή κατάποση. Πλέον περνούν από τον
 * κοινό κύκλο ζωής, που ξεχωρίζει τη **σχεδιασμένη σιωπή** του αυτόνομου
 * *(ADR-807)* από τη **βλάβη**.
 *
 * 🔑 **ΓΙΑΤΙ ΤΟ `error` ΕΙΝΑΙ ΕΝΑ ΚΑΙ ΟΧΙ ΔΥΟ**: ο καταναλωτής ρωτά *«μπορώ να
 * εμπιστευτώ αυτό που βλέπω;»*. Το `hasFloorsWithoutFloorplan` είναι
 * **διασταύρωση** των δύο συνδρομών — με μία σπασμένη θα ήταν **ψευδές με
 * σιγουριά**, όχι άγνωστο. Γι' αυτό η ετυμηγορία σιωπά όσο υπάρχει σφάλμα.
 *
 * @module services/realtime/hooks/useRealtimeBuildingFloors
 * @see ./use-keyed-realtime-subscription.ts
 */

import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { useKeyedRealtimeSubscription } from './use-keyed-realtime-subscription';

const logger = createModuleLogger('useRealtimeBuildingFloors');

/** Η **κενή** ταυτότητα των ορόφων. Σταθερή αναφορά ⇒ κανένας βρόχος render. */
const NO_FLOOR_IDS: readonly string[] = [];

/** Η **κενή** ταυτότητα των κατόψεων ορόφου. Ίδιος λόγος. */
const NO_FLOORPLAN_IDS: ReadonlySet<string> = new Set<string>();

interface UseRealtimeBuildingFloorsReturn {
  floorsCount: number;
  hasFloorsWithoutFloorplan: boolean;
  loading: boolean;
  /** 🆕 Πραγματική βλάβη σε **οποιαδήποτε** από τις δύο συνδρομές. */
  error: string | null;
}

/**
 * Real-time floors data for a specific building.
 *
 * Δύο συνδρομές:
 *  1. `FLOORS` με φίλτρο `buildingId` — δίνει τα id και το πλήθος των ορόφων
 *  2. `FILES` με φίλτρο `entityType=floor + purpose=floor-floorplan + isDeleted=false`
 *     *(σε επίπεδο εταιρείας· διασταυρώνεται στη μνήμη με τα id της (1))*
 *
 * Απαιτεί σύνθετα index Firestore:
 *  - `FLOORS`: `companyId + buildingId`
 *  - `FILES`: `companyId + entityType + purpose + isDeleted` *(2026-05-06)*
 */
export function useRealtimeBuildingFloors(
  buildingId: string | null | undefined
): UseRealtimeBuildingFloorsReturn {
  const key = buildingId ?? null;

  const floors = useKeyedRealtimeSubscription<readonly string[]>({
    collection: 'FLOORS',
    logger,
    key,
    empty: NO_FLOOR_IDS,
    constraints: (id) => [where('buildingId', '==', id)],
    select: (result) => result.documents.map((doc) => doc['id'] as string),
  });

  const floorplans = useKeyedRealtimeSubscription<ReadonlySet<string>>({
    collection: 'FILES',
    logger,
    key,
    empty: NO_FLOORPLAN_IDS,
    constraints: () => [
      where('entityType', '==', ENTITY_TYPES.FLOOR),
      where('purpose', '==', FLOORPLAN_PURPOSES.FLOOR),
      where('isDeleted', '==', false),
    ],
    select: (result) => new Set(result.documents.map((doc) => doc['entityId'] as string)),
  });

  const loading = floors.loading || floorplans.loading;
  const error = floors.error ?? floorplans.error;

  const hasFloorsWithoutFloorplan = useMemo(
    () =>
      !loading &&
      error === null &&
      floors.data.length > 0 &&
      floors.data.some((id) => !floorplans.data.has(id)),
    [loading, error, floors.data, floorplans.data],
  );

  return { floorsCount: floors.data.length, hasFloorsWithoutFloorplan, loading, error };
}
