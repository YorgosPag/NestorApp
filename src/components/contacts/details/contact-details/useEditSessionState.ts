import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { nextEditSessionDiff } from '@/utils/contactForm/edit-session-diff';

/**
 * Κατάσταση συνεδρίας επεξεργασίας που κρατά **μόνο ό,τι διαφέρει από τη βάση** (ADR-323 · ADR-327 §8.5.4).
 *
 * Ίδιο σχήμα με το `useState` (`[diff, setDiff]`), ώστε κανένας καταναλωτής να μη χρειαστεί αλλαγή:
 * ο setter δέχεται ολόκληρη προβολή φόρμας ή updater, και ό,τι ισούται με τη βάση **δεν** μένει
 * στη διαφορά. Ο updater παίρνει τη συγχωνευμένη προβολή (βάση + αλλαγές). Η λογική: `edit-session-diff.ts`.
 */
export function useEditSessionState<T extends object>(
  baseline: T,
): readonly [Partial<T>, Dispatch<SetStateAction<Partial<T>>>] {
  const [diff, setDiff] = useState<Partial<T>>({});
  const setEditSession = useCallback((action: SetStateAction<Partial<T>>) => {
    setDiff((current) => nextEditSessionDiff(baseline, current, action));
  }, [baseline]);
  return [diff, setEditSession] as const;
}
