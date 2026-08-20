'use client';

/**
 * @fileoverview **Η βιτρίνα ενός ακινήτου** — φωτογραφίες + PDF, έτοιμα να φύγουν.
 * @related ADR-312 §9.16-9.17 · ADR-777 §8.30
 * @module features/property-detail-surface/usePropertyShowcase
 *
 * Εξήχθη **αυτούσιο** από το `PropertiesSidebar` όταν η επιφάνεια λεπτομέρειας
 * απέκτησε **δεύτερο** σημείο προσάρτησης (η σελίδα `/properties/[id]`, §8.30).
 * Καμία αλλαγή συμπεριφοράς — μόνο ιδιοκτησία: η προετοιμασία της βιτρίνας είναι
 * **άλλη ευθύνη** από τη ζωγραφική της καρτέλας, και ο χωρισμός είναι ο λόγος που
 * και τα δύο μένουν κάτω από τα όρια του N.7.1.
 *
 * ⚠️ **Οι φωτογραφίες φορτώνονται ΜΟΝΟ στο άνοιγμα.** Μια καρτέλα ακινήτου που
 * κατεβάζει τη γκαλερί κάθε φορά που την κοιτάς πληρώνει ένα δίκτυο για κάτι που
 * ίσως δεν ζητηθεί ποτέ — και τώρα που τα σημεία προσάρτησης είναι **δύο**, το
 * κόστος θα διπλασιαζόταν σιωπηλά.
 */

import { useCallback, useEffect, useState } from 'react';

import type { Property } from '@/types/property-viewer';

/** Το φορτίο που η βιτρίνα ετοιμάζει πριν σταλεί. */
interface ShowcasePreSubmitResult {
  readonly showcaseMeta: {
    readonly pdfStoragePath: string;
    readonly pdfRegeneratedAt: string;
  };
}

export interface PropertyShowcase {
  readonly isOpen: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly photos: readonly string[];
  readonly preSubmit: () => Promise<ShowcasePreSubmitResult>;
}

/**
 * **Οι πραγματικές φωτογραφίες του ακινήτου, και το PDF του — κατ' απαίτηση.**
 *
 * Χωρίς τη γκαλερί, το `UnifiedShareDialog` δεν έχει τι να δώσει στο
 * `PhotoPickerGrid` και **κάθε** αποστολή Telegram/WhatsApp πέφτει στην εφεδρεία
 * «μόνο σύνδεσμος» (ADR-312 §9.16) — αστοχία που *φαίνεται* να δουλεύει.
 */
export function usePropertyShowcase(property: Property | null): PropertyShowcase {
  const [isOpen, setOpen] = useState(false);
  const [photos, setPhotos] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!isOpen || !property) {
      setPhotos([]);
      return;
    }

    const propertyId = property.id;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(
          `/api/properties/${encodeURIComponent(propertyId)}/photos`,
          { method: 'GET', credentials: 'include' },
        );
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        const found = payload?.data?.photos ?? payload?.photos;
        if (!cancelled && Array.isArray(found)) {
          setPhotos(
            found
              .map((p: { url?: string }) => p.url)
              .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0),
          );
        }
      } catch {
        // Μη μπλοκάρον: ο διάλογος δουλεύει και σε λειτουργία «μόνο σύνδεσμος».
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, property]);

  const preSubmit = useCallback(async (): Promise<ShowcasePreSubmitResult> => {
    if (!property) throw new Error('No property selected');

    const res = await fetch(
      `/api/properties/${encodeURIComponent(property.id)}/showcase/pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'el' }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    const payload = await res.json();
    const data = payload?.data ?? payload;
    return {
      showcaseMeta: {
        pdfStoragePath: data.pdfStoragePath as string,
        pdfRegeneratedAt: data.pdfRegeneratedAt as string,
      },
    };
  }, [property]);

  return { isOpen, setOpen, photos, preSubmit };
}
