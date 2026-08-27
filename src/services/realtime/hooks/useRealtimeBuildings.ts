'use client';

/**
 * 🏢 ENTERPRISE: Real-time Buildings Hook for Navigation
 *
 * Παρέχει ζωντανές ενημερώσεις κτηρίων ομαδοποιημένων ανά `projectId`.
 * Το χρησιμοποιεί το `NavigationContext` για ζωντανούς μετρητές.
 *
 * ⚠️ **Ο κύκλος ζωής της συνδρομής ΔΕΝ ζει εδώ** (ADR-798 §22): στήσιμο,
 * εγγραφή, χαρτογράφηση, **κρίση σφάλματος** και καθαρισμός ανήκουν στο
 * `create-realtime-collection-hook.ts`. Εδώ μένει **μόνο** ό,τι είναι γνήσια
 * δικό αυτού του hook: η μετάφραση εγγράφου και η ομαδοποίηση ανά έργο.
 *
 * @see ./create-realtime-collection-hook.ts
 */

import { useCallback, useMemo } from 'react';
import type { DocumentData } from 'firebase/firestore';
import type { RealtimeBuilding, SubscriptionStatus } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
import { createRealtimeCollectionHook } from './create-realtime-collection-hook';

const logger = createModuleLogger('useRealtimeBuildings');

// ============================================================================
// TYPES
// ============================================================================

interface BuildingsByProject {
  [projectId: string]: RealtimeBuilding[];
}

interface UseRealtimeBuildingsReturn {
  /** Buildings grouped by projectId */
  buildingsByProject: BuildingsByProject;
  /** All buildings flat array */
  allBuildings: RealtimeBuilding[];
  /** Get buildings for a specific project */
  getBuildingsForProject: (projectId: string) => RealtimeBuilding[];
  /** Get building count for a project */
  getBuildingCount: (projectId: string) => number;
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

const useBuildingsCollection = createRealtimeCollectionHook<DocumentData, RealtimeBuilding>({
  collection: 'BUILDINGS',
  logger,
  mapDocuments: (documents): RealtimeBuilding[] =>
    documents.map((doc) => ({
      id: doc.id,
      name: (doc.name as string) || '',
      code: (doc.code as string) || undefined,
      projectId: (doc.projectId as string) || null,
      address: doc.address as string | undefined,
      city: doc.city as string | undefined,
      status: doc.status as string | undefined,
      totalArea: doc.totalArea as number | undefined,
      floors: doc.floors as number | undefined,
      units: doc.units as number | undefined,
      addressesCount: (doc.addresses as unknown[] | undefined)?.length ?? 0,
      createdAt: doc.createdAt as string | undefined,
      updatedAt: doc.updatedAt as string | undefined,
    })),
});

/** Ομαδοποίηση ανά έργο· τα αδέσποτα πάνε σε ρητό κάδο, ποτέ σιωπηλά χαμένα. */
function groupByProject(buildings: readonly RealtimeBuilding[]): BuildingsByProject {
  const grouped: BuildingsByProject = {};

  buildings.forEach((building) => {
    const projectId = building.projectId || '__unassigned__';
    if (!grouped[projectId]) {
      grouped[projectId] = [];
    }
    grouped[projectId].push(building);
  });

  return grouped;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Real-time buildings hook
 *
 * @example
 * ```tsx
 * const { getBuildingCount, buildingsByProject } = useRealtimeBuildings();
 *
 * const count = getBuildingCount('projectId123');       // Returns number
 * const buildings = buildingsByProject['projectId123']; // Returns Building[]
 * ```
 */
export function useRealtimeBuildings(enabled = true): UseRealtimeBuildingsReturn {
  const { items: allBuildings, loading, error, status, refetch } = useBuildingsCollection(enabled);

  // Παράγωγο, όχι δεύτερη κατάσταση: ο χάρτης **δεν μπορεί** να ξεσυγχρονιστεί
  // από τη λίστα, γιατί δεν έχει δικό του γραφέα.
  const buildingsByProject = useMemo(() => groupByProject(allBuildings), [allBuildings]);

  const getBuildingsForProject = useCallback(
    (projectId: string): RealtimeBuilding[] => buildingsByProject[projectId] || [],
    [buildingsByProject]
  );

  const getBuildingCount = useCallback(
    (projectId: string): number => (buildingsByProject[projectId] || []).length,
    [buildingsByProject]
  );

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
    buildingsByProject,
    allBuildings,
    getBuildingsForProject,
    getBuildingCount,
    loading,
    error,
    status,
    refetch,
  };
}

export default useRealtimeBuildings;
