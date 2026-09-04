'use client';

/**
 * **ΕΝΑΣ ΑΡΙΘΜΗΤΙΚΟΣ ΑΞΟΝΑΣ** — δύο άκρα, καθένα προαιρετικό (ADR-777 §8.51).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΝΑΤΙΒ `<input type="number">` ΚΑΙ ΟΧΙ ΟΛΙΣΘΗΤΗΡΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `slider` **υπάρχει** στο `components/ui/` και **απορρίφθηκε**, με τρεις λόγους:
 *
 * 1. 🔴 **Ο ολισθητήρας χρειάζεται ΔΥΟ άκρα που δεν έχουμε.** Ένα εύρος τιμής θέλει
 *    γνωστό `min`/`max` — και τα δικά μας θα ήταν **του τρέχοντος καταλόγου**, δηλαδή
 *    θα **μετακινούνταν** σε κάθε αλλαγή φίλτρου. Ένα χειριστήριο που αλλάζει κλίμακα
 *    ενώ το κρατάς δεν είναι χειριστήριο.
 * 2. **Το ίδιο ιδίωμα με το `StayFilterFields`** *(«νατίβ `<input type="date">`, όχι
 *    βιβλιοθήκη ημερολογίου»)*, και για τον **ίδιο** γραμμένο λόγο: Α19 πρώτος καρές —
 *    μηδέν επιπλέον JavaScript στην **πιο δημόσια** οθόνη μας, και το πληκτρολόγιο με
 *    τον αναγνώστη οθόνης το ξέρουν ήδη.
 * 3. **Το Baymard μετρά ότι για τιμή τα πεδία κερδίζουν τον ολισθητήρα** — ο άνθρωπος
 *    που ξέρει ότι θέλει «ως 250.000» το **γράφει**· δεν το κυνηγά με το ποντίκι.
 *
 * ⚠️ **ΤΟ ΚΕΝΟ ΕΙΝΑΙ ΤΙΜΗ, ΟΧΙ ΑΠΟΥΣΙΑ ΕΛΕΓΧΟΥ.** Άδειο πεδίο ⇒ `null` ⇒ ο άξονας
 * **φεύγει** από τον χάρτη (`withRange` με κενό εύρος). Ένα `0` θα σήμαινε «φίλτρο 0»,
 * που φιλτράρει τα πάντα — το ακριβές ελάττωμα που ο `readFiniteNumber` αρνείται ρητά.
 *
 * 🔑 **Καμία `useState`**: το πεδίο διαβάζει από τα φίλτρα και γράφει στη διεύθυνση.
 */

import React, { useId } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NO_RANGE, type CriterionRange } from '@/lib/criteria/criterion-vocabulary';
import type { RangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { rangeOf } from '@/lib/criteria/listing-criteria';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';
import { cn } from '@/lib/utils';

import type { FilterCommit } from './use-filter-commit';

interface CriterionRangeFieldProps {
  readonly criteria: ListingCriteria;
  readonly criterionKey: RangeCriterionKey;
  readonly commit: FilterCommit;
  readonly className?: string;
}

/**
 * Κείμενο πεδίου → άκρο εύρους.
 *
 * ⚠️ **`''` ⇒ `null`, και `NaN` ⇒ `null`** — ποτέ `0`. Είναι ο **ίδιος** κανόνας με
 * τον `readFiniteNumber` της διεύθυνσης: δύο πόρτες, μία πολιτική.
 */
function boundOf(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function CriterionRangeField({
  criteria,
  criterionKey,
  commit,
  className,
}: CriterionRangeFieldProps) {
  const { t } = useTranslation(['search-filters', 'listing-detail']);
  const minId = useId();
  const maxId = useId();

  const range = rangeOf(criteria, criterionKey) ?? NO_RANGE;
  const axis = criterionLabel(t, criterionKey);

  const write = (next: CriterionRange): void => commit.setRange(criterionKey, next);

  return (
    <fieldset className={cn('flex flex-col gap-1', className)}>
      <legend className="text-sm font-medium text-foreground">{axis}</legend>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={minId} className="text-xs text-muted-foreground">
            {t('search-filters:filters.range.min')}
          </label>
          <input
            id={minId}
            type="number"
            inputMode="numeric"
            // ⚠️ Ορατή ετικέτα «Από» + **αόρατο πλήρες όνομα**: ο αναγνώστης οθόνης
            //    ακούει «Τιμή — από», όχι σκέτο «Από» τέσσερις φορές στη σειρά.
            aria-label={t('search-filters:filters.range.minLabel', { axis })}
            value={range.min === null ? '' : String(range.min)}
            onChange={(e) => write({ min: boundOf(e.target.value), max: range.max })}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={maxId} className="text-xs text-muted-foreground">
            {t('search-filters:filters.range.max')}
          </label>
          <input
            id={maxId}
            type="number"
            inputMode="numeric"
            aria-label={t('search-filters:filters.range.maxLabel', { axis })}
            value={range.max === null ? '' : String(range.max)}
            onChange={(e) => write({ min: range.min, max: boundOf(e.target.value) })}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>
      </div>
    </fieldset>
  );
}
