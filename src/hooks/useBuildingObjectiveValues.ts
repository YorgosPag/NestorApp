'use client';

/**
 * @fileoverview **Ο πίνακας αντικειμενικής του κτιρίου, από τον server** (ADR-898 Φ4β) — η βάση της καρτέλας
 * «Αντικειμενική». Ο πελάτης **δεν** υπολογίζει τίποτα: ούτε αντιστοίχιση μονάδα → πρόχειρο, ούτε σύνολο.
 * @related `app/api/buildings/[buildingId]/objective-values/route.ts` · `lib/objective-value/building-objective-values-contract.ts`
 * @module hooks/useBuildingObjectiveValues
 *
 * 🔑 **Παλιό όσο έρχεται το νέο** (ADR-300 `createStaleCache`): επιστροφή στην καρτέλα ⇒ αμέσως η τελευταία εικόνα, και
 *   σιωπηλή ανανέωση· `refreshing` λέει στην οθόνη ότι τα ποσά επανυπολογίζονται (ποτέ αναβόσβημα «φόρτωσης»).
 * 🔑 **Νικά η τελευταία ερώτηση** (αριθμός ακολουθίας, πρότυπο `useListingPreview`).
 * 🔑 **Πότε ξαναρωτάμε**: αλλαγή κτιρίου/μονάδων (`RealtimeService`) · επιστροφή στο παράθυρο (`useTabVisibilityRefresh`
 *   — οι φάσεις του χρονοδιαγράμματος δεν εκπέμπουν γεγονός, και το στάδιο ζει εκεί) · ρητό `refresh()` μετά από γραφή.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { useTabVisibilityRefresh } from '@/hooks/useTabVisibilityRefresh';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { BuildingObjectiveValues } from '@/lib/objective-value/building-objective-values-contract';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime/RealtimeService';

const logger = createModuleLogger('useBuildingObjectiveValues');
const cache = createStaleCache<BuildingObjectiveValues>('building-objective-values');

export type BuildingObjectiveValuesState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  /** `refreshing` ⇒ τα ποσά της οθόνης είναι της προηγούμενης ανάγνωσης και έρχονται νέα. */
  | { readonly kind: 'ready'; readonly data: BuildingObjectiveValues; readonly refreshing: boolean };

export interface BuildingObjectiveValuesResource {
  readonly state: BuildingObjectiveValuesState;
  /** Ξαναρώτα τον server — η οθόνη κρατά την τρέχουσα εικόνα ως τότε. */
  readonly refresh: () => void;
}

function initialState(buildingId: string): BuildingObjectiveValuesState {
  const cached = cache.get(buildingId);
  return cached === null ? { kind: 'loading' } : { kind: 'ready', data: cached, refreshing: true };
}

/** Κάθε γεγονός που αλλάζει τις εισόδους: το κτίριο, ή οποιαδήποτε μονάδα (δεν ξέρουμε πάντα το κτίριό της). */
function useInputChanges(buildingId: string, refresh: () => void): void {
  useEffect(() => {
    const unsubscribers = [
      RealtimeService.subscribe('BUILDING_UPDATED', (payload) => {
        if (payload.buildingId === buildingId) refresh();
      }, { checkPendingOnMount: false }),
      RealtimeService.subscribe('UNIT_UPDATED', refresh, { checkPendingOnMount: false }),
      RealtimeService.subscribe('UNIT_CREATED', refresh, { checkPendingOnMount: false }),
      RealtimeService.subscribe('UNIT_DELETED', refresh, { checkPendingOnMount: false }),
      RealtimeService.subscribe('PROPERTY_BUILDING_LINKED', refresh, { checkPendingOnMount: false }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [buildingId, refresh]);
  useTabVisibilityRefresh(refresh);
}

export function useBuildingObjectiveValues(buildingId: string): BuildingObjectiveValuesResource {
  const [state, setState] = useState<BuildingObjectiveValuesState>(() => initialState(buildingId));
  const sequence = useRef(0);

  const refresh = useCallback(() => {
    const ticket = ++sequence.current;
    setState((previous) => (previous.kind === 'ready' ? { ...previous, refreshing: true } : { kind: 'loading' }));
    apiClient
      .get<BuildingObjectiveValues>(API_ROUTES.BUILDINGS.OBJECTIVE_VALUES(buildingId))
      .then((data) => {
        if (ticket !== sequence.current) return;
        cache.set(data, buildingId);
        setState({ kind: 'ready', data, refreshing: false });
      })
      .catch((cause: unknown) => {
        if (ticket !== sequence.current) return;
        logger.warn('Ο πίνακας αντικειμενικής του κτιρίου δεν φορτώθηκε', {
          data: { buildingId },
          error: cause instanceof Error ? cause.message : String(cause),
        });
        // Μια εικόνα που ήδη υπάρχει μένει (απέτυχε μόνο η ανανέωση)· χωρίς εικόνα ⇒ αποτυχία.
        setState((previous) => (previous.kind === 'ready' ? { ...previous, refreshing: false } : { kind: 'failed' }));
      });
  }, [buildingId]);

  // Άλλο κτίριο ⇒ η εικόνα του (από την κρύπτη, αν υπάρχει) και νέα ανάγνωση.
  useEffect(() => {
    setState(initialState(buildingId));
    refresh();
  }, [buildingId, refresh]);

  useInputChanges(buildingId, refresh);
  return { state, refresh };
}
