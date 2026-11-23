/**
 * @fileoverview **ΚΑΤΑΣΤΑΣΗ ΔΕΜΕΝΗ ΣΕ ΤΑΥΤΟΤΗΤΑ** — `useState` που ανήκει σε ένα `key` (π.χ. «επαφή Α»).
 * @module hooks/useKeyedState
 *
 * 🔴 **Γιατί υπάρχει (ADR-191, 2026-11-23)**: το `useEntityFiles` κρατούσε τα `files` χωρίς να ξέρει **ποιανού** είναι.
 *    Αλλαγή επαφής Α → Β με το ίδιο component ⇒ η λίστα της Β έδειχνε τα αρχεία της Α μέχρι να έρθει το νέο
 *    snapshot· και μια **καθυστερημένη** ανάγνωση της Α μπορούσε να γράψει **πάνω** στη λίστα της Β.
 *
 * Δύο εγγυήσεις:
 * 1. **Ανάγνωση**: τιμή γραμμένη για άλλο `key` δεν επιστρέφεται ποτέ — αντ' αυτής η αρχική του τρέχοντος.
 *    Χωρίς effect που «καθαρίζει» ⇒ ούτε ένα frame με ξένα δεδομένα.
 * 2. **Εγγραφή**: setter παλιού `key` (π.χ. από promise που επέστρεψε αργά) **αγνοείται** μόλις δεσμευτεί νέο `key`.
 *
 * Όπως το `key` prop του React, αλλά για **ένα** κομμάτι κατάστασης, χωρίς remount του component.
 */

import { useCallback, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

interface Slot<T> {
  readonly key: string;
  readonly value: T;
}

/** `initial` = η τιμή κάθε **νέου** `key` πριν γραφτεί οτιδήποτε γι' αυτό. */
export function useKeyedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [slot, setSlot] = useState<Slot<T>>(() => ({ key, value: initial }));
  const committedKey = useRef(key);
  const committedInitial = useRef(initial);
  useLayoutEffect(() => {
    committedKey.current = key;
    committedInitial.current = initial;
  }, [key, initial]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setSlot((prev) => {
      // Setter που δημιουργήθηκε για άλλη ταυτότητα από τη δεσμευμένη ⇒ καθυστερημένη εγγραφή, αγνοείται.
      if (key !== committedKey.current) return prev;
      const base = prev.key === key ? prev.value : committedInitial.current;
      const value = typeof action === 'function' ? (action as (current: T) => T)(base) : action;
      return { key, value };
    });
  }, [key]);

  return [slot.key === key ? slot.value : initial, setValue];
}
