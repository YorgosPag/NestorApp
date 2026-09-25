/**
 * @fileoverview Αποθήκευση με ανάθεση: το header πατά «Αποθήκευση», η καρτέλα που κατέχει τη φόρμα
 * γράφει τον δικό της `handleSave` στο `saveRef`. Ένα μοτίβο για τις σελίδες λεπτομερειών
 * (κτίριο · θέση στάθμευσης · αποθήκη), γραμμένο μία φορά (CHECK 3.28).
 * @module hooks/useDelegatedSave
 */

import { useCallback, useRef, useState, type MutableRefObject } from 'react';

export type DelegatedSaveFn = () => Promise<boolean>;

export interface DelegatedSave {
  /** Η καρτέλα-κάτοχος της φόρμας καταχωρεί εδώ τον `handleSave` της. */
  readonly saveRef: MutableRefObject<DelegatedSaveFn | null>;
  readonly isSaving: boolean;
  readonly handleSave: () => Promise<void>;
}

export function useDelegatedSave(): DelegatedSave {
  const [isSaving, setIsSaving] = useState(false);
  const saveRef = useRef<DelegatedSaveFn | null>(null);

  const handleSave = useCallback(async () => {
    if (!saveRef.current) return;
    setIsSaving(true);
    try {
      await saveRef.current();
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { saveRef, isSaving, handleSave };
}
