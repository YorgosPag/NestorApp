'use client';

/**
 * **ΕΝΑΣ ΑΞΟΝΑΣ ΣΤΑΘΜΗΣ** — «Όροφος από–έως» με επώνυμες στάθμες (ADR-903 §9 · ADR-900 §8 #2, 2β.3).
 *
 * 🔑 Πρότυπο Spitogatos / xe.gr: δύο λίστες διατεταγμένων στάθμεων (Υπόγειο < Ημιυπόγειο < Ισόγειο <
 * Υπερυψωμένο < Ημιώροφος < 1ος…), όχι αριθμοί — ο αριθμός μόνος δεν ξεχωρίζει ημιυπόγειο από υπόγειο.
 * Οι επιλογές και η διάταξη έρχονται από το **ένα** `lib/floor/floor-level-range` (ίδιες με τη φόρμα ζήτησης).
 *
 * ⚠️ **Νατίβ `<select>`, όχι Radix** — ίδιο σκεπτικό με το `CriterionRangeField` (νατίβ `<input>`): μηδέν
 * επιπλέον JavaScript στην **πιο δημόσια** οθόνη μας· το πληκτρολόγιο και ο αναγνώστης οθόνης το ξέρουν ήδη.
 * Το κενό είναι επιλογή («Αδιάφορο»), όχι απουσία ελέγχου.
 *
 * 🔑 **Καμία `useState`**: το πεδίο διαβάζει από τα φίλτρα και γράφει στη διεύθυνση.
 */

import React, { useId } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import type { LevelRangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { levelRangeIn, type ListingCriteria } from '@/lib/criteria/listing-criteria';
import {
  NO_LEVEL_RANGE,
  floorRangeOptions,
  isAskedLevelRange,
  levelBoundOfSelect,
  levelRangeSelectValues,
  type LevelEdge,
  type LevelRange,
} from '@/lib/floor/floor-level-range';
import { cn } from '@/lib/utils';

import { CriterionBarPopover } from './CriterionBarPopover';
import { criterionLevelRangeSummary } from './criterion-range-summary';
import type { FilterCommit } from './use-filter-commit';

interface CriterionLevelRangeProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: LevelRangeCriterionKey;
  readonly commit: FilterCommit;
  readonly className?: string;
}

const SELECT_CLASS =
  'mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground';

interface LevelEdgeSelectProps {
  readonly edge: LevelEdge;
  readonly range: LevelRange;
  readonly value: string;
  readonly axis: string;
  readonly onChange: (next: string) => void;
}

function LevelEdgeSelect({ edge, range, value, axis, onChange }: LevelEdgeSelectProps) {
  const { t } = useTranslation('search-filters');
  const floorLabel = useFloorLabel();
  const id = useId();
  const options = floorRangeOptions(range[edge], edge);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {t(`search-filters:filters.range.${edge}`)}
      </label>
      <select
        id={id}
        // ⚠️ Ορατή ετικέτα «Από» + **πλήρες όνομα** για τον αναγνώστη οθόνης («Όροφος — από»).
        aria-label={t(`search-filters:filters.range.${edge}Label`, { axis })}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">{t('search-filters:filters.range.any')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {floorLabel(option.ref)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CriterionLevelRangeField({ criteria, criterionKey, commit, className }: CriterionLevelRangeProps) {
  const { t } = useTranslation(['search-filters', 'listing-detail']);
  const range = levelRangeIn(criteria, criterionKey) ?? NO_LEVEL_RANGE;
  const values = levelRangeSelectValues(range);
  const axis = criterionLabel(t, criterionKey);

  const write = (edge: LevelEdge, next: string): void =>
    commit.setLevelRange(criterionKey, { ...range, [edge]: levelBoundOfSelect(next) });

  return (
    <fieldset className={cn('flex flex-col gap-1', className)}>
      <legend className="text-sm font-medium text-foreground">{axis}</legend>
      <div className="flex items-end gap-2">
        <LevelEdgeSelect edge="min" range={range} value={values.min} axis={axis} onChange={(v) => write('min', v)} />
        <LevelEdgeSelect edge="max" range={range} value={values.max} axis={axis} onChange={(v) => write('max', v)} />
      </div>
    </fieldset>
  );
}

/** Ο ίδιος άξονας σε τσιπ της γραμμής — το αυτούσιο πεδίο μέσα στο αναδυόμενο (ADR-777 §8.80). */
export function CriterionLevelRangePopover({ criteria, criterionKey, commit }: CriterionLevelRangeProps) {
  const { t } = useTranslation(['search-filters', 'listing-detail']);
  const floorLabel = useFloorLabel();
  const range = levelRangeIn(criteria, criterionKey) ?? NO_LEVEL_RANGE;

  return (
    <CriterionBarPopover
      axis={criterionLabel(t, criterionKey)}
      summary={criterionLevelRangeSummary(t, criterionKey, range, floorLabel)}
      active={isAskedLevelRange(range)}
    >
      <CriterionLevelRangeField criteria={criteria} criterionKey={criterionKey} commit={commit} />
    </CriterionBarPopover>
  );
}
