'use client';

/**
 * @fileoverview **Η κατάσταση της καρτέλας «Αντικειμενική» του κτιρίου** (ADR-898 Φ4β): ο πίνακας από τον server +
 * τα γεγονότα του κτιρίου με αισιόδοξη επικάλυψη και σειριακή ουρά αποθήκευσης.
 * @related `hooks/useBuildingObjectiveValues.ts` (η ανάγνωση) · `hooks/useFieldPatchQueue.ts` (η ουρά) ·
 *   `services/building/building-mutation-gateway.ts` (`updateBuildingObjectiveValueFactsWithPolicy` — η πόρτα γραφής)
 * @module components/building-management/tabs/ObjectiveValueTab/useBuildingObjectiveValueTab
 *
 * 🔑 **Καμία δεύτερη αλήθεια**: τα γεγονότα στην οθόνη = `applyBuildingObjectiveValuePatch(server, επικάλυψη)` — η
 *   **ίδια** συνάρτηση με τον server. Τα ποσά **δεν** επικαλύπτονται ποτέ: τα υπολογίζει μόνο ο server, και όσο
 *   επανυπολογίζονται η οθόνη το λέει (`refreshing`) — ποτέ παλιό ποσό ως νέο.
 * 🔑 Η επιτυχής γραφή εκπέμπει `BUILDING_UPDATED` ⇒ η ανάγνωση ξαναρωτά μόνη της (καμία δεύτερη κλήση εδώ).
 */

import { useCallback, useMemo, useRef } from 'react';

import { useBuildingObjectiveValues, type BuildingObjectiveValuesState } from '@/hooks/useBuildingObjectiveValues';
import { useFieldPatchQueue, type FieldPatchQueueHandle } from '@/hooks/useFieldPatchQueue';
import {
  applyBuildingObjectiveValuePatch,
  type BuildingObjectiveValueFacts,
  type BuildingObjectiveValuePatch,
} from '@/lib/objective-value/building-objective-value-facts';
import type { ObjectiveValueWriteOutcome, ObjectiveValueWriteRejection } from '@/lib/objective-value/objective-value-improve-subject';
import { updateBuildingObjectiveValueFactsWithPolicy } from '@/services/building/building-mutation-gateway';

export type BuildingFactsSave = FieldPatchQueueHandle<BuildingObjectiveValuePatch, ObjectiveValueWriteRejection>;

export interface BuildingObjectiveValueTabState {
  readonly values: BuildingObjectiveValuesState;
  /** Τα γεγονότα όπως τα βλέπει ο άνθρωπος (server + ό,τι δεν επιβεβαιώθηκε ακόμη) · `null` πριν από την πρώτη ανάγνωση. */
  readonly facts: BuildingObjectiveValueFacts | null;
  readonly save: BuildingFactsSave;
  readonly refresh: () => void;
}

export function useBuildingObjectiveValueTab(buildingId: string): BuildingObjectiveValueTabState {
  const { state: values, refresh } = useBuildingObjectiveValues(buildingId);
  const serverFacts = values.kind === 'ready' ? values.data.facts : null;

  // Η πόρτα γραφής θέλει την ΤΡΕΧΟΥΣΑ εικόνα (για το ολόκληρο `BUILDING_UPDATED`), όχι αυτή της πρώτης απόδοσης.
  const factsRef = useRef<BuildingObjectiveValueFacts | null>(serverFacts);
  const send = useCallback(
    (patch: BuildingObjectiveValuePatch): Promise<ObjectiveValueWriteOutcome> => {
      const current = factsRef.current;
      if (current === null) return Promise.resolve({ kind: 'failed' });
      return updateBuildingObjectiveValueFactsWithPolicy({ buildingId, current, patch });
    },
    [buildingId],
  );
  const save: BuildingFactsSave = useFieldPatchQueue(send, serverFacts);

  const facts = useMemo(
    () => (serverFacts === null ? null : applyBuildingObjectiveValuePatch(serverFacts, save.overlay ?? {})),
    [serverFacts, save.overlay],
  );
  factsRef.current = facts;

  return { values, facts, save, refresh };
}
