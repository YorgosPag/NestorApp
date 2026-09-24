'use client';

/**
 * **Η πρόταση του αυτόματου σημείου, όταν ο διάλογος ανοίξει** — μία κλήση ανά αρχείο ανά συνεδρία (ADR-880).
 *
 * 🔑 **Μνήμη σε επίπεδο module, κλειδί `διαμέρισμα:αρχείο`**: η απάντηση είναι ντετερμινιστική συνάρτηση των
 * bytes, άρα δεύτερο άνοιγμα του ίδιου διαλόγου δεν πληρώνει δεύτερη αποκωδικοποίηση στον διακομιστή. Η
 * **αποτυχία δεν** απομνημονεύεται — ένα πεσμένο δίκτυο δεν γίνεται μόνιμο «δεν ξέρω». Η ακύρωση και η σειρά
 * απαντήσεων ανήκουν στο SSoT `useAsyncData` (ADR-223).
 *
 * @module components/listings/focal-point/use-focal-point-suggestion
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import {
  fetchFocalPointSuggestion,
  type FocalPointSuggestion,
} from '@/services/filesystem/focal-point-suggestion.client';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

/** Ποιο αρχείο ρωτάμε — `null` όταν δεν υπάρχει `FileRecord` (παλιό `media[]` του ιδιώτη). */
export interface FocalPointSuggestionTarget {
  readonly fileId: string;
  readonly custody: CustodyKind;
}

export type FocalPointSuggestionState = FocalPointSuggestion | { readonly kind: 'loading' };

/** Η απάντηση **με το κλειδί της** — μια απάντηση για άλλο αρχείο δεν γίνεται ποτέ δεκτή. */
interface KeyedSuggestion {
  readonly key: string;
  readonly value: FocalPointSuggestion;
}

const remembered = new Map<string, FocalPointSuggestion>();

const UNAVAILABLE: FocalPointSuggestion = { kind: 'unavailable' };
const LOADING: FocalPointSuggestionState = { kind: 'loading' };

const keyOf = (target: FocalPointSuggestionTarget): string => `${target.custody}:${target.fileId}`;

async function ask(target: FocalPointSuggestionTarget): Promise<KeyedSuggestion> {
  const key = keyOf(target);
  const value = await fetchFocalPointSuggestion(target.fileId, target.custody);
  if (value.kind === 'ready') remembered.set(key, value);
  return { key, value };
}

export function useFocalPointSuggestion(
  target: FocalPointSuggestionTarget | null,
  active: boolean,
): FocalPointSuggestionState {
  const key = target === null ? null : keyOf(target);
  const known = key === null ? undefined : remembered.get(key);
  const lookup = useAsyncData<KeyedSuggestion>({
    fetcher: () => (target === null ? Promise.resolve({ key: '', value: UNAVAILABLE }) : ask(target)),
    deps: [key],
    enabled: active && key !== null && known === undefined,
  });

  if (key === null) return UNAVAILABLE;
  if (known !== undefined) return known;
  return lookup.data?.key === key ? lookup.data.value : LOADING;
}
