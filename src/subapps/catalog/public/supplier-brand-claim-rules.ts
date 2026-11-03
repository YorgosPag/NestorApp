/**
 * @fileoverview **Η μηχανή καταστάσεων της κατοχής μάρκας** (ADR-923 §16). Καθαρή: πελάτης και διακομιστής.
 * @module subapps/catalog/public/supplier-brand-claim-rules
 *
 * 🔒 Έγκριση μόνο με λήξη στο μέλλον: κανένα δικαίωμα χωρίς ημερομηνία.
 * 🔒 Κατασκευαστής **ένας** ανά μάρκα, όπως στο Amazon Brand Registry, όπου αίτηση κάνει μόνο ο κάτοχος του σήματος. Αντιπρόσωποι πολλοί.
 *    Ληγμένος κάτοχος δεν εμποδίζει τον επόμενο.
 * 🔑 Η απόρριψη ανανέωσης αφήνει το `grant`: το δικαίωμα που ισχύει λήγει μόνο του. Η ανάκληση το σβήνει.
 */

import { normalizeSearchText } from '@/lib/search/search';

import type { PublicSupplierBrand, SupplierBrandClaimRecord, SupplierBrandGrant, SupplierBrandRelation } from '../types/supplier-brand-claim';

export type SupplierBrandRefusal = 'not-pending' | 'not-active' | 'expiry-required' | 'brand-held' | 'not-verified';

export type SupplierBrandTransition =
  | { readonly kind: 'next'; readonly record: SupplierBrandClaimRecord }
  | { readonly kind: 'refused'; readonly reason: SupplierBrandRefusal };

const refused = (reason: SupplierBrandRefusal): SupplierBrandTransition => ({ kind: 'refused', reason });

export function brandKeyOf(brandName: string): string {
  return normalizeSearchText(brandName);
}

/** Τέλος της ημέρας σε UTC: «ισχύς έως 31/12» καλύπτει όλη την ημέρα. */
export const validUntilOfDate = (date: string): string | null => (date === '' ? null : `${date}T23:59:59.000Z`);

/** Το δικαίωμα που ισχύει **τώρα**, ή `null`. Η λήξη δεν γράφεται πουθενά: αυτή η σύγκριση είναι όλη η λήξη. */
export function activeBrandGrant(record: Pick<SupplierBrandClaimRecord, 'grant'>, nowMs: number): SupplierBrandGrant | null {
  const { grant } = record;
  return grant !== null && Date.parse(grant.validUntil) > nowMs ? grant : null;
}

export interface SupplierBrandSubmission {
  readonly id: string;
  readonly companyId: string;
  readonly brandName: string;
  readonly relation: SupplierBrandRelation;
  readonly evidenceFileId: string;
  readonly nowIso: string;
}

export function submitBrandClaim(current: SupplierBrandClaimRecord | null, submission: SupplierBrandSubmission): SupplierBrandClaimRecord {
  const { id, companyId, brandName, relation, evidenceFileId, nowIso } = submission;
  return {
    id,
    companyId,
    brandName: brandName.trim(),
    brandKey: brandKeyOf(brandName),
    relation,
    evidenceFileId,
    status: 'pending-review',
    grant: current?.grant ?? null,
    createdAt: current?.status === 'pending-review' ? current.createdAt : nowIso,
    updatedAt: nowIso,
    decidedAt: null,
    decidedBy: null,
    reviewNote: null,
  };
}

export interface SupplierBrandDecision {
  readonly decision: 'approve' | 'reject';
  readonly reviewerUid: string;
  readonly note: string | null;
  readonly nowIso: string;
  readonly validUntil: string | null;
  /** Ο χώρος είναι επιβεβαιωμένη επιχείρηση σήμερα (§16: το τρίτο στάδιο πατά στο δεύτερο). */
  readonly verified: boolean;
  /** Άλλος χώρος κατέχει ενεργά τη μάρκα ως κατασκευαστής. */
  readonly heldByOther: boolean;
}

function approvalRefusal(current: SupplierBrandClaimRecord, input: SupplierBrandDecision): SupplierBrandRefusal | null {
  if (!input.verified) return 'not-verified';
  if (input.validUntil === null || !(Date.parse(input.validUntil) > Date.parse(input.nowIso))) return 'expiry-required';
  return current.relation === 'manufacturer' && input.heldByOther ? 'brand-held' : null;
}

export function decideBrandClaim(current: SupplierBrandClaimRecord, input: SupplierBrandDecision): SupplierBrandTransition {
  if (current.status !== 'pending-review') return refused('not-pending');
  const { reviewerUid, note, nowIso, validUntil } = input;
  const decided = { updatedAt: nowIso, decidedAt: nowIso, decidedBy: reviewerUid, reviewNote: note };
  if (input.decision === 'reject') return { kind: 'next', record: { ...current, ...decided, status: 'rejected' } };
  const obstacle = approvalRefusal(current, input);
  if (obstacle !== null || validUntil === null) return refused(obstacle ?? 'expiry-required');
  const grant: SupplierBrandGrant = { relation: current.relation, validUntil, grantedAt: nowIso, grantedBy: reviewerUid };
  return { kind: 'next', record: { ...current, ...decided, status: 'approved', grant } };
}

export function revokeBrandClaim(current: SupplierBrandClaimRecord, input: { readonly reviewerUid: string; readonly note: string | null; readonly nowIso: string }): SupplierBrandTransition {
  if (current.grant === null) return refused('not-active');
  const { reviewerUid, note, nowIso } = input;
  return { kind: 'next', record: { ...current, status: 'revoked', grant: null, updatedAt: nowIso, decidedAt: nowIso, decidedBy: reviewerUid, reviewNote: note } };
}

export function publicBrandsOf(records: readonly SupplierBrandClaimRecord[], nowMs: number): readonly PublicSupplierBrand[] {
  return records
    .flatMap((record) => {
      const grant = activeBrandGrant(record, nowMs);
      return grant === null ? [] : [{ brandName: record.brandName, relation: grant.relation }];
    })
    .sort((left, right) => left.brandName.localeCompare(right.brandName));
}
