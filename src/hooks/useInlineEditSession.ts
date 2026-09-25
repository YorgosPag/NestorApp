/**
 * @fileoverview Η συνεδρία επιτόπιας επεξεργασίας μιας σελίδας λεπτομερειών: έναρξη · ακύρωση ·
 * αποθήκευση με ανάθεση · **επαναφορά όταν αλλάζει η επιλεγμένη οντότητα**. Το έγραφαν κατά λέξη
 * το `ParkingDetails` και το `StorageDetails` (CHECK 3.28).
 * @module hooks/useInlineEditSession
 */

import { useCallback, useEffect, useState } from 'react';
import { useDelegatedSave, type DelegatedSave } from './useDelegatedSave';

export interface InlineEditSession extends DelegatedSave {
  readonly isEditing: boolean;
  readonly setIsEditing: (editing: boolean) => void;
  readonly startEdit: () => void;
  readonly cancelEdit: () => void;
}

/** `resetKey` = η ταυτότητα της επιλεγμένης οντότητας· όταν αλλάζει, η επεξεργασία κλείνει. */
export function useInlineEditSession(resetKey: string | undefined): InlineEditSession {
  const [isEditing, setIsEditing] = useState(false);
  const save = useDelegatedSave();

  const startEdit = useCallback(() => setIsEditing(true), []);
  const cancelEdit = useCallback(() => setIsEditing(false), []);

  useEffect(() => {
    setIsEditing(false);
  }, [resetKey]);

  return { isEditing, setIsEditing, startEdit, cancelEdit, ...save };
}
