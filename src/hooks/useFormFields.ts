'use client';

/**
 * useFormFields — κατάσταση φόρμας με έναν τυποποιημένο ενημερωτή πεδίου
 *
 * Το ζευγάρι `useState<FormState>` + `update(key, value)` ήταν γραμμένο αυτούσιο σε κάθε διάλογο
 * (συμβάσεις-πλαίσιο · υλικά)· το CHECK 3.28 το είδε (ADR-923 §5.11 «3γ», Βήμα 2). Ο ενημερωτής είναι
 * σταθερός (`useCallback`) και συναρτησιακός (`prev =>`), άρα δύο γρήγορες αλλαγές δεν χάνουν η μία την άλλη.
 *
 * @module hooks/useFormFields
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

export interface UseFormFieldsReturn<T> {
  readonly form: T;
  readonly setForm: Dispatch<SetStateAction<T>>;
  readonly update: <K extends keyof T>(key: K, value: T[K]) => void;
}

export function useFormFields<T extends object>(initial: T | (() => T)): UseFormFieldsReturn<T> {
  const [form, setForm] = useState<T>(initial);
  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);
  return { form, setForm, update };
}
