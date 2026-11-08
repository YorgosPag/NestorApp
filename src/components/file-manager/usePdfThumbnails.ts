'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-3) — **Ο κάτοχος του store μικρογραφιών** (`pdf-thumbnail-store`): ένα ανά φορτωμένο έγγραφο,
 * καταστρέφεται (blob URLs, αποδόσεις σε εξέλιξη) όταν αλλάξει η ταυτότητα του αρχείου ή φύγει ο θεατής.
 *
 * Το `offerRendered` δίνεται στον ζωγράφο της κύριας σελίδας **πάντα** — η συγκομιδή δεν κοστίζει δίκτυο, άρα και με
 * κλειστό πάνελ η λίστα θα βρει έτοιμες όσες σελίδες έχει ήδη δει ο αναγνώστης.
 *
 * @module components/file-manager/usePdfThumbnails
 */

import { useCallback, useEffect, useState, type RefObject } from 'react';

import type { PdfDocProxy } from './pdf-canvas-config';
import { createPdfThumbnailStore, type PdfThumbnailStore } from './pdf-thumbnail-store';

export interface PdfThumbnails {
  readonly store: PdfThumbnailStore | null;
  readonly offerRendered: (page: number, rotation: number, canvas: HTMLCanvasElement) => void;
}

/** @param documentKey η ταυτότητα του αρχείου (`sourceIdentityOf`) · `null` όσο φορτώνει ⇒ κανένα store. */
export function usePdfThumbnails(docRef: RefObject<PdfDocProxy | null>, documentKey: string | null, enabled: boolean): PdfThumbnails {
  const [store, setStore] = useState<PdfThumbnailStore | null>(null);

  useEffect(() => {
    const doc = docRef.current;
    if (!enabled || !doc || documentKey === null) return;
    const created = createPdfThumbnailStore(doc);
    setStore(created);
    return () => {
      created.dispose();
      setStore((current) => (current === created ? null : current));
    };
  }, [docRef, documentKey, enabled]);

  const offerRendered = useCallback((page: number, rotation: number, canvas: HTMLCanvasElement) => {
    store?.offerRendered(page, rotation, canvas);
  }, [store]);

  return { store, offerRendered };
}
