/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΕΛΕΓΧΟΥ ΠΡΟΜΗΘΕΥΤΗ** (ADR-923 §5.13 Ε1α · Ε1γ).
 * @related subapps/catalog/public/supplier-review-transition.ts (οι μεταβάσεις) ·
 *   subapps/catalog/public/supplier-verification-route.ts (η διαλογή) ·
 *   services/ownership/ownership-verification-review.service.ts (το πρότυπο της ουράς)
 * @module server/catalog/supplier-review.server
 *
 * Ένα σημείο εισόδου για κάθε δρόμο εγγράφου: το {@link requestSupplierReview}. Η αυτόματη αποδοχή της Βεβαίωσης θα
 * μπει μπροστά του, χωρίς δεύτερο γραφέα.
 *
 * 🔑 **Εγκρίνεται ό,τι είδε ο άνθρωπος.** Αν τα στοιχεία του χώρου άλλαξαν μετά την αίτηση, η έγκριση αρνείται
 * (`facts-changed`): αλλιώς θα γραφόταν έγκριση που η επόμενη ανάγνωση ρίχνει σιωπηλά.
 *
 * 🔒 Το ΑΦΜ δεν φτάνει ποτέ στο έγγραφο, στο ιστορικό ή στα logs: μόνο το αποτύπωμά του, και αυτό δεν βγαίνει στην ουρά.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { judgeContainerFile } from '@/lib/files/container-file-verdict';
import { createModuleLogger } from '@/lib/telemetry';
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import {
  readCompanyTaxDeclaration,
  type CompanyTaxDeclarationRead,
} from '@/services/company/company-legal-identity';
import { isRegistryConfigured } from '@/services/company-registry/gemi-opendata.client';
import {
  readRegistryIdentityReport,
  type RegistryReportOutcome,
} from '@/services/company-registry/company-registry-verification.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  decideSupplierReview,
  revokeSupplierApproval,
  submitSupplierReview,
  type SupplierReviewRefusal,
  type SupplierReviewTransition,
} from '@/subapps/catalog/public/supplier-review-transition';
import { judgeSupplierStanding, sameSupplierFacts, taxBindingFromStored } from '@/subapps/catalog/public/supplier-standing';
import {
  routeAllowsApproval,
  routeOpensReview,
  routeSupplierVerification,
  routeWithoutRegistry,
  type SupplierVerificationRoute,
} from '@/subapps/catalog/public/supplier-verification-route';
import type {
  SupplierIdentityFacts,
  SupplierReviewRecord,
  SupplierReviewStatus,
  SupplierStanding,
  SupplierStandingRead,
} from '@/subapps/catalog/types/supplier-verification';
import type { RegistryIdentityJudgment, RegistryTaxBinding } from '@/types/company-registry';
import { revalidatePublicCompany } from './public/public-model-revalidate.server';
import { supplierTaxFingerprint } from './supplier-tax-fingerprint.server';

const logger = createModuleLogger('server/catalog/supplier-review');

const REVIEW_PAGE_SIZE = 50;
const PDF_CONTENT_TYPE = 'application/pdf';

/** Ό,τι έρχεται από έξω: εγχεόμενο, ώστε οι άγκυρες να μην αγγίζουν δίκτυο ή μυστικό. */
export interface SupplierReviewDeps {
  readonly readProfile: (companyId: string) => Promise<CompanyTaxDeclarationRead>;
  readonly readReport: (db: AdminFirestore, companyId: string) => Promise<RegistryReportOutcome>;
  readonly registryConfigured: () => boolean;
  readonly fingerprint: (taxId: string) => string;
}

export const LIVE_DEPS: SupplierReviewDeps = {
  readProfile: readCompanyTaxDeclaration,
  readReport: (db, companyId) => readRegistryIdentityReport(db, companyId),
  registryConfigured: () => isRegistryConfigured(),
  fingerprint: supplierTaxFingerprint,
};

export type SupplierReviewOutcome =
  | { readonly kind: 'done'; readonly status: SupplierReviewStatus }
  | {
      readonly kind: 'refused';
      readonly reason:
        | SupplierReviewRefusal
        | 'not-found'
        | 'profile-unavailable'
        | 'identity-incomplete'
        | 'route-closed'
        | 'evidence-refused'
        | 'facts-changed';
    };

type Refusal = Extract<SupplierReviewOutcome, { kind: 'refused' }>;
const refused = (reason: Refusal['reason']): Refusal => ({ kind: 'refused', reason });

interface SupplierSituation {
  readonly facts: SupplierIdentityFacts;
  readonly registry: RegistryIdentityJudgment;
  readonly taxBinding: RegistryTaxBinding;
  readonly route: SupplierVerificationRoute;
}

function factsOf(profile: CompanyTaxDeclarationRead, deps: SupplierReviewDeps): SupplierIdentityFacts {
  if (profile.kind !== 'present') return { legalName: null, gemiNumber: null, taxFingerprint: null };
  const { declaration, taxId } = profile;
  return {
    legalName: declaration.businessName,
    gemiNumber: declaration.gemiNumber,
    taxFingerprint: taxId !== null && isValidGreekVat(taxId) ? deps.fingerprint(taxId) : null,
  };
}

/** Η τρέχουσα αλήθεια του χώρου. `null` ⇒ δεν διαβάστηκε, άρα καμία κρίση. */
async function readSituation(
  db: AdminFirestore,
  companyId: string,
  current: SupplierReviewRecord | null,
  deps: SupplierReviewDeps,
): Promise<SupplierSituation | null> {
  const profile = await deps.readProfile(companyId);
  if (profile.kind === 'unavailable') return null;
  const report = await deps.readReport(db, companyId);
  if (report.kind !== 'report') return null;
  const facts = factsOf(profile, deps);
  const registry = report.report.judgment;
  const taxBinding = taxBindingFromStored(current?.taxBinding ?? null, facts);
  const route = routeSupplierVerification(registry, taxBinding);
  return { facts, registry, taxBinding, route: deps.registryConfigured() ? route : routeWithoutRegistry(route) };
}

const reviewRef = (db: AdminFirestore, companyId: string) => db.collection(COLLECTIONS.SUPPLIER_VERIFICATIONS).doc(companyId);

async function readRecord(db: AdminFirestore, companyId: string): Promise<SupplierReviewRecord | null> {
  const snap = await reviewRef(db, companyId).get();
  return snap.exists ? (snap.data() as SupplierReviewRecord) : null;
}

/** Το έγγραφο ανήκει σε αυτόν τον χώρο και σε αυτόν τον έλεγχο. Ξένο ≡ ανύπαρκτο. */
export async function evidenceAccepted(db: AdminFirestore, companyId: string, fileId: string): Promise<boolean> {
  const snap = await db.collection(COLLECTIONS.FILES).doc(fileId).get();
  const verdict = judgeContainerFile(fileId, snap.exists ? (snap.data() ?? null) : null, {
    owner: { kind: 'company', companyId },
    entityType: ENTITY_TYPES.SUPPLIER_VERIFICATION,
    entityId: companyId,
    contentType: PDF_CONTENT_TYPE,
  });
  return verdict.kind === 'accepted';
}

/** Κρίνει και γράφει μέσα στην ίδια συναλλαγή: δύο διαχειριστές δεν αποφασίζουν την ίδια αίτηση δύο φορές. */
async function transition(
  db: AdminFirestore,
  companyId: string,
  step: (current: SupplierReviewRecord | null) => SupplierReviewTransition | Refusal,
): Promise<{ readonly result: SupplierReviewTransition | Refusal; readonly previous: SupplierReviewStatus | null }> {
  const ref = reviewRef(db, companyId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data() as SupplierReviewRecord) : null;
    const result = step(current);
    if (result.kind === 'next') tx.set(ref, result.record);
    return { result, previous: current?.status ?? null };
  });
}

async function settle(
  outcome: Awaited<ReturnType<typeof transition>>,
  actorUid: string,
): Promise<SupplierReviewOutcome> {
  const { result, previous } = outcome;
  if (result.kind === 'refused') return refused(result.reason);
  const { record } = result;
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.SUPPLIER_VERIFICATION,
    entityId: record.companyId,
    entityName: record.submitted.legalName,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: previous, newValue: record.status }],
    performedBy: actorUid,
    performedByName: null,
    companyId: record.companyId,
  });
  return { kind: 'done', status: record.status };
}

export interface SupplierReviewRequest {
  readonly companyId: string;
  readonly actorUid: string;
  readonly evidenceFileId: string;
  readonly nowIso: string;
}

/** Η αίτηση του προμηθευτή: ο οργανισμός έρχεται από το `ctx` του route, ποτέ από το σώμα. */
export async function requestSupplierReview(
  db: AdminFirestore,
  input: SupplierReviewRequest,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierReviewOutcome> {
  const situation = await readSituation(db, input.companyId, await readRecord(db, input.companyId), deps);
  if (situation === null) return refused('profile-unavailable');
  const { facts, route } = situation;
  if (facts.legalName === null || facts.taxFingerprint === null) return refused('identity-incomplete');
  if (!routeOpensReview(route)) return refused('route-closed');
  if (!(await evidenceAccepted(db, input.companyId, input.evidenceFileId))) return refused('evidence-refused');

  const outcome = await transition(db, input.companyId, (current) =>
    submitSupplierReview(current, {
      companyId: input.companyId,
      submitted: facts,
      taxBinding: current?.taxBinding ?? null,
      evidenceFileId: input.evidenceFileId,
      nowIso: input.nowIso,
      approvalStillCovers: current?.approval != null && sameSupplierFacts(current.approval, facts),
    }),
  );
  return settle(outcome, input.actorUid);
}

export interface SupplierReviewAdminDecision {
  readonly companyId: string;
  readonly reviewerUid: string;
  readonly decision: 'approve' | 'reject';
  readonly note: string | null;
  readonly nowIso: string;
}

/** Τι εμποδίζει την έγκριση σήμερα. Με άρνηση, το `approvable` είναι πάντα `false`. */
async function approvalObstacle(
  db: AdminFirestore,
  record: SupplierReviewRecord,
  deps: SupplierReviewDeps,
): Promise<{ readonly refusal: Refusal | null; readonly approvable: boolean }> {
  const situation = await readSituation(db, record.companyId, record, deps);
  if (situation === null) return { refusal: refused('profile-unavailable'), approvable: false };
  if (!sameSupplierFacts(record.submitted, situation.facts)) return { refusal: refused('facts-changed'), approvable: false };
  return { refusal: null, approvable: routeAllowsApproval(situation.route) };
}

export async function decideSupplierVerification(
  db: AdminFirestore,
  input: SupplierReviewAdminDecision,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierReviewOutcome> {
  const record = await readRecord(db, input.companyId);
  if (record === null) return refused('not-found');
  const obstacle = input.decision === 'approve' ? await approvalObstacle(db, record, deps) : { refusal: null, approvable: false };
  if (obstacle.refusal !== null) return obstacle.refusal;

  const { reviewerUid, decision, note, nowIso } = input;
  const outcome = await transition(db, input.companyId, (current) =>
    current === null
      ? refused('not-found')
      : decideSupplierReview(current, { decision, reviewerUid, note, nowIso, approvable: obstacle.approvable }),
  );
  return settle(outcome, reviewerUid);
}

export interface SupplierApprovalRevocation {
  readonly companyId: string;
  readonly reviewerUid: string;
  readonly note: string | null;
  readonly nowIso: string;
}

export async function revokeSupplierVerification(
  db: AdminFirestore,
  input: SupplierApprovalRevocation,
): Promise<SupplierReviewOutcome> {
  const { reviewerUid, note, nowIso } = input;
  const outcome = await transition(db, input.companyId, (current) =>
    current === null ? refused('not-found') : revokeSupplierApproval(current, { reviewerUid, note, nowIso }),
  );
  if (outcome.result.kind === 'next') revalidatePublicCompany(input.companyId);
  return settle(outcome, reviewerUid);
}

const UNVERIFIED: SupplierStanding = { kind: 'unverified' };

const UNKNOWN: SupplierStandingRead = { kind: 'unknown' };

/**
 * **Ο αναγνώστης της επιβεβαίωσης με τρεις εκβάσεις**: `unknown` ⇒ δεν διαβάστηκε, ακόμη και λείπον μυστικό.
 * Όποια απόφαση αφαιρεί δεδομένα βασίζεται εδώ, και σε `unknown` δεν κάνει τίποτα.
 */
export async function readSupplierStandingOutcome(
  db: AdminFirestore,
  companyId: string,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierStandingRead> {
  try {
    const record = await readRecord(db, companyId);
    const situation = await readSituation(db, companyId, record, deps);
    if (situation === null) return UNKNOWN;
    const { registry, taxBinding, facts } = situation;
    const approval = record?.status === 'approved' ? record.approval : null;
    return { kind: 'known', standing: judgeSupplierStanding({ registry, taxBinding, facts, approval }) };
  } catch (error) {
    logger.warn('Η επιβεβαίωση προμηθευτή δεν διαβάστηκε', { companyId, error: getErrorMessage(error) });
    return UNKNOWN;
  }
}

/** Για σήμα και σελίδα: κλειστός εξ ορισμού. Η βλάβη κρύβει το σήμα, δεν το δίνει. */
export async function readSupplierStanding(
  db: AdminFirestore,
  companyId: string,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierStanding> {
  const read = await readSupplierStandingOutcome(db, companyId, deps);
  return read.kind === 'known' ? read.standing : UNVERIFIED;
}

/** Ό,τι βλέπει ο ίδιος ο προμηθευτής για τον χώρο του. `null` ⇒ δεν διαβάστηκε. */
export interface OwnSupplierReview {
  readonly status: SupplierReviewStatus | null;
  readonly routeKind: SupplierVerificationRoute['kind'];
  readonly canRequest: boolean;
  /** Ο δρόμος ανοίγει αίτηση, αλλά λείπει επωνυμία ή έγκυρο ΑΦΜ. Ρητό: το `!canRequest` δεν λέει ποτέ γιατί. */
  readonly identityIncomplete: boolean;
  readonly reviewNote: string | null;
  /**
   * Επιβεβαιωμένος **τώρα** (μητρώο ή έγκριση που καλύπτει ακόμη τα στοιχεία). Ο δρόμος (`routeKind`) λέει πώς **φτάνει** κανείς
   * στην επιβεβαίωση και μένει ίδιος μετά από αυτήν: χωρίς αυτό το πεδίο η οθόνη έγραφε «εγκρίθηκε» μαζί με «χρειάζεται έλεγχο».
   */
  readonly verified: boolean;
  /** Επιβεβαιωμένος χωρίς βιτρίνα: η δημοσίευση είναι ρητή πράξη του ίδιου. */
  readonly canPublish: boolean;
  readonly published: boolean;
}

export async function readOwnSupplierReview(
  db: AdminFirestore,
  companyId: string,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<OwnSupplierReview | null> {
  const record = await readRecord(db, companyId);
  const situation = await readSituation(db, companyId, record, deps);
  if (situation === null) return null;
  const { facts, route, registry, taxBinding } = situation;
  const stillCovered = record?.approval != null && sameSupplierFacts(record.approval, facts);
  const identityComplete = facts.legalName !== null && facts.taxFingerprint !== null;
  const approval = record?.status === 'approved' ? record.approval : null;
  const verified = judgeSupplierStanding({ registry, taxBinding, facts, approval }).kind === 'verified';
  const showcase = await db.collection(COLLECTIONS.SUPPLIER_SHOWCASES).doc(companyId).get();
  return {
    status: record?.status ?? null,
    routeKind: route.kind,
    canRequest: identityComplete && routeOpensReview(route) && !(record?.status === 'approved' && stillCovered),
    identityIncomplete: !identityComplete && routeOpensReview(route),
    reviewNote: record?.reviewNote ?? null,
    verified,
    canPublish: verified && !showcase.exists,
    published: showcase.exists,
  };
}

/** Ό,τι βλέπει ο άνθρωπος της ουράς. Ποτέ το αποτύπωμα ΑΦΜ. */
export interface SupplierReviewItem {
  readonly companyId: string;
  readonly legalName: string | null;
  readonly gemiNumber: string | null;
  readonly evidenceFileId: string;
  /** Κλεισμένη εταιρεία ή στοιχεία που άλλαξαν: χωρίς κουμπί έγκρισης. */
  readonly approvable: boolean;
  readonly createdAt: string;
}

async function reviewItemOf(db: AdminFirestore, record: SupplierReviewRecord, deps: SupplierReviewDeps): Promise<SupplierReviewItem> {
  const { approvable } = await approvalObstacle(db, record, deps);
  return {
    companyId: record.companyId,
    legalName: record.submitted.legalName,
    gemiNumber: record.submitted.gemiNumber,
    evidenceFileId: record.evidenceFileId,
    approvable,
    createdAt: record.createdAt,
  };
}

/** Ό,τι δείχνει η οθόνη: οι εκκρεμείς προς απόφαση, οι εγκεκριμένες προς ανάκληση. */
export type SupplierReviewListing = Extract<SupplierReviewStatus, 'pending-review' | 'approved'>;

/** Παλαιότερη πρώτη. */
export async function listSupplierReviews(
  db: AdminFirestore,
  status: SupplierReviewListing,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierReviewItem[]> {
  // tenant-scope-exempt: ουρά ΔΙΑΧΕΙΡΙΣΤΗ της πλατφόρμας — βλέπει ΟΛΟΥΣ τους χώρους εκ σχεδιασμού·
  // η διαδρομή επιτρέπεται μόνο σε `super_admin`.
  const snap = await db
    .collection(COLLECTIONS.SUPPLIER_VERIFICATIONS)
    .where('status', '==', status)
    .orderBy('createdAt', 'asc')
    .limit(REVIEW_PAGE_SIZE)
    .get();
  return Promise.all(snap.docs.map((doc) => reviewItemOf(db, doc.data() as SupplierReviewRecord, deps)));
}
