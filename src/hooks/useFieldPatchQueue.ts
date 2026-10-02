'use client';

/**
 * @fileoverview **Ο React δέτης της σειριακής ουράς διορθώσεων** (ADR-898 Φ3β-2) — μία ουρά ανά έγγραφο, συνδρομή με
 * `useSyncExternalStore`, και προειδοποίηση πριν κλείσει η σελίδα όσο κάτι δεν έχει αποθηκευτεί (Google Docs).
 * @related `lib/async/field-patch-queue.ts` (η ουρά) · αδελφός του `useAutoSave` (ADR-248: ολόκληρο έγγραφο, debounce)
 * @module hooks/useFieldPatchQueue
 *
 * 🔑 **`sourceVersion` = η ταυτότητα της αλήθειας του αναγνώστη** (π.χ. το έγγραφο του listener). Όταν αλλάζει, ό,τι
 * επιβεβαίωσε ο server δεν χρειάζεται πια επικάλυψη.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import { clearUnsavedWork, markUnsavedWork } from '@/lib/app-version/unsaved-work-registry';
import {
  createFieldPatchQueue,
  type FieldPatchQueueSnapshot,
  type FieldPatchSend,
} from '@/lib/async/field-patch-queue';

export interface FieldPatchQueueHandle<P, R> extends FieldPatchQueueSnapshot<P, R> {
  readonly enqueue: (patch: P) => void;
  readonly retry: () => void;
  readonly dismissFailure: () => void;
}

export function useFieldPatchQueue<P extends object, R>(send: FieldPatchSend<P, R>, sourceVersion: unknown): FieldPatchQueueHandle<P, R> {
  // Η τελευταία `send` χωρίς νέα ουρά σε κάθε απόδοση (η ουρά ζει όσο η σελίδα).
  const sendRef = useRef(send);
  sendRef.current = send;
  const [queue] = useState(() => createFieldPatchQueue<P, R>((patch) => sendRef.current(patch)));
  const snapshot = useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.getSnapshot(),
    () => queue.getSnapshot(),
  );

  const firstSource = useRef(true);
  useEffect(() => {
    if (firstSource.current) {
      firstSource.current = false;
      return;
    }
    queue.sourceChanged();
  }, [queue, sourceVersion]);

  // Η προειδοποίηση στο κλείσιμο ΔΕΝ ζει εδώ: δηλώνουμε «υπάρχει δουλειά» στο μητρώο, και την
  // προειδοποίηση τη δίνει ο ΕΝΑΣ listener της `unsaved-work-guard` (ADR-860 §Ε3γ).
  const ownerId = `field-patch-queue:${useId()}`;
  const busy = snapshot.status === 'saving';
  useEffect(() => {
    if (busy) markUnsavedWork(ownerId);
    else clearUnsavedWork(ownerId);
  }, [busy, ownerId]);
  useEffect(() => () => clearUnsavedWork(ownerId), [ownerId]);

  return {
    ...snapshot,
    enqueue: (patch) => queue.enqueue(patch),
    retry: () => queue.retry(),
    dismissFailure: () => queue.dismissFailure(),
  };
}
