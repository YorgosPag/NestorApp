import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΚΑΤΟΧΗΣ ΜΑΡΚΑΣ** (ADR-923 §16).
 * @related subapps/catalog/public/supplier-brand-claim-rules.ts (οι κρίσεις) · server/catalog/supplier-review.server.ts (το πρότυπο)
 * @module server/catalog/supplier-brand-claim.server
 *
 * 🔑 Το τρίτο στάδιο πατά στο δεύτερο: έγκριση μόνο σε επιβεβαιωμένη επιχείρηση, και βλάβη στην κρίση αρνείται, δεν εγκρίνει.
 * 🔒 Ο έλεγχος «άλλος κατασκευαστής» γίνεται **μέσα** στη συναλλαγή: δύο διαχειριστές δεν εγκρίνουν δύο κατασκευαστές μαζί.
 * 🔑 Κάθε αλλαγή δικαιώματος ακυρώνει τη μνήμη αμέσως μετά το commit και πριν από το ίχνος. Η λήξη φτάνει τη σελίδα το πολύ σε ένα παράθυρο.
 */

import type { Firestore as AdminFirestore, QueryDocumentSnapshot, Transaction } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicSupplierBrandClaimId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  activeBrandGrant,
  brandKeyOf,
  decideBrandClaim,
  publicBrandsOf,
  revokeBrandClaim,
  submitBrandClaim,
  type SupplierBrandRefusal,
  type SupplierBrandTransition,
} from '@/subapps/catalog/public/supplier-brand-claim-rules';
import { brandExpiryNoticeDue, withBrandExpiryNotice } from '@/subapps/catalog/public/supplier-brand-expiry';
import type {
  BrandExpiryNoticeStage,
  PublicSupplierBrand,
  SupplierBrandClaimRecord,
  SupplierBrandClaimStatus,
  SupplierBrandRelation,
} from '@/subapps/catalog/types/supplier-brand-claim';
import { revalidatePublicCompany } from './public/public-model-revalidate.server';
import { evidenceAccepted, LIVE_DEPS, readSupplierStandingOutcome, type SupplierReviewDeps } from './supplier-review.server';

export type SupplierBrandOutcome =
  | { readonly kind: 'done'; readonly status: SupplierBrandClaimStatus }
  | { readonly kind: 'refused'; readonly reason: SupplierBrandRefusal | 'not-found' | 'evidence-refused' | 'unavailable' };

const claims = (db: AdminFirestore) => db.collection(COLLECTIONS.SUPPLIER_BRAND_CLAIMS);
const nowMsOf = (nowIso: string): number => Date.parse(nowIso);

async function audited(record: SupplierBrandClaimRecord, previous: SupplierBrandClaimRecord | null, actorUid: string): Promise<SupplierBrandOutcome> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.SUPPLIER_BRAND_CLAIM,
    entityId: record.id,
    entityName: record.brandName,
    action: 'status_changed',
    changes: [
      { field: 'status', oldValue: previous?.status ?? null, newValue: record.status },
      { field: 'validUntil', oldValue: previous?.grant?.validUntil ?? null, newValue: record.grant?.validUntil ?? null },
    ],
    performedBy: actorUid,
    performedByName: null,
    companyId: record.companyId,
  });
  return { kind: 'done', status: record.status };
}

export interface SupplierBrandRequest {
  readonly companyId: string;
  readonly actorUid: string;
  readonly brandName: string;
  readonly relation: SupplierBrandRelation;
  readonly evidenceFileId: string;
  readonly nowIso: string;
}

export async function requestSupplierBrand(db: AdminFirestore, input: SupplierBrandRequest): Promise<SupplierBrandOutcome> {
  const { companyId, actorUid, brandName, relation, evidenceFileId, nowIso } = input;
  if (!(await evidenceAccepted(db, companyId, evidenceFileId))) return { kind: 'refused', reason: 'evidence-refused' };
  const id = generateDeterministicSupplierBrandClaimId(companyId, brandKeyOf(brandName));
  const ref = claims(db).doc(id);
  const { record, previous } = await db.runTransaction(async (tx) => {
    const current = ((await tx.get(ref)).data() as SupplierBrandClaimRecord | undefined) ?? null;
    const written = submitBrandClaim(current, { id, companyId, brandName, relation, evidenceFileId, nowIso });
    tx.set(ref, written);
    return { record: written, previous: current };
  });
  return audited(record, previous, actorUid);
}

/** Άλλος χώρος κατέχει **τώρα** τη μάρκα ως κατασκευαστής. Η ανάγνωση ζει στη συναλλαγή της έγκρισης. */
async function heldByOtherInTx(tx: Transaction, db: AdminFirestore, record: SupplierBrandClaimRecord, nowMs: number): Promise<boolean> {
  // Κρίση πλατφόρμας, από τη φύση της πέρα από τον έναν χώρο: το ερώτημα «έχει η μάρκα άλλον κατασκευαστή;». Μόνο `super_admin`.
  const holders = await tx.get(claims(db).where('brandKey', '==', record.brandKey));
  // Ένα έγγραφο ανά (χώρος, μάρκα): άλλο id στην ίδια μάρκα σημαίνει άλλος χώρος.
  return holders.docs.some((doc) => doc.id !== record.id && activeBrandGrant(doc.data() as SupplierBrandClaimRecord, nowMs)?.relation === 'manufacturer');
}

async function isVerified(db: AdminFirestore, companyId: string, deps: SupplierReviewDeps): Promise<boolean | null> {
  const read = await readSupplierStandingOutcome(db, companyId, deps);
  return read.kind === 'unknown' ? null : read.standing.kind === 'verified';
}

type ClaimStep = (current: SupplierBrandClaimRecord, tx: Transaction) => Promise<SupplierBrandTransition>;

async function transition(db: AdminFirestore, claimId: string, actorUid: string, step: ClaimStep): Promise<SupplierBrandOutcome> {
  const ref = claims(db).doc(claimId);
  const result = await db.runTransaction(async (tx) => {
    const current = ((await tx.get(ref)).data() as SupplierBrandClaimRecord | undefined) ?? null;
    if (current === null) return null;
    const next = await step(current, tx);
    if (next.kind === 'next') tx.set(ref, next.record);
    return { next, current };
  });
  if (result === null) return { kind: 'refused', reason: 'not-found' };
  if (result.next.kind === 'refused') return result.next;
  revalidatePublicCompany(result.next.record.companyId);
  return audited(result.next.record, result.current, actorUid);
}

export interface SupplierBrandAdminDecision {
  readonly claimId: string;
  readonly decision: 'approve' | 'reject';
  readonly reviewerUid: string;
  readonly note: string | null;
  readonly validUntil: string | null;
  readonly nowIso: string;
}

export async function decideSupplierBrand(db: AdminFirestore, input: SupplierBrandAdminDecision, deps: SupplierReviewDeps = LIVE_DEPS): Promise<SupplierBrandOutcome> {
  const { claimId, decision, reviewerUid, note, validUntil, nowIso } = input;
  const companyId = ((await claims(db).doc(claimId).get()).data() as SupplierBrandClaimRecord | undefined)?.companyId;
  if (companyId === undefined) return { kind: 'refused', reason: 'not-found' };
  const verified = decision === 'approve' ? await isVerified(db, companyId, deps) : false;
  if (verified === null) return { kind: 'refused', reason: 'unavailable' };
  return transition(db, claimId, reviewerUid, async (current, tx) => {
    const heldByOther = decision === 'approve' && current.relation === 'manufacturer' && (await heldByOtherInTx(tx, db, current, nowMsOf(nowIso)));
    return decideBrandClaim(current, { decision, reviewerUid, note, validUntil, nowIso, verified, heldByOther });
  });
}

export function revokeSupplierBrand(db: AdminFirestore, input: Pick<SupplierBrandAdminDecision, 'claimId' | 'reviewerUid' | 'note' | 'nowIso'>): Promise<SupplierBrandOutcome> {
  return transition(db, input.claimId, input.reviewerUid, async (current) => revokeBrandClaim(current, input));
}

/** Τα δικά του αιτήματα, για την οθόνη του χώρου. Η σημείωση του διαχειριστή του ανήκει· το αρχείο όχι: το ανέβασε ο ίδιος. */
export async function readOwnBrandClaims(db: AdminFirestore, companyId: string): Promise<readonly SupplierBrandClaimRecord[]> {
  const snap = await claims(db).where('companyId', '==', companyId).get();
  return snap.docs.map((doc) => doc.data() as SupplierBrandClaimRecord);
}

/** Μάρκες σε ισχύ, για τη δημόσια σελίδα. Ποτέ `evidenceFileId`, `validUntil` ή σημείωση. */
export async function readActiveSupplierBrands(db: AdminFirestore, companyId: string, nowMs: number): Promise<readonly PublicSupplierBrand[]> {
  return publicBrandsOf(await readOwnBrandClaims(db, companyId), nowMs);
}

export type SupplierBrandListing = Extract<SupplierBrandClaimStatus, 'pending-review' | 'approved'>;

/** Η ουρά της πλατφόρμας: παλαιότερο πρώτο. Με ταξινόμηση στη μνήμη, ώστε να μη χρειάζεται σύνθετος δείκτης. */
export async function listSupplierBrandClaims(db: AdminFirestore, status: SupplierBrandListing): Promise<readonly SupplierBrandClaimRecord[]> {
  // tenant-scope-exempt: η ουρά είναι της πλατφόρμας, μόνο `super_admin`.
  const snap = await claims(db).where('status', '==', status).limit(200).get();
  return snap.docs.map((doc) => doc.data() as SupplierBrandClaimRecord).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/**
 * Σημειώνει ότι το σκαλί λήξης `stage` **ειπώθηκε** (§16). CAS: ξανακρίνει το φρέσκο έγγραφο με την ίδια `asOf` και γράφει
 * μόνο αν το σκαλί οφείλεται ακόμη, άρα ανανέωση, ανάκληση ή δεύτερη σάρωση στο μεταξύ ⇒ καμία εγγραφή. Γράφεται μόνο το
 * `grant.expiryNotice`: λογιστική της ειδοποίησης, όχι αλλαγή της κατοχής, γι' αυτό χωρίς γραμμή ιστορικού και χωρίς
 * ακύρωση της δημόσιας μνήμης (η ειδοποίηση είναι η καταγραφή της).
 */
export async function recordBrandExpiryNotice(db: AdminFirestore, claimId: string, stage: BrandExpiryNoticeStage, asOf: string): Promise<boolean> {
  const ref = claims(db).doc(claimId);
  return db.runTransaction(async (tx) => {
    const current = ((await tx.get(ref)).data() as SupplierBrandClaimRecord | undefined) ?? null;
    if (current === null || current.grant === null || brandExpiryNoticeDue(current.grant, asOf) !== stage) return false;
    tx.update(ref, { grant: withBrandExpiryNotice(current.grant, stage) });
    return true;
  });
}

export interface BrandGrantPage {
  readonly records: readonly SupplierBrandClaimRecord[];
  /** Ο δρομέας της επόμενης σελίδας· `null` ⇒ τέλος. */
  readonly next: QueryDocumentSnapshot | null;
}

/**
 * Μία σελίδα των δικαιωμάτων που **μπορεί** να έχουν κάτι να πουν σήμερα: λήξη από `from` έως `until` (`validUntil`, ISO).
 * Κρίση πλατφόρμας, πάνω από τους χώρους. Ένα πεδίο εύρους, ταξινόμηση στο ίδιο πεδίο: ο αυτόματος δείκτης ενός πεδίου
 * αρκεί. Δρομέας στο έγγραφο (όχι στην τιμή), γιατί πολλά δικαιώματα λήγουν στο ίδιο `…T23:59:59.000Z`.
 */
export async function readBrandGrantsExpiringPage(
  db: AdminFirestore,
  window: { readonly from: string; readonly until: string },
  pageSize: number,
  after: QueryDocumentSnapshot | null,
): Promise<BrandGrantPage> {
  let query = claims(db).where('grant.validUntil', '>=', window.from).where('grant.validUntil', '<=', window.until).orderBy('grant.validUntil').limit(pageSize);
  if (after !== null) query = query.startAfter(after);
  // tenant-scope-exempt: η σάρωση λήξεων είναι της πλατφόρμας (cron), πάνω από όλους τους χώρους.
  const snap = await query.get();
  const next = snap.size === pageSize ? snap.docs[snap.size - 1] : null;
  return { records: snap.docs.map((doc) => doc.data() as SupplierBrandClaimRecord), next };
}

export async function readBrandClaim(db: AdminFirestore, claimId: string): Promise<SupplierBrandClaimRecord | null> {
  return ((await claims(db).doc(claimId).get()).data() as SupplierBrandClaimRecord | undefined) ?? null;
}
