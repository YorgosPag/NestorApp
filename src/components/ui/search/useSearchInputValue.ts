/**
 * useSearchInputValue — η ΜΙΑ κατεύθυνση ροής του `SearchInput`.
 *
 * 🔴 ΗΤΑΝ: δύο πηγές αλήθειας (`localValue` + `value`) με ΔΥΟ effects σε αντίθετες
 * κατευθύνσεις (`local → onChange`, `value → local`). Όταν αποκλίνουν στο ΙΔΙΟ commit,
 * κάθε effect αντιγράφει την ΑΛΛΗ τιμή ⇒ ανταλλάσσονται ατέρμονα. Μετρημένο ζωντανά
 * στις επαφές (ADR-332 D27 Β-ΙΙ, 2026-09-11): «ALF» ↔ «ALFA», «Maximum update depth
 * exceeded» ~1/s, ώσπου πάγωσε ο renderer. Και επειδή το `onChange` ήταν εξάρτηση
 * effect, κάθε νέα ταυτότητά του (inline handler) ξανάστελνε την τιμή χωρίς πράξη χρήστη.
 *
 * ✅ ΚΑΝΟΝΑΣ (React «You Might Not Need an Effect» — ειδοποίηση γονέα από το συμβάν):
 * 1. Ο γονέας μαθαίνει την τιμή ΜΟΝΟ από πράξη ανθρώπου, τη ΣΤΙΓΜΗ του συμβάντος
 *    (πληκτρολόγηση: debounce ή σύγχρονα με 0 · καθαρισμός: ΑΜΕΣΩΣ). Ποτέ από effect.
 * 2. Η εξωτερική τιμή υιοθετείται ΜΟΝΟ όταν ΔΕΝ είναι ηχώ της δικής μας τελευταίας
 *    εκπομπής — και τότε ακυρώνει την εκκρεμή (μπαγιάτικη) εκπομπή. Το effect γράφει
 *    ΜΟΝΟ τοπικά, δεν εκπέμπει ⇒ καμία ανάδραση, κανένας βρόχος.
 *
 * ⚠️ Υπόθεση: ο γονέας εφαρμόζει την τιμή που του δίνουμε στην ίδια παρτίδα (το σύνηθες
 * `setState`). Γονέας που την εφαρμόζει ασύγχρονα και ΚΑΘΥΣΤΕΡΗΜΕΝΑ μετά από νεότερη
 * εκπομπή θα διαβαζόταν ως «εξωτερική αλλαγή» — κανένας καλών δεν το κάνει σήμερα.
 *
 * @see src/components/ui/search/__tests__/search-input-flow.test.tsx (Σ1–Σ9)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

interface SearchInputValue {
  /** Αυτό που δείχνει το πεδίο. */
  localValue: string;
  /** Πληκτρολόγηση: τοπικά αμέσως, προς τον γονέα με debounce (σύγχρονα αν 0). */
  change: (next: string) => void;
  /** Καθαρισμός: ρητή πράξη ⇒ προς τον γονέα ΑΜΕΣΩΣ, ακόμη και με debounce. */
  clear: () => void;
}

export function useSearchInputValue(
  value: string,
  onChange: ((value: string) => void) | undefined,
  debounceMs: number,
): SearchInputValue {
  const [localValue, setLocalValue] = useState(value);
  const lastEmittedRef = useRef(value);

  const send = useCallback((next: string) => {
    lastEmittedRef.current = next;
    onChange?.(next);
  }, [onChange]);
  const debouncedSend = useDebouncedCallback(send, debounceMs);
  const { cancel } = debouncedSend;

  const emit = useCallback((next: string, immediate: boolean) => {
    cancel();
    if (immediate || debounceMs === 0) send(next);
    else debouncedSend(next);
  }, [cancel, debounceMs, debouncedSend, send]);

  useEffect(() => {
    if (value === lastEmittedRef.current) return; // ηχώ της δικής μας εκπομπής
    lastEmittedRef.current = value;
    cancel();
    setLocalValue(value);
  }, [value, cancel]);

  const change = useCallback((next: string) => {
    setLocalValue(next);
    emit(next, false);
  }, [emit]);

  const clear = useCallback(() => {
    setLocalValue('');
    emit('', true);
  }, [emit]);

  return { localValue, change, clear };
}
