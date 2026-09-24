'use client';

/**
 * **Ο ΙΔΙΟΣ ΑΡΙΘΜΗΤΙΚΟΣ ΑΞΟΝΑΣ, ΣΕ ΤΣΙΠ** — το συμπαγές πρόσωπο του {@link CriterionRangeField}.
 *
 * @related ADR-777 §8.80 · CriterionBarPopover · criterion-range-summary
 * @module components/search-results/filters/CriterionRangePopover
 *
 * 🔴 Μέχρι §8.80 τα εύρη (τιμή · υπνοδωμάτια) κάθονταν **ανοιχτά** στη γραμμή: δύο πεδία με
 * ετικέτες «Από/Έως» και λεζάντα από πάνω — τρεις σειρές ύψους για κάθε ερώτηση, πάνω από χάρτη.
 * Τώρα η γραμμή δείχνει **τη σύνοψη** («150 χιλ. € – 250 χιλ. €») και τα πεδία ανοίγουν από κάτω,
 * όπως στο «Price» της Zillow.
 *
 * 🔑 Το περιεχόμενο **δεν ξαναγράφεται**: μέσα ζει το **αυτούσιο** `CriterionRangeField` —
 * ίδια πεδία, ίδιο `boundOf`, ίδια άμεση γραφή στη διεύθυνση.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isAskedRange, NO_RANGE } from '@/lib/criteria/criterion-vocabulary';
import type { RangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { rangeOf, type ListingCriteria } from '@/lib/criteria/listing-criteria';

import { CriterionBarPopover } from './CriterionBarPopover';
import { CriterionRangeField } from './CriterionRangeField';
import { criterionRangeSummary } from './criterion-range-summary';
import type { FilterCommit } from './use-filter-commit';

interface CriterionRangePopoverProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: RangeCriterionKey;
  readonly commit: FilterCommit;
}

export function CriterionRangePopover({ criteria, criterionKey, commit }: CriterionRangePopoverProps) {
  const { t } = useTranslation(['search-filters', 'listing-detail']);
  const range = rangeOf(criteria, criterionKey) ?? NO_RANGE;

  return (
    <CriterionBarPopover
      axis={criterionLabel(t, criterionKey)}
      summary={criterionRangeSummary(t, criterionKey, range)}
      active={isAskedRange(range)}
    >
      <CriterionRangeField criteria={criteria} criterionKey={criterionKey} commit={commit} />
    </CriterionBarPopover>
  );
}
