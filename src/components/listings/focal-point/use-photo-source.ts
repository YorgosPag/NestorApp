'use client';

/**
 * **Η φωτογραφία του επεξεργαστή — από πού έρχεται και πότε** (ADR-880).
 *
 * 🔑 **Δύο προελεύσεις, μία ένωση**:
 * - `file` — υπάρχει `FileRecord` ⇒ τα bytes έρχονται από τον **φρουρούμενο** δρόμο
 *   (`downloadFileByIdWithPolicy`: μισθωτής + ορατότητα δοχείου, ADR-862 Φ0 Β8 — «το id νικά»), ποτέ από το
 *   μόνιμο `downloadUrl`. Μετρημένο 24/09: δημοσιευμένες φωτογραφίες γραφείου **χωρίς** `downloadUrl` έκρυβαν
 *   το χειριστήριο — ακριβώς εκείνες που ο κόσμος βλέπει.
 * - `storage` — παλιό `media[]` του ιδιώτη, μόνο μονοπάτι Storage (κανένα `FileRecord`).
 *
 * ⚠️ **Οκνηρά, μία φορά**: η λήψη γίνεται στο πρώτο άνοιγμα του διαλόγου και κρατιέται ως το unmount· μετά από
 * **αποτυχία**, το επόμενο άνοιγμα ξαναδοκιμάζει. Μια λίστα 24 φωτογραφιών δεν κατεβάζει τίποτα για ένα κουμπί.
 *
 * 🔴 **Τρεις καταστάσεις, όχι δύο**: αποτυχία = `failed`, **ποτέ** ατέρμονο «φορτώνει». Σειρά απαντήσεων και
 * unmount ανήκουν στο SSoT `useAsyncData` (ADR-223).
 *
 * @module components/listings/focal-point/use-photo-source
 */

import { useEffect, useRef } from 'react';

import { useAsyncData } from '@/hooks/useAsyncData';
import { ownerPropertyMediaUrl } from '@/hooks/owner-property/useOwnerPropertyMedia';
import { createModuleLogger } from '@/lib/telemetry';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import { downloadFileByIdWithPolicy } from '@/services/filesystem/file-mutation-gateway';

const logger = createModuleLogger('use-photo-source');

/** Από πού διαβάζεται η φωτογραφία. */
export type FocalPointPhoto =
  | { readonly kind: 'file'; readonly fileId: string; readonly custody: CustodyKind }
  | { readonly kind: 'storage'; readonly storagePath: string };

export type PhotoSource =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly src: string }
  | { readonly kind: 'failed' };

const LOADING: PhotoSource = { kind: 'loading' };
const FAILED: PhotoSource = { kind: 'failed' };

const keyOf = (photo: FocalPointPhoto): string =>
  photo.kind === 'file' ? `file:${photo.custody}:${photo.fileId}` : `storage:${photo.storagePath}`;

async function resolvePhoto(photo: FocalPointPhoto): Promise<string> {
  if (photo.kind === 'storage') return ownerPropertyMediaUrl(photo.storagePath);
  return URL.createObjectURL(await downloadFileByIdWithPolicy(photo.fileId, photo.custody));
}

/** Το `objectURL` κρατά το blob ζωντανό — ανακαλείται όταν αντικατασταθεί ή φύγει το component. */
function useRevokeObjectUrl(url: string | null): void {
  useEffect(() => () => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }, [url]);
}

export function usePhotoSource(open: boolean, photo: FocalPointPhoto): PhotoSource {
  const key = keyOf(photo);
  const loadedKey = useRef<string | null>(null);
  const lazy = useAsyncData<{ readonly key: string; readonly src: string }>({
    fetcher: async () => ({ key, src: await resolvePhoto(photo) }),
    deps: [key],
    enabled: open && loadedKey.current !== key,
    onError: (message) => logger.warn('Η φωτογραφία του επεξεργαστή δεν φορτώθηκε', { message }),
  });
  const ready = lazy.data?.key === key ? lazy.data.src : null;
  if (ready !== null) loadedKey.current = key;
  useRevokeObjectUrl(lazy.data?.src ?? null);

  if (ready !== null) return { kind: 'ready', src: ready };
  return lazy.error === null ? LOADING : FAILED;
}
