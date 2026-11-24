'use client';

/**
 * 🏷️ **Οι λεζάντες των φωτογραφιών μιας αγγελίας γραφείου** — δήλωση στο `properties/{id}.publishedPhotoCaptions`.
 *
 * @related hooks/listings/useListingFocalPoints (το αδελφό hook, ίδιο σχήμα) · lib/listings/photo-caption
 *
 * 🔑 **Κανένα νέο hook-δίδυμο**: ο κύκλος ζωής (αισιόδοξη ενημέρωση, ένα PATCH, επαναφορά σε αποτυχία) είναι του
 * `usePropertyDeclaration`. Εδώ δηλώνεται **μόνο** ό,τι διαφέρει — πώς διαβάζεται, συγκρίνεται και γράφεται το πεδίο.
 */

import { useCallback } from 'react';

import {
  readDeclaredCaptions,
  sameDeclaredCaptions,
  withDeclaredCaption,
  type PhotoCaption,
} from '@/lib/listings/photo-caption';
import {
  usePropertyDeclaration,
  type PropertyDeclarationCodec,
  type PropertyDeclarationState,
} from '@/hooks/listings/useDeclaredFileIds';

type CaptionMap = ReadonlyMap<string, PhotoCaption>;

/** Σταθερό σε επίπεδο module — ο κωδικοποιητής δεν εξαρτάται από τίποτα της οθόνης. */
const CAPTIONS_CODEC: PropertyDeclarationCodec<CaptionMap> = {
  read: readDeclaredCaptions,
  equals: sameDeclaredCaptions,
  toWire: (value) => Object.fromEntries(value),
};

export interface ListingCaptions extends Pick<PropertyDeclarationState<CaptionMap>, 'saving' | 'failed'> {
  readonly captionOf: (fileId: string) => PhotoCaption | null;
  readonly setCaption: (fileId: string, caption: PhotoCaption | null) => Promise<void>;
}

export function useListingCaptions(propertyId: string, storedValue: unknown): ListingCaptions {
  const { declared, saving, failed, commit } = usePropertyDeclaration(
    propertyId,
    'publishedPhotoCaptions',
    storedValue,
    CAPTIONS_CODEC,
  );

  const captionOf = useCallback((fileId: string) => declared.get(fileId) ?? null, [declared]);
  const setCaption = useCallback(
    (fileId: string, caption: PhotoCaption | null) => commit(withDeclaredCaption(declared, fileId, caption)),
    [commit, declared],
  );

  return { captionOf, setCaption, saving, failed };
}
