/**
 * **Οι καταστάσεις της βιβλιοθήκης ως σήμα** — ένα σημείο για λέξη + παραλλαγή (ADR-928 Φ3γ-0 · ADR-771: λέξη, όχι μόνο
 * χρώμα). Ολικοί πίνακες: νέα κατάσταση χωρίς σήμα = σφάλμα μεταγλώττισης.
 * @module components/procurement/subcontracts/library/library-labels
 */

import type { SelectableListBadge } from '@/components/shared/lists/SelectableList';
import type { TranslationState } from '@/subapps/procurement/subcontracts/library/translation-status';
import { DEFAULT_LIBRARY_PROPOSER, type ClauseProfessionalReviewStatus, type ClauseVersionState } from '@/subapps/procurement/subcontracts/types/clause';

type Variant = SelectableListBadge['variant'];

export const VERSION_STATE_VARIANT: Readonly<Record<ClauseVersionState, Variant>> = {
  proposed: 'warning',
  approved: 'success',
  rejected: 'destructive',
  superseded: 'outline',
};

export const LEGAL_REVIEW_VARIANT: Readonly<Record<ClauseProfessionalReviewStatus, Variant>> = {
  needs_professional_review: 'outline',
  reviewed: 'secondary',
};

export const TRANSLATION_STATE_VARIANT: Readonly<Record<TranslationState, Variant>> = {
  approved: 'success',
  draft: 'warning',
  stale: 'destructive',
  missing: 'outline',
};

/** Ο προτείνων ως άνθρωπος ή ως «προτεινόμενη βιβλιοθήκη» — ποτέ ωμό `system:default-library`. */
export const isSystemProposer = (uid: string): boolean => uid === DEFAULT_LIBRARY_PROPOSER;

/** Τα uids ανθρώπων μιας λίστας (για `useUserDisplayNames`), χωρίς το σύστημα και χωρίς κενά. */
export function humanUidsOf(uids: readonly (string | null)[]): string[] {
  return [...new Set(uids.filter((uid): uid is string => uid !== null && uid.length > 0 && !isSystemProposer(uid)))];
}
