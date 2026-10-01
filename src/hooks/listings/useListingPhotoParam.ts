'use client';

/**
 * @fileoverview 📍 **Η ανοιχτή φωτογραφία ΖΕΙ στη διεύθυνση** — `?photo=N` (ADR-897 Φ4).
 * @related lib/listings/listing-routes (`LISTING_PHOTO_PARAM` · `readListingPhotoParam`) · hooks/useUrlQuery
 * @module hooks/listings/useListingPhotoParam
 *
 * 🔑 **Μία πηγή αλήθειας — η διεύθυνση**, όχι `useState` + συγχρονισμός: σημείο στη σελίδα κατόψεων οδηγεί κατευθείαν στη
 *   φωτογραφία, η ανοιχτή φωτογραφία μοιράζεται ως σύνδεσμος, και το «πίσω» του περιηγητή δεν χρειάζεται δικό μας κώδικα.
 * ⚠️ `replaceState`, όχι `pushState`: η περιήγηση μέσα στο lightbox δεν γεμίζει το ιστορικό με 30 εγγραφές.
 * ⚠️ Ανάγνωση με `useUrlQuery`, **όχι** `useSearchParams` — το δεύτερο δεν βλέπει το `replaceState` στον dev (μετρημένο,
 *   ADR-777 §8.60.21.7).
 */

import { useCallback, useMemo } from 'react';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import { LISTING_PHOTO_PARAM, readListingPhotoParam } from '@/lib/listings/listing-routes';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

export function useListingPhotoParam(total: number): readonly [number | null, (index: number | null) => void] {
  const query = useUrlQuery();
  const openIndex = useMemo(() => readListingPhotoParam(query, total), [query, total]);
  const setOpenIndex = useCallback((index: number | null) => {
    replaceUrlSearchParams((params) => {
      if (index === null) params.delete(LISTING_PHOTO_PARAM);
      else params.set(LISTING_PHOTO_PARAM, String(index + 1));
    });
  }, []);
  return [openIndex, setOpenIndex] as const;
}
