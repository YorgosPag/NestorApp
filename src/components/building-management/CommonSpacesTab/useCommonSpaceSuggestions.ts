'use client';

/**
 * @fileoverview **Οι προτάσεις κοινοχρήστων της καρτέλας** (ADR-931 §6.2 · Β2) — στοίβα ορόφων + γεγονότα κτιρίου +
 * ζωντανοί χώροι → `suggestMissingCommonSpaces`· αποδοχή = προσυμπληρωμένος διάλογος, απόρριψη = μόνιμη στο κτίριο.
 * @related `lib/common-spaces/common-space-suggestions.ts` (καθαρό) · `building-mutation-gateway.ts` (ο γραφέας)
 * @module components/building-management/CommonSpacesTab/useCommonSpaceSuggestions
 *
 * 🔑 **Αισιόδοξη απόρριψη** (Gmail): η πρόταση φεύγει αμέσως· αποτυχία ⇒ επιστρέφει, με το μήνυμα της πόρτας.
 * 🔑 **Getter τη στιγμή της κλήσης** (ADR-040): η λίστα που στέλνεται στο `BUILDING_UPDATED` είναι η τρέχουσα, όχι
 *   στιγμιότυπο της απόδοσης — δύο γρήγορες απορρίψεις δεν χάνουν η μία την άλλη.
 * 🔑 Όσο φορτώνει η στοίβα ορόφων ⇒ καμία πρόταση (όχι αναβόσβημα «λείπει κλιμακοστάσιο» πριν έρθουν οι όροφοι).
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useMutationFailureFeedback } from '@/hooks/useMutationFailureFeedback';
import {
  readDismissedCommonSpaceSuggestions,
  suggestMissingCommonSpaces,
  type CommonSpaceSuggestion,
} from '@/lib/common-spaces/common-space-suggestions';
import { readBuildingObjectiveValueFacts } from '@/lib/objective-value/building-objective-value-facts';
import { dismissCommonSpaceSuggestionWithPolicy } from '@/services/building/building-mutation-gateway';
import type { Building } from '@/types/building/contracts';
import type { CommonSpace } from '@/types/common-space';

import { EMPTY_COMMON_SPACE_DRAFT, type CommonSpaceDraft } from './common-space-draft';

export interface CommonSpaceSuggestionsHandle {
  readonly suggestions: readonly CommonSpaceSuggestion[];
  readonly accept: (suggestion: CommonSpaceSuggestion) => void;
  readonly dismiss: (suggestion: CommonSpaceSuggestion) => Promise<void>;
}

/** Η πρόταση ως πρόχειρο φόρμας — κατηγορία, όροφος και όνομα από την ετικέτα της κατηγορίας (ορατά, διορθώσιμα). */
export function draftFromSuggestion(suggestion: CommonSpaceSuggestion, categoryLabel: string): CommonSpaceDraft {
  return { ...EMPTY_COMMON_SPACE_DRAFT, name: categoryLabel, category: suggestion.category, floorId: suggestion.floorId ?? '' };
}

/** Αποθηκευμένες ∪ αισιόδοξες απορρίψεις — η λίστα που βλέπει ο κανόνας και που στέλνεται στο γεγονός. */
function useDismissed(building: Building) {
  const stored = useMemo(
    () => readDismissedCommonSpaceSuggestions(building.dismissedCommonSpaceSuggestions),
    [building.dismissedCommonSpaceSuggestions],
  );
  const [optimistic, setOptimistic] = useState<readonly string[]>([]);
  const dismissed = useMemo(() => [...new Set([...stored, ...optimistic])], [stored, optimistic]);
  const latest = useRef(dismissed);
  latest.current = dismissed;
  const getDismissed = useCallback(() => latest.current, []);
  return { dismissed, getDismissed, setOptimistic };
}

export function useCommonSpaceSuggestions(
  building: Building,
  commonSpaces: readonly CommonSpace[],
  openPrefilled: (draft: CommonSpaceDraft) => void,
  t: (key: string) => string,
): CommonSpaceSuggestionsHandle {
  const reportFailure = useMutationFailureFeedback('CommonSpaceSuggestions');
  const { floors, loading } = useFloorsByBuilding(building.id);
  const { dismissed, getDismissed, setOptimistic } = useDismissed(building);
  const hasElevator = readBuildingObjectiveValueFacts(building.objectiveValueFacts).hasElevator;

  const suggestions = useMemo(
    () => (loading ? [] : suggestMissingCommonSpaces({ floors, hasElevator, existing: commonSpaces, dismissed })),
    [loading, floors, hasElevator, commonSpaces, dismissed],
  );

  const accept = useCallback((suggestion: CommonSpaceSuggestion) => {
    openPrefilled(draftFromSuggestion(suggestion, t(`categories.${suggestion.category}`)));
  }, [openPrefilled, t]);

  const dismiss = useCallback(async (suggestion: CommonSpaceSuggestion) => {
    const { key } = suggestion;
    const current = getDismissed();
    setOptimistic((keys) => [...keys, key]);
    try {
      await dismissCommonSpaceSuggestionWithPolicy({ buildingId: building.id, current, key });
    } catch (err) {
      setOptimistic((keys) => keys.filter((k) => k !== key));
      reportFailure(err, 'update', t('tab.notifications.failed'));
    }
  }, [building.id, getDismissed, setOptimistic, reportFailure, t]);

  return { suggestions, accept, dismiss };
}
