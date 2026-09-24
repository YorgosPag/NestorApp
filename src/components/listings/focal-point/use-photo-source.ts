'use client';

/**
 * **Το URL της φωτογραφίας για τον επεξεργαστή** — αμέσως, ή οκνηρά όταν ανοίξει ο διάλογος (ADR-880).
 *
 * ⚠️ **Οκνηρά**: το παλιό `media[]` κρατά μόνο μονοπάτι Storage, και μια λίστα 24 φωτογραφιών δεν πρέπει να
 * ζητά 24 υπογεγραμμένα URL για ένα κουμπί. Κάθε άνοιγμα ξαναζητά — τα υπογεγραμμένα URL λήγουν.
 *
 * 🔴 **Τρεις καταστάσεις, όχι δύο**: μια αποτυχημένη επίλυση είναι `failed`, **ποτέ** ατέρμονο «φορτώνει».
 * Η ακύρωση/σειρά απαντήσεων ανήκει στο SSoT `useAsyncData` (ADR-223) — εδώ δεν ξαναγράφεται.
 *
 * @module components/listings/focal-point/use-photo-source
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('use-photo-source');

export type PhotoSource =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly src: string }
  | { readonly kind: 'failed' };

const LOADING: PhotoSource = { kind: 'loading' };
const FAILED: PhotoSource = { kind: 'failed' };

export function usePhotoSource(
  open: boolean,
  src: string | undefined,
  resolveSrc: (() => Promise<string>) | undefined,
): PhotoSource {
  const lazy = useAsyncData<string>({
    fetcher: () => (resolveSrc === undefined ? Promise.reject(new Error('no resolver')) : resolveSrc()),
    enabled: open && src === undefined && resolveSrc !== undefined,
    onError: (message) => logger.warn('Το URL της φωτογραφίας δεν επιλύθηκε', { message }),
  });

  if (src !== undefined) return { kind: 'ready', src };
  if (resolveSrc === undefined) return FAILED;
  if (lazy.data !== null) return { kind: 'ready', src: lazy.data };
  return lazy.error === null ? LOADING : FAILED;
}
