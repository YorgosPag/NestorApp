'use client';

/**
 * **«Πότε και πόσοι;» ΩΣ ΤΣΙΠ** — οι ερωτήσεις διαμονής στη γραμμή, μόνο όπου έχουν νόημα.
 *
 * @related ADR-777 §8.80 · ADR-835 · StayFilterFields · stay-search-relevance
 * @module components/search-results/filters/StayFilterChip
 *
 * 🔴 Ως §8.80 το `StayFilterFields` ήταν **δεύτερη ολόκληρη γραμμή** της κεφαλίδας — δύο
 * ημερομηνίες, δύο επιλογείς και δύο παράγραφοι — σε **κάθε** αναζήτηση, και σε «Πώληση». Τώρα
 * είναι ένα τσιπ (πρότυπο Airbnb «Πότε · Ποιοι»), που **εμφανίζεται** μόνο όταν η αναζήτηση
 * περιέχει διαμονές ή υπάρχει ήδη ενεργή ερώτηση διαμονής (`staySearchRelevant`).
 *
 * 🔑 Τα πεδία και οι δύο παράγραφοι («δεν κρύβουμε ό,τι δεν ταιριάζει» · σκύλος βοήθειας) **δεν
 * χάθηκαν**: ζουν αυτούσια μέσα στο αναδυόμενο, εκεί όπου ο άνθρωπος παίρνει την απόφαση.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import type { ListingSearch } from '@/lib/listings/listing-filters';

import { StayFilterFields } from '../StayFilterFields';
import { CriterionBarPopover } from './CriterionBarPopover';
import { askedStayCount } from './stay-search-relevance';

interface StayFilterChipProps {
  readonly filters: ListingSearch;
}

export function StayFilterChip({ filters }: StayFilterChipProps) {
  const { t } = useTranslation(['short-stay', 'search-filters']);
  const axis = t('short-stay:legend');
  const asked = askedStayCount(filters);
  const stayWindow = filters.stayWindow;

  // Οι ημερομηνίες είναι η πιο πληροφοριακή σύνοψη· χωρίς αυτές, το όνομα της ερώτησης + ο αριθμός.
  const summary =
    stayWindow === null
      ? axis
      : t('search-filters:filters.range.summaryBoth', {
          min: formatCalendarDay(stayWindow.checkIn),
          max: formatCalendarDay(stayWindow.checkOut),
        });

  return (
    <CriterionBarPopover axis={axis} summary={summary} active={asked > 0} count={asked} contentClassName="w-[22rem]">
      <StayFilterFields filters={filters} />
    </CriterionBarPopover>
  );
}
