'use client';

/**
 * **Τα πρωτόγονα της φόρμας ζήτησης** — το λεξιλόγιο της Α9 πάνω στα κοινά.
 *
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · components/shared/forms/form-field-primitives
 * @module components/demand/form/demand-field-primitives
 *
 * 🔴 **Ο μηχανισμός εξήχθη (ADR-777 Α14, 2026-08-11)** στο
 * `components/shared/forms/form-field-primitives.tsx`: η φόρμα **προσφοράς** ζητά τα
 * **ίδια τρία** πρωτόγονα για **άλλο** λεξιλόγιο, και ένα δεύτερο αντίγραφο θα ήταν
 * κλώνος που μπλοκάρει το **CHECK 3.28** (N.0.2 — *«πρώτα φτιάξε το SSoT»*).
 *
 * 🔑 **Εδώ μένει ΜΟΝΟ το δέσιμο του τύπου**: τα κοινά συνάγουν το `TValues` από το
 * `control`, και αυτά τα τρία περιτυλίγματα το εγχέουν από το `useFormContext`, ώστε
 * οι **23 υπάρχουσες κλήσεις** των τριών αρχείων της Α9 να μη γράφουν `control={…}` σε
 * κάθε πεδίο. Η δημόσια επιφάνειά τους είναι **αμετάβλητη**.
 *
 * ⚠️ **Η φόρμα προσφοράς ΔΕΝ φτιάχνει δεύτερη σειρά περιτυλιγμάτων** — περνά το
 * `control` ρητά. Δύο σειρές θα ήταν το ίδιο σχήμα με άλλο όνομα, ακριβώς ό,τι αυτή η
 * εξαγωγή υπάρχει για να μη συμβεί.
 */

import React from 'react';
import { useFormContext, type Control, type FieldPath } from 'react-hook-form';

import {
  FormFieldset,
  FormInputField,
  FormOptionsField,
} from '@/components/shared/forms/form-field-primitives';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';

/** Το μονοπάτι ενός πεδίου της φόρμας ζήτησης — τυπωμένο, ποτέ `string`. */
export type DemandFieldName = FieldPath<DemandFormValues>;

/** Ο έλεγχος της φόρμας, χωρίς να τον περνά ο καθένας ως prop. */
export function useDemandForm(): Control<DemandFormValues> {
  return useFormContext<DemandFormValues>().control;
}

/** Ομάδα πεδίων με λεζάντα — δες {@link FormFieldset}. */
export const DemandFieldset = FormFieldset;

/** Αριθμητικό πεδίο «κενό = δεν το έθεσα» — δες {@link FormInputField}. */
export function DemandNumberField(props: {
  name: DemandFieldName;
  label: string;
  min?: number;
}): React.ReactElement {
  return <FormInputField<DemandFormValues> control={useDemandForm()} kind="number" {...props} />;
}

/** Επιλογή από κλειστό σύνολο — δες {@link FormOptionsField}. */
export function DemandOptionsField<T extends string>(props: {
  name: DemandFieldName;
  mode: 'single' | 'multiple';
  options: readonly T[];
  labelOf: (option: T) => string;
}): React.ReactElement {
  return <FormOptionsField<DemandFormValues, T> control={useDemandForm()} {...props} />;
}
