'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

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

  useEffect(() => {
    if (!isAnyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAnyDirty]);

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
