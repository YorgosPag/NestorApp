/**
 * @fileoverview **Η ΜΗΧΑΝΗ ΚΑΤΑΣΤΑΣΕΩΝ ΤΟΥ ΧΕΙΡΟΚΙΝΗΤΟΥ ΕΛΕΓΧΟΥ ΠΡΟΜΗΘΕΥΤΗ** (ADR-923 §5.13 Ε1α).
 * @module subapps/catalog/public/supplier-review-transition
 *
 * `pending-review → approved | rejected` · `approved → revoked`. Νέα αίτηση επιτρέπεται μετά από απόρριψη ή ανάκληση,
 * και μετά από έγκριση μόνο όταν αυτή έπαψε να ισχύει (άλλαξαν τα στοιχεία του χώρου).
 *
 * 🔑 Η έγκριση κρατά τα `submitted`, όσα είδε ο διαχειριστής. Αν τα στοιχεία άλλαξαν στο μεταξύ, η έγκριση
 * δεν καλύπτει τα νέα: το `judgeSupplierStanding` τη ρίχνει στην ανάγνωση.
 *
 * **Layering**: καθαρή — πελάτης και διακομιστής.
 */

import type {
  StoredTaxBinding,
  SupplierIdentityFacts,
  SupplierReviewRecord,
} from '@/subapps/catalog/types/supplier-verification';

export interface SupplierReviewSubmission {
  readonly companyId: string;
  readonly submitted: SupplierIdentityFacts;
  readonly taxBinding: StoredTaxBinding | null;
  readonly evidenceFileId: string;
  readonly nowIso: string;
  /** Η ισχύουσα έγκριση καλύπτει ακόμη τα σημερινά στοιχεία. */
  readonly approvalStillCovers: boolean;
}

export interface SupplierReviewDecision {
  readonly decision: 'approve' | 'reject';
  readonly reviewerUid: string;
  readonly note: string | null;
  readonly nowIso: string;
  /** Η διαλογή επιτρέπει έγκριση: κλεισμένη εταιρεία ποτέ. */
  readonly approvable: boolean;
}

export interface SupplierReviewRevocation {
  readonly reviewerUid: string;
  readonly note: string | null;
  readonly nowIso: string;
}

export type SupplierReviewRefusal = 'already-approved' | 'not-pending' | 'not-approvable' | 'not-approved';

export type SupplierReviewTransition =
  | { readonly kind: 'next'; readonly record: SupplierReviewRecord }
  | { readonly kind: 'refused'; readonly reason: SupplierReviewRefusal };

const refused = (reason: SupplierReviewRefusal): SupplierReviewTransition => ({ kind: 'refused', reason });
const next = (record: SupplierReviewRecord): SupplierReviewTransition => ({ kind: 'next', record });

export function submitSupplierReview(
  current: SupplierReviewRecord | null,
  submission: SupplierReviewSubmission,
): SupplierReviewTransition {
  if (current?.status === 'approved' && submission.approvalStillCovers) return refused('already-approved');
  return next({
    companyId: submission.companyId,
    status: 'pending-review',
    submitted: submission.submitted,
    taxBinding: submission.taxBinding,
    evidenceFileId: submission.evidenceFileId,
    approval: null,
    createdAt: current?.status === 'pending-review' ? current.createdAt : submission.nowIso,
    updatedAt: submission.nowIso,
    decidedAt: null,
    decidedBy: null,
    reviewNote: null,
  });
}

export function decideSupplierReview(
  current: SupplierReviewRecord,
  input: SupplierReviewDecision,
): SupplierReviewTransition {
  if (current.status !== 'pending-review') return refused('not-pending');
  const approve = input.decision === 'approve';
  if (approve && !input.approvable) return refused('not-approvable');
  return next({
    ...current,
    status: approve ? 'approved' : 'rejected',
    approval: approve ? current.submitted : null,
    updatedAt: input.nowIso,
    decidedAt: input.nowIso,
    decidedBy: input.reviewerUid,
    reviewNote: input.note,
  });
}

export function revokeSupplierApproval(
  current: SupplierReviewRecord,
  input: SupplierReviewRevocation,
): SupplierReviewTransition {
  if (current.status !== 'approved') return refused('not-approved');
  return next({
    ...current,
    status: 'revoked',
    approval: null,
    updatedAt: input.nowIso,
    decidedAt: input.nowIso,
    decidedBy: input.reviewerUid,
    reviewNote: input.note,
  });
}
