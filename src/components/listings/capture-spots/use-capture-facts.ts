'use client';

/**
 * @fileoverview 📷 **Τα στοιχεία λήψης φωτογραφιών** — μία κλήση ανά αρχείο ανά συνεδρία (ADR-897 Φ5).
 * @related services/filesystem/capture-facts.client · focal-point/use-focal-point-suggestion (ίδιο σχήμα μνήμης) ·
 *   use-north-estimate.ts (ο δεύτερος καταναλωτής της ΙΔΙΑΣ μνήμης)
 * @module components/listings/capture-spots/use-capture-facts
 *
 * 🔑 Μνήμη σε επίπεδο module, κλειδί `διαμέρισμα:αρχείο` — το EXIF δεν αλλάζει, άρα η δεύτερη ερώτηση για την ίδια
 *   φωτογραφία (επιλογή της **ή** εκτίμηση βορρά) δεν πληρώνει δεύτερη λήψη bytes στον διακομιστή.
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import { fetchCaptureFacts, type CaptureFactsSuggestion } from '@/services/filesystem/capture-facts.client';

const remembered = new Map<string, CaptureFactsSuggestion>();

const keyOf = (photoId: string, custody: CustodyKind): string => `${custody}:${photoId}`;

/**
 * **Η μία ανάγνωση με μνήμη** — `null` ⇒ δεν μπόρεσα να ρωτήσω. Η **αποτυχία δεν** απομνημονεύεται (ίδιο δόγμα με την
 * πρόταση εστίασης): ένα πεσμένο δίκτυο δεν γίνεται μόνιμο «δεν ξέρω».
 */
export async function loadCaptureFacts(photoId: string, custody: CustodyKind): Promise<CaptureFactsSuggestion | null> {
  const key = keyOf(photoId, custody);
  const known = remembered.get(key);
  if (known !== undefined) return known;
  const value = await fetchCaptureFacts(photoId, custody);
  if (value !== null) remembered.set(key, value);
  return value;
}

interface KeyedFacts {
  readonly key: string;
  readonly value: CaptureFactsSuggestion | null;
}

/** `null` ⇒ δεν ζητήθηκε ή δεν έφτασε ακόμη — ο επεξεργαστής κρατά την προεπιλογή, δεν περιμένει. */
export function useCaptureFacts(photoId: string | null, custody: CustodyKind, needed: boolean): CaptureFactsSuggestion | null {
  const key = photoId === null ? null : keyOf(photoId, custody);
  const known = key === null ? undefined : remembered.get(key);
  const lookup = useAsyncData<KeyedFacts>({
    fetcher: async () => {
      if (photoId === null || key === null) return { key: '', value: null };
      return { key, value: await loadCaptureFacts(photoId, custody) };
    },
    deps: [key],
    enabled: needed && key !== null && known === undefined,
  });
  if (key === null) return null;
  if (known !== undefined) return known;
  return lookup.data?.key === key ? lookup.data.value : null;
}
