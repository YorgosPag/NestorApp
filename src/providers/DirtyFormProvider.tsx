'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearUnsavedWork, markUnsavedWork } from '@/lib/app-version/unsaved-work-registry';

interface DirtyFormContextValue {
  registerDirty: (formId: string) => void;
  clearDirty: (formId: string) => void;
  isAnyDirty: boolean;
  isDirty: (formId: string) => boolean;
  /** Μια φόρμα **δηλώνει παρουσία**: από εδώ και πέρα το «καμία αλλαγή» είναι δήλωση, όχι άγνοια (ADR-912 §12.5). */
  registerForm: (formId: string) => void;
  unregisterForm: (formId: string) => void;
  /** Υπάρχει έστω μία φόρμα που **ξέρει** να πει αν έχει αλλαγές; */
  hasForms: boolean;
}

const DirtyFormContext = createContext<DirtyFormContextValue | null>(null);

const EMPTY: ReadonlySet<string> = new Set();

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return ids.has(id) ? ids : new Set([...ids, id]);
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!ids.has(id)) return ids;
  const next = new Set(ids);
  next.delete(id);
  return next;
}

export function DirtyFormProvider({ children }: { children: ReactNode }) {
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(EMPTY);
  const [knownForms, setKnownForms] = useState<ReadonlySet<string>>(EMPTY);

  // Σταθερές ταυτότητες + idempotent: ένα effect που τις έχει στις εξαρτήσεις του δεν ξανατρέχει σε κάθε render του παρόχου.
  const registerDirty = useCallback((formId: string) => setDirtyForms((prev) => withId(prev, formId)), []);
  const clearDirty = useCallback((formId: string) => setDirtyForms((prev) => withoutId(prev, formId)), []);
  const registerForm = useCallback((formId: string) => setKnownForms((prev) => withId(prev, formId)), []);
  const unregisterForm = useCallback((formId: string) => setKnownForms((prev) => withoutId(prev, formId)), []);

  const isAnyDirty = dirtyForms.size > 0;

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

  const value = useMemo<DirtyFormContextValue>(() => ({
    registerDirty,
    clearDirty,
    isAnyDirty,
    isDirty: (formId: string) => dirtyForms.has(formId),
    registerForm,
    unregisterForm,
    hasForms: knownForms.size > 0,
  }), [registerDirty, clearDirty, isAnyDirty, dirtyForms, registerForm, unregisterForm, knownForms]);

  return (
    <DirtyFormContext.Provider value={value}>
      {children}
    </DirtyFormContext.Provider>
  );
}

export function useDirtyForm(): DirtyFormContextValue {
  const ctx = useContext(DirtyFormContext);
  if (!ctx) throw new Error('useDirtyForm must be used inside DirtyFormProvider');
  return ctx;
}

/**
 * **«Θα χαθούν αλλαγές αν φύγω;»** — για όποιον κρατά την έξοδο (ο ✕ του φύλλου κινητού, ADR-912 §12.5).
 *
 * `undefined` = καμία φόρμα εδώ μέσα δεν ξέρει να απαντήσει ⇒ ο καλών οφείλει να **ρωτήσει** τον άνθρωπο: το άγνωστο
 * δεν δηλώνει ποτέ «καθαρό». `null` πάροχος (εκτός εμβέλειας) είναι επίσης άγνωστο.
 */
export function useUnsavedEditsAnswer(): boolean | undefined {
  const ctx = useContext(DirtyFormContext);
  if (!ctx || !ctx.hasForms) return undefined;
  return ctx.isAnyDirty;
}

/**
 * **Η φόρμα δηλώνει αν έχει αλλαγές που δεν αποθηκεύτηκαν** — ΜΙΑ γραμμή, χωρίς να ξέρει ποιος θα ρωτήσει.
 *
 * 🔑 Μέσα σε `DirtyFormProvider` (π.χ. φύλλο κινητού) το μαθαίνει ο πάροχος, και από εκεί ο ✕ **και** το μητρώο
 *   `unsaved-work-registry`. Εκτός παρόχου (η ίδια φόρμα στη στήλη του desktop) γράφει **απευθείας** στο μητρώο ⇒ η
 *   φύλαξη `beforeunload` (ADR-860 §Ε3γ) ισχύει παντού. Δεν πετά ποτέ: μια φόρμα δεν ξέρει πού θα στηθεί.
 * 🔑 Ταυτότητα ανά **στιγμιότυπο** (`useId`): η ίδια φόρμα στήνεται δύο φορές (στήλη desktop + φύλλο κινητού), και το
 *   αντίγραφο που δεν επεξεργάζεται δεν πρέπει να σβήσει τη δήλωση εκείνου που επεξεργάζεται.
 */
export function useReportUnsavedEdits(dirty: boolean): void {
  const ctx = useContext(DirtyFormContext);
  const formId = `unsaved-edits:${useId()}`;
  const registerForm = ctx?.registerForm;
  const unregisterForm = ctx?.unregisterForm;
  const registerDirty = ctx?.registerDirty;
  const clearDirty = ctx?.clearDirty;

  useEffect(() => {
    if (!registerForm || !unregisterForm) return;
    registerForm(formId);
    return () => unregisterForm(formId);
  }, [formId, registerForm, unregisterForm]);

  useEffect(() => {
    const mark = registerDirty ?? markUnsavedWork;
    const clear = clearDirty ?? clearUnsavedWork;
    if (dirty) mark(formId);
    else clear(formId);
    return () => clear(formId);
  }, [dirty, formId, registerDirty, clearDirty]);
}
