'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { hasUnsavedWorkFrom, subscribeUnsavedWork } from '@/lib/app-version/unsaved-work-registry';
import { PENDING_WRITES_OWNER } from '@/lib/firestore-pending-writes';
import { useConnectivity } from '@/hooks/useConnectivity';

/**
 * **Τι να πει η κεφαλίδα για τις αλλαγές του ανθρώπου** (ADR-367 §2.7).
 *
 * - `saving` — εκκρεμούν εγγραφές, υπάρχει σύνδεση: φεύγουν τώρα.
 * - `offline-pending` — εκκρεμούν εγγραφές, **χωρίς** σύνδεση: ζουν ΜΟΝΟ σε αυτή την καρτέλα.
 * - `offline` — χωρίς σύνδεση, τίποτα σε αναμονή: προειδοποίηση **πριν** γράψει.
 * - `saved` — μόλις έφυγαν όσα περίμεναν· φαίνεται `SAVED_VISIBLE_MS` και σβήνει.
 * - `idle` — τίποτα να πει: **καμία** ένδειξη (θόρυβος δεν είναι πληροφορία).
 *
 * 🔑 Αριθμός αλλαγών **δεν** υπάρχει: το SDK δεν εκθέτει το μέγεθος της ουράς του, μόνο
 * «άδεια / όχι άδεια» (`waitForPendingWrites`). Ό,τι δείχνουμε είναι αληθινό.
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'offline-pending';

export const SAVED_VISIBLE_MS = 3000;

export interface SaveStatusInput {
  readonly pending: boolean;
  readonly connected: boolean;
}

/** Καθαρή μετάβαση — ό,τι δεν εξαρτάται από χρόνο. Το `saved → idle` το κάνει ο hook. */
export function deriveSaveStatus(input: SaveStatusInput, previous: SaveStatus): SaveStatus {
  if (input.pending) return input.connected ? 'saving' : 'offline-pending';
  if (!input.connected) return 'offline';
  const justFlushed = previous === 'saving' || previous === 'offline-pending' || previous === 'saved';
  return justFlushed ? 'saved' : 'idle';
}

const hasPendingWrites = (): boolean => hasUnsavedWorkFrom(PENDING_WRITES_OWNER);
const noPendingWritesOnServer = (): boolean => false;

export function useSaveStatus(): SaveStatus {
  const pending = useSyncExternalStore(subscribeUnsavedWork, hasPendingWrites, noPendingWritesOnServer);
  const connected = useConnectivity();
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    setStatus((previous) => deriveSaveStatus({ pending, connected }, previous));
  }, [pending, connected]);

  useEffect(() => {
    if (status !== 'saved') return;
    const timer = window.setTimeout(() => setStatus('idle'), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  return status;
}
