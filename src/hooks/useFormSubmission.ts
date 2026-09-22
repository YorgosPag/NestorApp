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

import { useCallback, useRef, useState, type FormEvent } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { getErrorMessage } from '@/lib/error-utils';

export interface UseFormSubmissionOptions<R> {
  /** Η ίδια η εργασία (αίτημα δικτύου, callback του γονέα). */
  readonly submit: () => Promise<R>;
  /** Επιτρέπεται υποβολή; Ελέγχεται σε ΚΑΘΕ δρόμο, όχι μόνο στο κουμπί. */
  readonly canSubmit: boolean;
  readonly onSuccess?: (result: R) => void;
  /** Έτοιμο (μεταφρασμένο) κείμενο όταν το σφάλμα δεν έχει δικό του μήνυμα. */
  readonly errorFallback: string;
  /**
   * Η επιτυχία οδηγεί σε **πλοήγηση** (`router.push`)· η σελίδα μένει ζωντανή ώσπου να
   * φύγει ⇒ το κλείδωμα ΔΕΝ ανοίγει, αλλιώς 2ο κλικ = 2η εγγραφή (Remix `navigation.state`,
   * React Hook Form `isSubmitSuccessful`). Σε αποτυχία ανοίγει πάντα.
   */
  readonly keepLockedOnSuccess?: boolean;
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
  keepLockedOnSuccess = false,
}: UseFormSubmissionOptions<R>): FormSubmission {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useMountedRef();

  const handleSubmit = useCallback(async (event?: Pick<FormEvent, 'preventDefault'>): Promise<void> => {
    event?.preventDefault();
    if (inFlight.current || !canSubmit) return;

    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    let release = true;
    try {
      const result = await submit();
      release = !keepLockedOnSuccess;
      onSuccess?.(result);
    } catch (caught) {
      release = true;
      if (mounted.current) setError(getErrorMessage(caught, errorFallback));
    } finally {
      if (release) {
        inFlight.current = false;
        if (mounted.current) setSubmitting(false);
      }
    }
  }, [submit, canSubmit, onSuccess, errorFallback, keepLockedOnSuccess]);

  const clearError = useCallback(() => setError(null), []);

  return { submitting, error, handleSubmit, clearError };
}
