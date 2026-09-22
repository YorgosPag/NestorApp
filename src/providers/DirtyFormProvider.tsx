'use client';

import { createContext, useContext, useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { clearUnsavedWork, markUnsavedWork } from '@/lib/app-version/unsaved-work-registry';

interface DirtyFormContextValue {
  registerDirty: (formId: string) => void;
  clearDirty: (formId: string) => void;
  isAnyDirty: boolean;
  isDirty: (formId: string) => boolean;
}

const DirtyFormContext = createContext<DirtyFormContextValue | null>(null);

export function DirtyFormProvider({ children }: { children: ReactNode }) {
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(new Set());

  const registerDirty = (formId: string) =>
    setDirtyForms((prev) => new Set([...prev, formId]));

  const clearDirty = (formId: string) =>
    setDirtyForms((prev) => {
      const next = new Set(prev);
      next.delete(formId);
      return next;
    });

  const isAnyDirty = dirtyForms.size > 0;
  const isDirty = (formId: string) => dirtyForms.has(formId);

  // ADR-860 §Ε3β — καθρέφτισμα στο μητρώο χωρίς React, που ρωτά η ανάκαμψη φόρτωσης κώδικα
  // πριν ανανεώσει τη σελίδα μετά από deploy. Ένας ιδιοκτήτης ανά provider (όχι ανά φόρμα):
  // αρκεί το «υπάρχει κάτι», και το cleanup του unmount δεν αφήνει ορφανή εγγραφή.
  const ownerId = `dirty-form-provider:${useId()}`;
  useEffect(() => {
    if (isAnyDirty) markUnsavedWork(ownerId);
    else clearUnsavedWork(ownerId);
    return () => clearUnsavedWork(ownerId);
  }, [isAnyDirty, ownerId]);

  // Η προειδοποίηση στο κλείσιμο ΔΕΝ ζει πια εδώ: τη δίνει ο ΕΝΑΣ listener της
  // `unsaved-work-guard` (ADR-860 §Ε3γ), από το ίδιο μητρώο που γράφει το παραπάνω effect.

  return (
    <DirtyFormContext.Provider value={{ registerDirty, clearDirty, isAnyDirty, isDirty }}>
      {children}
    </DirtyFormContext.Provider>
  );
}

export function useDirtyForm(): DirtyFormContextValue {
  const ctx = useContext(DirtyFormContext);
  if (!ctx) throw new Error('useDirtyForm must be used inside DirtyFormProvider');
  return ctx;
}
