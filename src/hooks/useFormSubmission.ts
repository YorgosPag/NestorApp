'use client';

/**
 * @fileoverview **SSoT: η υποβολή μιας φόρμας — ένας δρόμος, ένας φύλακας, μία φορά.**
 * @module hooks/useFormSubmission
 * @related ADR-598 §3 procurement · ADR-584 (CHECK 3.28) · ADR-221 (`getErrorMessage`)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-21: το `setSubmitting(true) … finally setSubmitting(false)` ήταν
 * γραμμένο με το χέρι σε **37** αρχεία (8 στο procurement), και το CHECK 3.28 έπιασε
 * δύο από αυτά ως δίδυμα. Κάθε αντίγραφο είχε τα ίδια δύο κενά:
 *
 * 1. **Ο φύλακας ζούσε μόνο στο `disabled` του κουμπιού.** Όποιος δρόμος παρέκαμπτε το
 *    κουμπί (το Enter μιας φόρμας που έχει κουμπί υποβολής) υπέβαλλε **χωρίς** έλεγχο.
 *    Εδώ ο `canSubmit` ελέγχεται **μέσα** στην υποβολή — όλοι οι δρόμοι περνούν από αυτόν.
 * 2. **Το «υποβάλλεται» ήταν state**, άρα φαινόταν μόνο μετά το επόμενο render: δύο Enter
 *    στο ίδιο tick = δύο εγγραφές. Εδώ το κλείδωμα είναι `ref`, ελέγχεται **σύγχρονα**.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `useActionState`** (React 19): βάζει τη δεύτερη υποβολή **σε ουρά** —
 * την εκτελεί μετά την πρώτη. Για «Δημιουργία» αυτό είναι ακριβώς η διπλή εγγραφή.
 * Εδώ η δεύτερη **απορρίπτεται** (idempotent), όπως το `isSubmitting` του React Hook Form.
 *
 * Το `onSuccess` ανήκει στον γονέα (κλείσιμο διαλόγου, πλοήγηση) και καλείται **πάντα**
 * μετά από επιτυχία· μόνο το **τοπικό** state δεν γράφεται αν το component έχει φύγει.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { getErrorMessage } from '@/lib/error-utils';

export interface UseFormSubmissionOptions<R> {
  /** Η ίδια η εργασία (αίτημα δικτύου, callback του γονέα). */
  readonly submit: () => Promise<R>;
  /** Επιτρέπεται υποβολή; Ελέγχεται σε ΚΑΘΕ δρόμο, όχι μόνο στο κουμπί. */
  readonly canSubmit: boolean;
  readonly onSuccess?: (result: R) => void;
  /** Έτοιμο (μεταφρασμένο) κείμενο όταν το σφάλμα δεν έχει δικό του μήνυμα. */
  readonly errorFallback: string;
}

export interface FormSubmission {
  readonly submitting: boolean;
  readonly error: string | null;
  /** Για `<form onSubmit>` — ή κλήση χωρίς γεγονός. Ζητά ΜΟΝΟ ό,τι χρησιμοποιεί. */
  readonly handleSubmit: (event?: Pick<FormEvent, 'preventDefault'>) => Promise<void>;
  readonly clearError: () => void;
}

export function useFormSubmission<R>({
  submit,
  canSubmit,
  onSuccess,
  errorFallback,
}: UseFormSubmissionOptions<R>): FormSubmission {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleSubmit = useCallback(async (event?: Pick<FormEvent, 'preventDefault'>): Promise<void> => {
    event?.preventDefault();
    if (inFlight.current || !canSubmit) return;

    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submit();
      onSuccess?.(result);
    } catch (caught) {
      if (mounted.current) setError(getErrorMessage(caught, errorFallback));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, [submit, canSubmit, onSuccess, errorFallback]);

  const clearError = useCallback(() => setError(null), []);

  return { submitting, error, handleSubmit, clearError };
}
