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

/** Οι επιλογές `1..ceiling` — **παράγονται** από ένα ταβάνι, ποτέ χειρόγραφη λίστα. */
export function stayCountChoices(ceiling: number): readonly number[] {
  return Array.from({ length: Math.max(0, Math.floor(ceiling)) }, (_, index) => index + 1);
}

/** Πόσα κατοικίδια — **παράγεται** από το ταβάνι του κατόχου, ποτέ δεύτερος χειρόγραφος αριθμός. */
export const STAY_PET_CHOICES: readonly number[] = stayCountChoices(STAY_PETS_CEILING);

/**
 * Οι επιλογές που **αποδίδονται**: αν η τιμή είναι εκτός λίστας, προστίθεται στη θέση της.
 *
 * 🔴 ADR-777 §8.60.21.7: ένα `<select>` με τιμή που δεν έχει `<option>` δείχνει την **πρώτη** επιλογή,
 * δηλαδή «δεν το έχω αποφασίσει», για ερώτηση που **έγινε** (π.χ. `?guests=12` με επιλογές 1–8, ή
 * άτομα πάνω από το μέγιστο της αγγελίας). Η οθόνη δεν λέει ποτέ ψέματα για την ερώτηση· το αν
 * «χωράει» το κρίνει ο διακομιστής.
 */
function renderedChoices(choices: readonly number[], value: number | null): readonly number[] {
  if (value === null || choices.includes(value)) return choices;
  return [...choices, value].sort((a, b) => a - b);
}

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
        {renderedChoices(choices, value).map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
    </div>
  );
}
