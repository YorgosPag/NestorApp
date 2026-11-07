'use client';

/**
 * @fileoverview **Οι προτάσεις κοινοχρήστων της καρτέλας** (ADR-931 §6.2 · Β2) — στοίβα ορόφων + γεγονότα κτιρίου +
 * ζωντανοί χώροι → `partitionCommonSpaceSuggestions` (ανοιχτές · απορριφθείσες που ισχύουν ακόμη)· αποδοχή =
 * προσυμπληρωμένος διάλογος, απόρριψη = μόνιμη στο κτίριο (με «Αναίρεση»), επαναφορά = μία ή όλες.
 * @related `lib/common-spaces/common-space-suggestion-dismissals.ts` (καθαρό) · `building-mutation-gateway.ts` (ο γραφέας)
 *   · `useOptimisticSuggestionDismissals.ts` (αισιόδοξη εικόνα + συμφιλίωση)
 * @module components/building-management/CommonSpacesTab/useCommonSpaceSuggestions
 *
 * 🔑 **Αισιόδοξα** (Gmail): η οθόνη αλλάζει αμέσως· αποτυχία ⇒ γυρίζει, με το μήνυμα της πόρτας.
 * 🔑 **Αναίρεση στο toast** (Gmail «Undo» · Google Ads «Undismiss»): η απόρριψη είναι μόνιμη, άρα ο δρόμος πίσω είναι
 *   ένα κλικ — η ίδια πόρτα επαναφοράς με τη λίστα «Απορριφθείσες».
 * 🔑 Όσο φορτώνει η στοίβα ορόφων ⇒ καμία πρόταση (όχι αναβόσβημα «λείπει κλιμακοστάσιο» πριν έρθουν οι όροφοι).
 */

import { useCallback, useMemo } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useMutationFailureFeedback } from '@/hooks/useMutationFailureFeedback';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import {
  partitionCommonSpaceSuggestions,
  RESTORE_ALL_COMMON_SPACE_SUGGESTIONS,
  type DismissedCommonSpaceSuggestionView,
} from '@/lib/common-spaces/common-space-suggestion-dismissals';
import type { CommonSpaceSuggestion } from '@/lib/common-spaces/common-space-suggestions';
import { readBuildingObjectiveValueFacts } from '@/lib/objective-value/building-objective-value-facts';
import {
  dismissCommonSpaceSuggestionWithPolicy,
  restoreCommonSpaceSuggestionsWithPolicy,
} from '@/services/building/building-mutation-gateway';
import type { Building } from '@/types/building/contracts';
import type { CommonSpace } from '@/types/common-space';

import { EMPTY_COMMON_SPACE_DRAFT, type CommonSpaceDraft } from './common-space-draft';
import { useOptimisticSuggestionDismissals, type OptimisticSuggestionDismissals } from './useOptimisticSuggestionDismissals';
import { useSuggestionUndoToasts } from './useSuggestionUndoToasts';

export interface CommonSpaceSuggestionsHandle {
  readonly suggestions: readonly CommonSpaceSuggestion[];
  /** Απορριφθείσες που θα ξαναγίνονταν πρόταση σήμερα — νεότερη πρώτη. */
  readonly dismissed: readonly DismissedCommonSpaceSuggestionView[];
  readonly accept: (suggestion: CommonSpaceSuggestion) => void;
  readonly dismiss: (suggestion: CommonSpaceSuggestion) => Promise<void>;
  readonly restore: (key: string) => Promise<void>;
  readonly restoreAll: () => Promise<void>;
}

/** Η πρόταση ως πρόχειρο φόρμας — κατηγορία, όροφος και όνομα από την ετικέτα της κατηγορίας (ορατά, διορθώσιμα). */
export function draftFromSuggestion(suggestion: CommonSpaceSuggestion, categoryLabel: string): CommonSpaceDraft {
  return { ...EMPTY_COMMON_SPACE_DRAFT, name: categoryLabel, category: suggestion.category, floorId: suggestion.floorId ?? '' };
}

/** Επαναφορά: αισιόδοξα → πόρτα → αποτυχία ⇒ η οθόνη γυρίζει στην αποθηκευμένη αλήθεια. */
function useRestore(buildingId: string, optimistic: OptimisticSuggestionDismissals) {
  const { t } = useTranslation('common-spaces');
  const reportFailure = useMutationFailureFeedback('CommonSpaceSuggestions');
  const { getDismissals, markRestored, forget } = optimistic;

  const run = useCallback(async (keys: readonly string[], all: boolean) => {
    if (keys.length === 0) return;
    markRestored(keys);
    try {
      await restoreCommonSpaceSuggestionsWithPolicy({ buildingId, restore: all ? RESTORE_ALL_COMMON_SPACE_SUGGESTIONS : keys });
    } catch (err) {
      forget(keys);
      reportFailure(err, 'update', t('tab.notifications.failed'));
    }
  }, [buildingId, markRestored, forget, reportFailure, t]);

  const restore = useCallback((key: string) => run([key], false), [run]);
  // `'all'` στον server: αδειάζει και κλειδιά που δεν αντιστοιχούν πια σε πρόταση (όροφος που σβήστηκε).
  const restoreAll = useCallback(() => run(getDismissals().map((record) => record.key), true), [run, getDismissals]);
  return { restore, restoreAll };
}

/** Απόρριψη: αισιόδοξα (με τον τρέχοντα άνθρωπο ως «ποιος») → πόρτα → toast με «Αναίρεση» (`useSuggestionUndoToasts`). */
function useDismiss(buildingId: string, optimistic: OptimisticSuggestionDismissals, restore: (key: string) => Promise<void>) {
  const { t } = useTranslation('common-spaces');
  const { user } = useAuth();
  const reportFailure = useMutationFailureFeedback('CommonSpaceSuggestions');
  const { dismissals, markDismissed, forget } = optimistic;
  const uid = user?.uid ?? '';
  const dismissedKeys = useMemo(() => new Set(dismissals.map((record) => record.key)), [dismissals]);
  const showUndo = useSuggestionUndoToasts(buildingId, dismissedKeys);

  return useCallback(async (suggestion: CommonSpaceSuggestion) => {
    const { key } = suggestion;
    markDismissed({ key, dismissedBy: uid, dismissedAt: nowISO() });
    try {
      await dismissCommonSpaceSuggestionWithPolicy({ buildingId, key });
    } catch (err) {
      forget([key]);
      reportFailure(err, 'update', t('tab.notifications.failed'));
      return;
    }
    showUndo({
      key,
      message: t('tab.suggestions.dismissedToast', { name: t(`categories.${suggestion.category}`) }),
      undoLabel: t('tab.suggestions.undo'),
      onUndo: () => { void restore(key); },
    });
  }, [buildingId, uid, markDismissed, forget, reportFailure, showUndo, restore, t]);
}

export function useCommonSpaceSuggestions(
  building: Building,
  commonSpaces: readonly CommonSpace[],
  openPrefilled: (draft: CommonSpaceDraft) => void,
): CommonSpaceSuggestionsHandle {
  const { t } = useTranslation('common-spaces');
  const { floors, loading } = useFloorsByBuilding(building.id);
  const optimistic = useOptimisticSuggestionDismissals(building.dismissedCommonSpaceSuggestions);
  const hasElevator = readBuildingObjectiveValueFacts(building.objectiveValueFacts).hasElevator;
  const { restore, restoreAll } = useRestore(building.id, optimistic);
  const dismiss = useDismiss(building.id, optimistic, restore);
  const { dismissals } = optimistic;

  const partition = useMemo(
    () => (loading
      ? { open: [], dismissed: [] }
      : partitionCommonSpaceSuggestions({ floors, hasElevator, existing: commonSpaces, dismissed: dismissals })),
    [loading, floors, hasElevator, commonSpaces, dismissals],
  );

  const accept = useCallback((suggestion: CommonSpaceSuggestion) => {
    openPrefilled(draftFromSuggestion(suggestion, t(`categories.${suggestion.category}`)));
  }, [openPrefilled, t]);

  return { suggestions: partition.open, dismissed: partition.dismissed, accept, dismiss, restore, restoreAll };
}
