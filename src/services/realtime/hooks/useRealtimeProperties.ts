'use client';

/**
 * 🏢 ENTERPRISE: Real-time Properties Hook for Navigation
 *
 * Παρέχει ζωντανές ενημερώσεις ακινήτων ομαδοποιημένων ανά `buildingId`.
 * Το χρησιμοποιεί το `NavigationContext` για ζωντανούς μετρητές ανά κτήριο.
 *
 * ⚠️ **Δύο ερωτήματα, δύο σπίτια** (ADR-798 §22 · ADR-749):
 *  - ο **κύκλος ζωής** της συνδρομής Firestore → `create-realtime-collection-hook.ts`
 *  - η **αισιόδοξη ενημέρωση** από το event bus → `use-realtime-entity-events.ts`
 *
 * Εδώ μένει **μόνο** η μετάφραση εγγράφου και η ομαδοποίηση ανά κτήριο.
 *
 * @compliance CLAUDE.md Enterprise Standards
 * - ZERO hardcoded values
 * - ZERO any types
 * - Full TypeScript strict mode
 */

import { useCallback, useMemo } from 'react';
import type { DocumentData } from 'firebase/firestore';
import type { RealtimeUnit, SubscriptionStatus } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
import { createRealtimeCollectionHook } from './create-realtime-collection-hook';
import { useRealtimeEntityEvents } from './use-realtime-entity-events';

const logger = createModuleLogger('useRealtimeProperties');

// ============================================================================
// TYPES
// ============================================================================

interface UnitsByBuilding {
  [buildingId: string]: RealtimeUnit[];
}

interface UseRealtimePropertiesReturn {
  /** Properties grouped by buildingId */
  propertiesByBuilding: UnitsByBuilding;
  /** All properties flat array */
  allProperties: RealtimeUnit[];
  /** Get properties for a specific building */
  getPropertiesForBuilding: (buildingId: string) => RealtimeUnit[];
  /** Get property count for a building */
  getPropertyCount: (buildingId: string) => number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Manual refetch */
  refetch: () => void;
}

// ============================================================================
// Η ΠΑΡΑΛΛΑΓΗ — ό,τι είναι γνήσια δικό του
// ============================================================================

const usePropertiesCollection = createRealtimeCollectionHook<DocumentData, RealtimeUnit>({
  collection: 'PROPERTIES',
  logger,
  mapDocuments: (documents): RealtimeUnit[] =>
    documents.map((doc) => ({
      id: doc.id,
      name: (doc.name as string) || '',
      buildingId: (doc.buildingId as string) || null,
      type: doc.type as string | undefined,
      status: doc.status as string | undefined,
      area: doc.area as number | undefined,
      floor: doc.floor as number | undefined,
      createdAt: doc.createdAt as string | undefined,
      updatedAt: doc.updatedAt as string | undefined,
    })),
});

/** Ομαδοποίηση ανά κτήριο· τα αδέσποτα πάνε σε ρητό κάδο, ποτέ σιωπηλά χαμένα. */
function groupByBuilding(units: readonly RealtimeUnit[]): UnitsByBuilding {
  const grouped: UnitsByBuilding = {};

  units.forEach((unit) => {
    const buildingId = unit.buildingId || '__unassigned__';
    if (!grouped[buildingId]) {
      grouped[buildingId] = [];
    }
    grouped[buildingId].push(unit);
  });

  return grouped;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Real-time properties hook
 *
 * @example
 * ```tsx
 * const { getPropertyCount, propertiesByBuilding } = useRealtimeProperties();
 *
 * const count = getPropertyCount('buildingId123');            // Returns number
 * const properties = propertiesByBuilding['buildingId123'];   // Returns Property[]
 * ```
 */
export function useRealtimeProperties(enabled = true): UseRealtimePropertiesReturn {
  const {
    items: allUnits,
    setItems: setAllUnits,
    loading,
    error,
    status,
    refetch,
  } = usePropertiesCollection(enabled);

  // 🔴 Παράγωγο, όχι δεύτερη κατάσταση. Πριν, ο χάρτης ήταν **ξεχωριστό
  // `useState`** που το ενημέρωνε ένα `setUnitsByBuilding(...)` **μέσα** στον
  // updater ενός άλλου `setState` — μη καθαρός updater που δούλευε, αλλά άφηνε
  // δύο γραφείς για μία αλήθεια. Τώρα ο χάρτης δεν έχει δικό του γραφέα.
  const unitsByBuilding = useMemo(() => groupByBuilding(allUnits), [allUnits]);

  const getPropertiesForBuilding = useCallback(
    (buildingId: string): RealtimeUnit[] => unitsByBuilding[buildingId] || [],
    [unitsByBuilding]
  );

  const getPropertyCount = useCallback(
    (buildingId: string): number => (unitsByBuilding[buildingId] || []).length,
    [unitsByBuilding]
  );

  // 🏢 ENTERPRISE: Event bus subscribers for optimistic UI updates (ADR-228 Tier 1)
  useRealtimeEntityEvents({
    created: 'UNIT_CREATED',
    updated: 'UNIT_UPDATED',
    deleted: 'UNIT_DELETED',
    updatedId: (payload) => payload.propertyId,
    updatedFields: (payload) => payload.updates as Partial<RealtimeUnit>,
    deletedId: (payload) => payload.propertyId,
    setItems: setAllUnits,
    refetch,
    logger,
  });

  // ==========================================================================
  // 🔴 Ο ΑΔΡΑΝΗΣ ΦΡΟΥΡΟΣ ΠΟΥ ΑΦΑΙΡΕΘΗΚΕ (2026-08-26, ADR-798 §22.6 #2)
  // ==========================================================================
  //
  // Εδώ ζούσε listener στο `REALTIME_EVENTS.NAVIGATION_REFRESH` του οποίου το
  // σώμα ήταν **μία γραμμή καταγραφής** και ένα σχόλιο «no need to refetch».
  // Δηλαδή **αδρανής φρουρός** (ADR-749 §5): έκανε τον αναγνώστη να πιστεύει
  // ότι αυτό το hook **αντιδρά** σε ανανέωση πλοήγησης, ενώ **δεν αντιδρούσε**.
  //
  // ⚠️ **ΤΟ ΣΥΜΒΑΝ ΔΕΝ ΣΚΟΤΩΘΗΚΕ — ΜΕΤΡΗΘΗΚΕ**: το `NAVIGATION_REFRESH` έχει
  // **πραγματικό** καταναλωτή, το `navigation/core/hooks/useNavigationSubscriptions.ts`,
  // που κάνει **πλήρη επαναφόρτωση** πλοήγησης· και **τρεις** παραγωγούς
  // (`NavigationCompanyManager` · `RealtimeService` ×2 · `entity-linking/config` ×3).
  // Αυτό που αφαιρέθηκε είναι **μόνο** ο εδώ σιωπηλός ακροατής.
  //
  // Μοναδική παρατηρήσιμη συνέπεια: **μία γραμμή log λιγότερη**. Η συνδρομή
  // `onSnapshot` ήδη φέρνει κάθε αλλαγή — γι' αυτό ακριβώς το έγραφε το σχόλιο.

  return {
    propertiesByBuilding: unitsByBuilding,
    allProperties: allUnits,
    getPropertiesForBuilding,
    getPropertyCount,
    loading,
    error,
    status,
    refetch,
  };
}

export default useRealtimeProperties;
