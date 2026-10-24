'use client';

/**
 * **Ο ΑΞΟΝΑΣ ΠΑΡΑΔΟΣΗΣ** (ADR-919 §12) — «Χτίζονται» και «Διαθέσιμο ως <τρίμηνο>», δύο ανεξάρτητα άκρα.
 *
 * 🔑 **Το «σήμερα» γράφεται στη διεύθυνση τη στιγμή του κλικ**, όχι στην απόδοση: ο κριτής δεν διαβάζει ρολόι, και
 * ένας κοινοποιημένος σύνδεσμος δείχνει τα ίδια αποτελέσματα (Α3). Ο σύνδεσμος της σελίδας περιοχής γράφει την ημέρα
 * του στιγμιότυπου στο ίδιο άκρο, οπότε φτάνει εδώ με το τετραγωνίδιο ήδη τσεκαρισμένο.
 *
 * 🏆 Η αγορά έχει μόνο το ναι/όχι (Rightmove «New home», Zillow «New construction»). Εδώ η υπόσχεση είναι δομημένη,
 * άρα ρωτιέται και το **πότε**. Οι ετικέτες βγαίνουν **μόνο** από το `availabilityPromisePhrase`, η τιμή είναι το
 * τέλος του τριμήνου: ακριβώς ό,τι κρίνει το `deliveredBy`.
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { todayLocalDate } from '@/lib/date-local';
import { getCurrentLocale } from '@/lib/intl-utils';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import { upcomingDeliveryQuarters } from '@/lib/listings/delivery-promise';
import type { DateBoundCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { dateBoundOf, type ListingCriteria } from '@/lib/criteria/listing-criteria';
import type { CriterionDateBound } from '@/lib/criteria/criterion-vocabulary';

import type { FilterCommit } from './use-filter-commit';

/** Πόσα τρίμηνα μπροστά προσφέρει ο επιλογέας: δύο χρόνια, ο ορίζοντας μιας τυπικής οικοδομής. */
const QUARTERS_AHEAD = 8;

/** Ο Radix δεσμεύει το `''` (CHECK 3.48): «οποτεδήποτε» έχει δικό του όνομα. */
const ANY_TIME = 'any';

const NO_BOUND: CriterionDateBound = { after: null, by: null };

interface CriterionDateBoundFieldProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: DateBoundCriterionKey;
  readonly commit: FilterCommit;
}

interface ByOption {
  readonly value: string;
  readonly label: string;
}

/** Τα τρίμηνα, και η ημέρα του συνδέσμου αν δεν είναι μία από αυτά (σύνδεσμος παλιότερος ή ζήτηση με δική της ημέρα). */
function useByOptions(by: string | null): readonly ByOption[] {
  const { t } = useTranslation(['common-shared']);
  return useMemo(() => {
    const locale = getCurrentLocale();
    const options = upcomingDeliveryQuarters(todayLocalDate(), QUARTERS_AHEAD).map((quarter) => ({
      value: quarter.window.end,
      label: availabilityPromisePhrase(quarter, t, locale),
    }));
    if (by === null || options.some((option) => option.value === by)) return options;
    const exact = availabilityPromisePhrase({ precision: 'day', window: { start: by, end: by } }, t, locale);
    return [{ value: by, label: exact }, ...options];
  }, [by, t]);
}

export function CriterionDateBoundField({ criteria, criterionKey, commit }: CriterionDateBoundFieldProps) {
  const { t } = useTranslation(['search-filters', 'listing-detail']);
  const bound = dateBoundOf(criteria, criterionKey) ?? NO_BOUND;
  const options = useByOptions(bound.by);
  const buildingId = `criterion-${criterionKey}-after`;

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{criterionLabel(t, criterionKey)}</legend>
      <span className="flex items-center gap-2">
        <Checkbox
          id={buildingId}
          checked={bound.after !== null}
          // 🔑 Η ημέρα διαβάζεται ΕΔΩ, στο συμβάν — ποτέ στην απόδοση.
          onCheckedChange={(state) =>
            commit.setDateBound(criterionKey, { ...bound, after: state === true ? todayLocalDate() : null })
          }
        />
        <label htmlFor={buildingId} className="cursor-pointer text-sm text-foreground">
          {t('search-filters:filters.delivery.building')}
        </label>
      </span>
      <Select
        value={bound.by ?? ANY_TIME}
        onValueChange={(value) => commit.setDateBound(criterionKey, { ...bound, by: value === ANY_TIME ? null : value })}
      >
        <SelectTrigger aria-label={t('search-filters:filters.delivery.by')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_TIME}>{t('search-filters:filters.delivery.anyTime')}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t('search-filters:filters.delivery.byOption', { date: option.label })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </fieldset>
  );
}
