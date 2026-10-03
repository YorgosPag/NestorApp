/**
 * **Η σύνοψη ενός εύρους, όπως τη διαβάζει ο άνθρωπος στο τσιπ** — «150 χιλ. € – 250 χιλ. €», «Υπνοδωμάτια: από 2».
 *
 * @related ADR-777 §8.80 · CriterionRangePopover · criteria-filter-groups (isPriceCriterionKey)
 * @module components/search-results/filters/criterion-range-summary
 *
 * 🔑 **Καθαρή συνάρτηση, δικό της αρχείο**: το «τι γράφει το κουμπί» είναι απόφαση με
 * άγκυρα, όχι λεπτομέρεια απόδοσης — και ελέγχεται χωρίς DOM.
 *
 * ⚠️ **Η τιμή ΔΕΝ χρειάζεται όνομα άξονα, οι υπόλοιποι ΝΑΙ.** Το «€» λέει ήδη ποια ερώτηση
 * απαντά (Zillow: «$300K–$500K»)· ένα σκέτο «από 2» όμως δεν λέει αν είναι υπνοδωμάτια ή
 * μπάνια, άρα ο άξονας μπαίνει μπροστά.
 *
 * ⚠️ **Συμπαγής σημειογραφία ΜΟΝΟ για ποσά** (`notation: 'compact'`): «150 χιλ. €» χωράει σε
 * τσιπ, «150.000,00 €» όχι. Οι μετρήσεις (υπνοδωμάτια, τ.μ.) μένουν ακέραιες.
 */
import type { TFunction } from 'i18next';

import { NO_RANGE, type CriterionRange } from '@/lib/criteria/criterion-vocabulary';
import type { LevelRangeCriterionKey, RangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { levelRangeSelectValues, type LevelRange } from '@/lib/floor/floor-level-range';
import { parseFloorRefKey, type FloorRef } from '@/lib/floor/floor-ref';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';

import { isPriceCriterionKey } from './criteria-filter-groups';

function formatBound(key: RangeCriterionKey, value: number): string {
  return isPriceCriterionKey(key)
    ? formatCurrency(value, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })
    : formatNumber(value);
}

/** Δύο **ήδη μορφοποιημένα** άκρα ⇒ κείμενο εύρους — ή `null` όταν κανένα δεν ρωτά. Ο ένας συνθέτης. */
function boundsText(t: TFunction, min: string | null, max: string | null): string | null {
  if (min !== null && max !== null) return t('search-filters:filters.range.summaryBoth', { min, max });
  if (min !== null) return t('search-filters:filters.range.summaryMin', { min });
  if (max !== null) return t('search-filters:filters.range.summaryMax', { max });
  return null;
}

/** Το εύρος χωρίς όνομα άξονα — ή `null` όταν ο άξονας δεν ρωτά. */
function rangeText(t: TFunction, key: RangeCriterionKey, range: CriterionRange): string | null {
  return boundsText(
    t,
    range.min === null ? null : formatBound(key, range.min),
    range.max === null ? null : formatBound(key, range.max),
  );
}

/**
 * Χωρίς ερώτηση ⇒ **σκέτο το όνομα του άξονα** — ποτέ «Τιμή: όλες», που θα διαβαζόταν ως
 * ενεργό φίλτρο (ίδιος κανόνας με το `CriterionValueSetPopover`).
 */
export function criterionRangeSummary(
  t: TFunction,
  key: RangeCriterionKey,
  range: CriterionRange = NO_RANGE,
): string {
  const axis = criterionLabel(t, key);
  const text = rangeText(t, key, range);
  if (text === null) return axis;
  return isPriceCriterionKey(key) ? text : t('search-filters:filters.range.summaryAxis', { axis, range: text });
}

/**
 * Η σύνοψη εύρους **στάθμης** (ADR-903 §9) — «Όροφος: Ημιυπόγειο – 3ος». Άκρο ολόκληρης στάθμης (παλιός
 * σύνδεσμος) ⇒ η ετικέτα της επιλογής που κρίνει το ίδιο (`levelSelectValue`), ίδια με όσα δείχνει ο επιλογέας.
 */
export function criterionLevelRangeSummary(
  t: TFunction,
  key: LevelRangeCriterionKey,
  range: LevelRange,
  floorLabel: (ref: FloorRef) => string,
): string {
  const axis = criterionLabel(t, key);
  const values = levelRangeSelectValues(range);
  const labelOf = (value: string): string | null => {
    const ref = value === '' ? null : parseFloorRefKey(value);
    return ref === null ? null : floorLabel(ref);
  };
  const text = boundsText(t, labelOf(values.min), labelOf(values.max));
  return text === null ? axis : t('search-filters:filters.range.summaryAxis', { axis, range: text });
}
