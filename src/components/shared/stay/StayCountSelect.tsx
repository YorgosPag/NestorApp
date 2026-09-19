'use client';

/**
 * **Ένας επιλογέας πλήθους διαμονής** — άτομα ή κατοικίδια, με ρητό «δεν το έχω αποφασίσει».
 * @related ADR-777 §8.60.21 · §8.60.21.7 · components/search-results/StayFilterFields.tsx ·
 *   components/listing-detail/ListingStayBooking.tsx · components/stay-calendar/StayCalendarForms.tsx
 *
 * ⚠️ **Το «δεν το έχω αποφασίσει» είναι ΤΙΜΗ, όχι απουσία** (N.12). Χωρίς ρητή επιλογή, ο
 * επισκέπτης δεν θα μπορούσε να **ξε-ρωτήσει** — και το `null` σημαίνει «δεν ρωτήθηκε», ποτέ
 * «ένα» ή «μηδέν». Εξήχθη από την αναζήτηση όταν τον χρειάστηκαν **τρεις** οθόνες (αναζήτηση ·
 * σελίδα αγγελίας · χειροκίνητη κράτηση), ώστε να μη γεννηθούν δίδυμα (CHECK 3.28).
 */

import React, { useId } from 'react';

import { STAY_PETS_CEILING } from '@/lib/offers/offer-amount';

/** Πόσα κατοικίδια — **παράγεται** από το ταβάνι του κατόχου, ποτέ δεύτερος χειρόγραφος αριθμός. */
export const STAY_PET_CHOICES: readonly number[] = Array.from({ length: STAY_PETS_CEILING }, (_, index) => index + 1);

export function StayCountSelect({
  label,
  anyLabel,
  choices,
  value,
  onChange,
}: {
  readonly label: string;
  readonly anyLabel: string;
  readonly choices: readonly number[];
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
}): React.ReactElement {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="mt-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      >
        <option value="">{anyLabel}</option>
        {choices.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
    </div>
  );
}
