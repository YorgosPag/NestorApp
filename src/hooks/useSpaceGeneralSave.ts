'use client';

/**
 * useSpaceGeneralSave — the save handler of a space entity's general tab
 *
 * SSoT for the create-or-update dispatch every space general tab performs when
 * the header's save button fires: route to POST or PATCH depending on
 * `createMode`, turn a thrown error into a `false` result, and register the
 * handler on the parent-owned ref.
 *
 * Η αποτυχία **φαίνεται** (ADR-898 §21.6 Ε6): ως τις 2026-10-05 το `catch` έγραφε μόνο στο log και επέστρεφε `false`,
 * άρα η «Αποθήκευση» που αρνήθηκε ο server (π.χ. 409 «κτίριο άλλου έργου») δεν έλεγε τίποτα στον άνθρωπο. Περνά πλέον
 * από τον ΕΝΑ βοηθό αποτυχίας mutation: άρνηση πολιτικής ⇒ μεταφρασμένο toast, άλλο σφάλμα ⇒ γενικό toast + `error`.
 *
 * @module hooks/useSpaceGeneralSave
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { useMutationFailureFeedback } from '@/hooks/useMutationFailureFeedback';
import { useSaveHandlerRef, type SaveHandler } from '@/hooks/useSaveHandlerRef';

// ============================================================================
// TYPES
// ============================================================================

interface UseSpaceGeneralSaveConfig {
  /** Create mode: POST a new entity instead of PATCHing the existing one. */
  createMode: boolean;
  onCreate: SaveHandler;
  onUpdate: SaveHandler;
  /** Parent-owned ref the header's save button calls through. */
  onSaveRef?: MutableRefObject<SaveHandler | null>;
  /** The owning tab's module name — the failure is logged under it, not under this hook. */
  scope: string;
  /** Translated generic message, shown when the failure is not a known policy refusal. */
  failureMessage: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSpaceGeneralSave({
  createMode,
  onCreate,
  onUpdate,
  onSaveRef,
  scope,
  failureMessage,
}: UseSpaceGeneralSaveConfig): void {
  const reportFailure = useMutationFailureFeedback(scope);

  const handleSave = useCallback<SaveHandler>(async () => {
    try {
      return createMode ? await onCreate() : await onUpdate();
    } catch (err) {
      reportFailure(err, createMode ? 'create' : 'update', failureMessage);
      return false;
    }
  }, [createMode, onCreate, onUpdate, reportFailure, failureMessage]);

  // Register save ref for header delegation (SSoT hook)
  useSaveHandlerRef(onSaveRef, handleSave);
}
