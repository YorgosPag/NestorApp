'use client';
/**
 * **Ποια πηγή δείχνει τώρα η μικρογραφία;** — η κλιμάκωση σφαλμάτων πάνω στη λίστα του `thumbnailCandidatesOf`
 * (ADR-899 §4.1). Κάθε `onError` προχωρά **ένα** βήμα· στο τέλος `null` (ο καλών δείχνει εικονίδιο / σφάλμα).
 *
 * 🔑 Δεμένη στην **ταυτότητα** της λίστας (`thumbnailCandidatesKey`) ⇒ νέο αρχείο = ξανά από την αρχή, χωρίς effect
 * επαναφοράς. Ζούσε γραμμένη μέσα στο `FileThumbnail`· η κάρτα της γκαλερί (`MediaCard`) χρειάστηκε την ίδια (N.0.2).
 *
 * 🔁 **Παροδική αστοχία ≠ οριστική** (ADR-923 §5.10.4): όταν η λίστα **εξαντληθεί** και περιείχε πηγή `retryable`
 * (παράγωγο του server), ξαναζητείται η πρώτη τέτοια μετά από {@link THUMBNAIL_RETRY_DELAYS_MS} — η εφεδρεία
 * (`_thumb`) προηγείται πάντα της αναμονής, άρα η επανάληψη δεν καθυστερεί ποτέ μια διαθέσιμη εικόνα. Όσο η λίστα
 * είναι εξαντλημένη ο καλών **δεν** αποδίδει `<img>` (εικονίδιο) ⇒ η επανάληψη είναι πάντα **νέο** στοιχείο = νέο
 * αίτημα στο **ίδιο** URL, χωρίς «σκουπίδι» στο query που θα έσπαγε το ETag/`304` του ADR-899 §3.5.
 *
 * @module components/shared/files/use-thumbnail-candidate
 * @see components/shared/files/file-thumbnail-sources — η σειρά των πηγών
 */
import { useCallback, useEffect, useState } from 'react';

import { thumbnailCandidatesKey, type ThumbnailCandidate } from './file-thumbnail-sources';

/** Οπισθοχώρηση των επαναλήψεων — μετά την τελευταία, οριστικά εικονίδιο. Ο server δηλώνει `Retry-After: 1`. */
export const THUMBNAIL_RETRY_DELAYS_MS: readonly number[] = [2_000, 8_000];

export interface ThumbnailCandidateState {
  /** Η τρέχουσα πηγή — `null` όταν η λίστα είναι κενή ή εξαντλήθηκε. */
  readonly candidate: ThumbnailCandidate | null;
  /** Για το `onError` του `<img>`: επόμενη πηγή. */
  readonly handleError: () => void;
}

interface FailureState {
  readonly key: string;
  readonly index: number;
  readonly attempt: number;
}

export function useThumbnailCandidate(candidates: readonly ThumbnailCandidate[]): ThumbnailCandidateState {
  const key = thumbnailCandidatesKey(candidates);
  const [failure, setFailure] = useState<FailureState>({ key, index: 0, attempt: 0 });
  const current = failure.key === key ? failure : { key, index: 0, attempt: 0 };
  const { index, attempt } = current;
  const handleError = useCallback(() => {
    setFailure({ key, index: index + 1, attempt });
  }, [key, index, attempt]);

  const retryIndex = candidates.findIndex((candidate) => candidate.retryable === true);
  const exhausted = index >= candidates.length;
  const delay = THUMBNAIL_RETRY_DELAYS_MS[attempt];
  const shouldRetry = exhausted && retryIndex >= 0 && delay !== undefined;
  useEffect(() => {
    if (!shouldRetry) return undefined;
    const timer = setTimeout(() => setFailure({ key, index: retryIndex, attempt: attempt + 1 }), delay);
    return () => clearTimeout(timer);
  }, [shouldRetry, key, retryIndex, attempt, delay]);

  return { candidate: candidates[index] ?? null, handleError };
}
