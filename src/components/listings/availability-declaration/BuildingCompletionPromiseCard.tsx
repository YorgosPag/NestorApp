'use client';

/**
 * **Η δημόσια υπόσχεση παράδοσης του κτιρίου** — δήλωση, πρόταση από το χρονοδιάγραμμα, έλεγχος απόκλισης (ADR-919 §11).
 *
 * @related ADR-919 §6 · §7 · §9 · services/construction-scheduling/completion-promise-check.ts
 *
 * 🔑 Ο γραφέας είναι ο **μόνος** `PATCH /api/buildings` (`updateBuildingWithPolicy`). Η επαναπροβολή των αγγελιών
 * γίνεται ήδη εκεί (βήμα 5, `buildingListingFactsChanged`), και η ιστορία/ειδοποίηση μετάθεσης στο βήμα 6. Αυτή η
 * κάρτα **μόνο** δηλώνει.
 *
 * 🔑 Η υπόσχεση που συγκρίνεται είναι ό,τι **θα δει το κοινό**, από τον **ίδιο** κανόνα με τον επιλυτή
 * (`presentableSchedule`), πάνω στην αισιόδοξη τιμή της αποθήκευσης — η σύγκριση δεν μένει πίσω από το κλικ.
 */

import React, { useCallback } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCurrentLocale } from '@/lib/intl-utils';
import type { AvailabilityDeclarationIntent } from '@/lib/listings/availability-declaration-write';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import { presentableSchedule } from '@/lib/listings/listing-availability';
import { isDeliveredBuildingStatus } from '@/constants/building-statuses';
import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { checkCompletionPromise, type CompletionPromiseCheck } from '@/services/construction-scheduling/completion-promise-check';
import { useCompletionForecast, type CompletionForecastState } from '@/components/building-management/hooks/useCompletionForecast';
import type { Building } from '@/types/building/contracts';
import { AvailabilityDeclarationCard } from './AvailabilityDeclarationCard';
import { CompletionScheduleComparison } from './CompletionScheduleComparison';
import { useAvailabilityDeclarationSave, type StoredDeclaration } from './useAvailabilityDeclarationSave';

const NS = ['building', 'common-shared'];

const NOT_YET_CHECKED: CompletionPromiseCheck = { proposal: null, proposalIsLowerBound: false, signals: [] };

function checkOf(state: CompletionForecastState, stored: StoredDeclaration, building: Building): CompletionPromiseCheck {
  if (state.status !== 'ready') return NOT_YET_CHECKED;
  return checkCompletionPromise({
    promise: presentableSchedule(stored),
    forecast: state.forecast,
    plannedCompletion: building.completionDate,
    delivered: isDeliveredBuildingStatus(building.status),
    today: state.today,
  });
}

export function BuildingCompletionPromiseCard({ building }: { readonly building: Building }) {
  const { t } = useTranslation(NS);
  const buildingId = String(building.id);
  const forecastState = useCompletionForecast(buildingId);
  const persist = useCallback(async (intent: AvailabilityDeclarationIntent) => {
    const result = await updateBuildingWithPolicy({ buildingId, updates: { completionDeclaration: intent } });
    return result.success;
  }, [buildingId]);
  const save = useAvailabilityDeclarationSave(building.completionDeclaration, persist);
  const promise = presentableSchedule(save.stored);
  const check = checkOf(forecastState, save.stored, building);

  return (
    <AvailabilityDeclarationCard
      idPrefix={`building-${buildingId}-promise`}
      title={t('building:availabilityPromise.buildingTitle')}
      hint={t('building:availabilityPromise.buildingHint')}
      save={save}
      today={forecastState.today}
      proposal={check.proposal === null ? null : { declaration: check.proposal, isLowerBound: check.proposalIsLowerBound }}
      schedule={
        <CompletionScheduleComparison
          planned={building.completionDate ?? null}
          forecast={forecastState.status === 'ready' ? forecastState.forecast : null}
          promisePhrase={promise === null ? null : availabilityPromisePhrase(promise, t, getCurrentLocale())}
          signals={check.signals}
        />
      }
    />
  );
}
