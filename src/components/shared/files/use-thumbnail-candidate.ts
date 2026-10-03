'use client';
/**
 * **Ποια πηγή δείχνει τώρα η μικρογραφία;** — η κλιμάκωση σφαλμάτων πάνω στη λίστα του `thumbnailCandidatesOf`
 * (ADR-899 §4.1). Κάθε `onError` προχωρά **ένα** βήμα· στο τέλος `null` (ο καλών δείχνει εικονίδιο / σφάλμα).
 *
 * 🔑 Δεμένη στην **ταυτότητα** της λίστας (`thumbnailCandidatesKey`) ⇒ νέο αρχείο = ξανά από την αρχή, χωρίς effect
 * επαναφοράς. Ζούσε γραμμένη μέσα στο `FileThumbnail`· η κάρτα της γκαλερί (`MediaCard`) χρειάστηκε την ίδια (N.0.2).
 *
 * @module components/shared/files/use-thumbnail-candidate
 * @see components/shared/files/file-thumbnail-sources — η σειρά των πηγών
 */
import { useCallback, useState } from 'react';

import { thumbnailCandidatesKey, type ThumbnailCandidate } from './file-thumbnail-sources';

export interface ThumbnailCandidateState {
  /** Η τρέχουσα πηγή — `null` όταν η λίστα είναι κενή ή εξαντλήθηκε. */
  readonly candidate: ThumbnailCandidate | null;
  /** Για το `onError` του `<img>`: επόμενη πηγή. */
  readonly handleError: () => void;
}

export function useThumbnailCandidate(candidates: readonly ThumbnailCandidate[]): ThumbnailCandidateState {
  const key = thumbnailCandidatesKey(candidates);
  const [failure, setFailure] = useState({ key, index: 0 });
  const index = failure.key === key ? failure.index : 0;
  const handleError = useCallback(() => {
    setFailure({ key, index: index + 1 });
  }, [key, index]);
  return { candidate: candidates[index] ?? null, handleError };
}
