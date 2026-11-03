import 'server-only';

/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΥΠΕΡΓΟΛΑΒΙΑΣ (ADR-928 Φ1 · CHECK 3.113)
 * =============================================================================
 *
 * Κάθε γραφή σε `subcontract_*` περνά από εδώ: **μία** συναλλαγή, **ένας** έλεγχος ιδιοκτησίας (ξένο ≡ ανύπαρκτο),
 * **ένας** CAS (`revision`), **ένα** ίχνος ιστορικού ανά αλλαγή **μετά** το commit. Οι γραφείς (`clause-library-writer`,
 * `trade-template-writer`, σπορά) κρατούν μόνο τους κανόνες του τομέα τους.
 *
 * 🔑 **Γιατί όχι είδος της μηχανής καταλόγου** (ADR-923 §5.9): εκείνη σηματοδοτεί όψεις τιμών και δημόσιες προβολές και
 * τη φυλά η πύλη 3.106· η υπεργολαβία είναι άλλος τομέας. Ίδιο μοτίβο με τον ξεχωριστό store της σχέσης προμήθειας
 * (`supply-relationship-store.server.ts`).
 *
 * ⚠️ **Firestore: όλες οι αναγνώσεις ΠΡΙΝ από κάθε εγγραφή μέσα στη συναλλαγή** — γι' αυτό `read*` και `stage*` είναι
 * χωριστά, και ο γραφέας διαβάζει, κρίνει, και μόνο τότε σκηνοθετεί.
 * 🔑 Χρόνος = ISO 8601 `string` (ADR-663 §4 · ADR-928 Φ1 απόφαση 1).
 * @module server/subcontracts/subcontract-store.server
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import type { AuditEntityType } from '@/config/audit-entity-registry';
import {
  SUBCONTRACT_AGREEMENT_REVISION_TRACKED_FIELDS,
  SUBCONTRACT_AGREEMENT_TRACKED_FIELDS,
  SUBCONTRACT_CLAUSE_TRACKED_FIELDS,
  SUBCONTRACT_CLAUSE_VERSION_TRACKED_FIELDS,
  SUBCONTRACT_TRADE_TEMPLATE_TRACKED_FIELDS,
} from '@/config/audit-tracked-fields-subcontracts';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuthContext } from '@/lib/auth';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isAddressableDocId } from '@/lib/firestore/doc-id';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { revisionAfterWrite } from '@/subapps/catalog/aggregate/aggregate-members';
import type { SubcontractAgreementCounter } from '@/subapps/procurement/subcontracts/agreements/agreement-document-number';
import type { SubcontractAgreement, SubcontractAgreementRevision } from '@/subapps/procurement/subcontracts/types/agreement';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { SubcontractWriteError } from './subcontract-write-error';

/** Τα είδη εγγράφων του γραφέα — ένας πίνακας τύπων, ένας πίνακας προδιαγραφών. */
interface SubcontractRecords {
  readonly clause: SubcontractClause;
  readonly clauseVersion: SubcontractClauseVersion;
  readonly tradeTemplate: SubcontractTradeTemplate;
  readonly agreement: SubcontractAgreement;
  /** Αμετάβλητη: γράφεται **μόνο** με `stageCreate` (δεν είναι `UpdatableKind`). */
  readonly agreementRevision: SubcontractAgreementRevision;
}
export type SubcontractKind = keyof SubcontractRecords;
/** Τα είδη που αλλάζουν μετά τη γέννησή τους — έχουν CAS (`revision`) και σφραγίδα ενημέρωσης. */
export type UpdatableKind = Exclude<SubcontractKind, 'agreementRevision'>;
type AnyRecord = SubcontractRecords[SubcontractKind];

interface KindSpec<K extends SubcontractKind> {
  readonly entityType: AuditEntityType;
  readonly trackedFields: Record<string, TrackedFieldDef>;
  readonly entityName: (record: SubcontractRecords[K]) => string;
  /** Προβολή πριν από τη σύγκριση ιστορικού (π.χ. μεταφράσεις → `{γλώσσα: κατάσταση}`). */
  readonly auditView: (record: SubcontractRecords[K]) => Record<string, unknown>;
}

const translationStatusOf = (version: SubcontractClauseVersion): Record<string, string> =>
  Object.fromEntries(Object.entries(version.translations).map(([language, translation]) => [language, translation.status]));

/** `{ 'retention.performance.rate': 'approved' }` — η απόφαση κάθε απόκλισης, όπως τη διαβάζει ο άνθρωπος στο ιστορικό. */
const deviationStatusOf = (agreement: SubcontractAgreement): Record<string, string> =>
  Object.fromEntries(agreement.clauses.flatMap((selection) =>
    Object.entries(selection.deviations).map(([key, deviation]) => [`${selection.clauseKey}.${key}`, deviation.decision]),
  ));

const KIND_SPECS: { readonly [K in SubcontractKind]: KindSpec<K> } = {
  clause: {
    entityType: 'subcontract_clause',
    trackedFields: SUBCONTRACT_CLAUSE_TRACKED_FIELDS,
    entityName: (clause) => clause.clauseKey,
    auditView: (clause) => ({ ...clause }),
  },
  clauseVersion: {
    entityType: 'subcontract_clause_version',
    trackedFields: SUBCONTRACT_CLAUSE_VERSION_TRACKED_FIELDS,
    entityName: (version) => `${version.clauseId} v${version.version}`,
    auditView: (version) => ({ ...version, translationStatus: translationStatusOf(version) }),
  },
  tradeTemplate: {
    entityType: 'subcontract_trade_template',
    trackedFields: SUBCONTRACT_TRADE_TEMPLATE_TRACKED_FIELDS,
    entityName: (template) => template.code,
    auditView: (template) => ({ ...template }),
  },
  agreement: {
    entityType: 'subcontract_agreement',
    trackedFields: SUBCONTRACT_AGREEMENT_TRACKED_FIELDS,
    entityName: (agreement) => agreement.documentNumber,
    auditView: (agreement) => ({ ...agreement, deviationStatus: deviationStatusOf(agreement) }),
  },
  agreementRevision: {
    entityType: 'subcontract_agreement_revision',
    trackedFields: SUBCONTRACT_AGREEMENT_REVISION_TRACKED_FIELDS,
    entityName: (revision) => `${revision.snapshot.documentNumber} r${revision.revisionNumber}`,
    auditView: (revision) => ({ ...revision }),
  },
};

/** Μία σκηνοθετημένη αλλαγή — ό,τι χρειάζεται το ίχνος μετά το commit. */
interface StagedChange {
  readonly kind: SubcontractKind;
  readonly before: AnyRecord | null;
  readonly after: AnyRecord;
}

/** Το πλαίσιο μιας συναλλαγής: η βάση, η συναλλαγή, ο δρων, η στιγμή, και οι αλλαγές για το ίχνος. */
export interface SubcontractTx {
  readonly db: Firestore;
  readonly tx: Transaction;
  readonly ctx: AuthContext;
  readonly now: string;
  readonly changes: StagedChange[];
}

// ── Αναφορές ────────────────────────────────────────────────────────────────

export function clauseDocRef(db: Firestore, clauseId: string): DocumentReference {
  return db.collection(COLLECTIONS.SUBCONTRACT_CLAUSES).doc(clauseId);
}

export function clauseVersionDocRef(db: Firestore, clauseId: string, versionId: string): DocumentReference {
  return clauseDocRef(db, clauseId).collection(SUBCOLLECTIONS.SUBCONTRACT_CLAUSE_VERSIONS).doc(versionId);
}

export function tradeTemplateDocRef(db: Firestore, templateId: string): DocumentReference {
  return db.collection(COLLECTIONS.SUBCONTRACT_TRADE_TEMPLATES).doc(templateId);
}

export function agreementDocRef(db: Firestore, agreementId: string): DocumentReference {
  return db.collection(COLLECTIONS.SUBCONTRACT_AGREEMENTS).doc(agreementId);
}

export function agreementRevisionDocRef(db: Firestore, agreementId: string, revisionId: string): DocumentReference {
  return agreementDocRef(db, agreementId).collection(SUBCOLLECTIONS.SUBCONTRACT_AGREEMENT_REVISIONS).doc(revisionId);
}

/** Ο μετρητής αριθμών εγγράφου του χώρου — doc id = companyId (όπως `QUOTE_COUNTERS`): ένας ανά χώρο, κατασκευαστικά. */
function agreementCounterRef(scope: SubcontractTx): DocumentReference {
  return scope.db.collection(COLLECTIONS.SUBCONTRACT_AGREEMENT_COUNTERS).doc(scope.ctx.companyId);
}

// ── Συναλλαγή ──────────────────────────────────────────────────────────────

/**
 * Τρέχει τη δουλειά σε **μία** συναλλαγή και γράφει το ίχνος **κάθε** αλλαγής μετά το commit (ADR-195). Το ίχνος δεν
 * ακυρώνει ποτέ την πράξη — η αποθήκευση έχει ήδη γίνει (ίδιο συμβόλαιο με `runCatalogTransaction`).
 */
export async function runSubcontractTransaction<T>(ctx: AuthContext, work: (scope: SubcontractTx) => Promise<T>): Promise<T> {
  const db = getAdminFirestore();
  let staged: readonly StagedChange[] = [];
  const result = await db.runTransaction(async (tx) => {
    const scope: SubcontractTx = { db, tx, ctx, now: nowISO(), changes: [] };
    const value = await work(scope);
    staged = scope.changes;
    return value;
  });
  for (const change of staged) await recordChange(change, ctx.uid);
  return result;
}

async function recordChange(change: StagedChange, performedBy: string): Promise<void> {
  const spec = KIND_SPECS[change.kind] as KindSpec<SubcontractKind>;
  await recordTrackedEntityWrite({
    entityType: spec.entityType,
    entityId: change.after.id,
    entityName: spec.entityName(change.after),
    trackedFields: spec.trackedFields,
    before: change.before ? spec.auditView(change.before) : null,
    after: spec.auditView(change.after),
    performedBy,
    ledger: { companyId: change.after.companyId },
  });
}

// ── Αναγνώσεις (ΠΡΙΝ από κάθε stage) ───────────────────────────────────────

/** Το έγγραφο **αυτού** του χώρου στη διαδρομή, ή `null` (ανύπαρκτο ή ξένο: **ίδια** απάντηση, ADR-742 §3.3). */
export async function readOwnedOrNull<K extends SubcontractKind>(
  scope: SubcontractTx,
  _kind: K,
  ref: DocumentReference,
): Promise<SubcontractRecords[K] | null> {
  const snap = await scope.tx.get(ref);
  return ownedOrNull(snap.data() as SubcontractRecords[K] | undefined, scope.ctx.companyId, { resource: ref.parent.id, resourceId: ref.id });
}

/**
 * Το συμφωνητικό **αυτού** του χώρου, **εκτός** συναλλαγής, μόνο για την κρίση δικαιώματος (ADR-926 Κ3: «σε ποιο έργο
 * ανήκει ο πόρος;»). Ανύπαρκτο ή ξένο ⇒ `null`. Δεν τροφοδοτεί ποτέ εγγραφή: ο γραφέας ξαναδιαβάζει μέσα στη συναλλαγή.
 */
export async function readAgreementForAuthorization(ctx: AuthContext, agreementId: string): Promise<SubcontractAgreement | null> {
  if (!isAddressableDocId(agreementId)) return null;
  const ref = agreementDocRef(getAdminFirestore(), agreementId);
  const snap = await ref.get();
  return ownedOrNull(snap.data() as SubcontractAgreement | undefined, ctx.companyId, { resource: ref.parent.id, resourceId: ref.id });
}

/** Όπως το `readOwnedOrNull`, αλλά ανύπαρκτο ή ξένο ⇒ `notFound`. */
export async function readOwned<K extends SubcontractKind>(
  scope: SubcontractTx,
  kind: K,
  ref: DocumentReference,
): Promise<SubcontractRecords[K]> {
  const owned = await readOwnedOrNull(scope, kind, ref);
  if (owned === null) throw new SubcontractWriteError('notFound');
  return owned;
}

/** Πολλά έγγραφα **αυτού** του χώρου σε **μία** ανάγνωση (`getAll`) — ξένο ή ανύπαρκτο ⇒ `null` στη θέση του. */
export async function readOwnedMany<K extends SubcontractKind>(
  scope: SubcontractTx,
  _kind: K,
  refs: readonly DocumentReference[],
): Promise<(SubcontractRecords[K] | null)[]> {
  if (refs.length === 0) return [];
  const snaps = await scope.tx.getAll(...refs);
  return snaps.map((snap, index) =>
    ownedOrNull(snap.data() as SubcontractRecords[K] | undefined, scope.ctx.companyId, { resource: refs[index].parent.id, resourceId: refs[index].id }),
  );
}

/** Ο μετρητής του χώρου (ή `null` πριν από το πρώτο έγγραφο) — ανάγνωση ΠΡΙΝ από κάθε εγγραφή, όπως όλες. */
export async function readAgreementCounter(scope: SubcontractTx): Promise<SubcontractAgreementCounter | null> {
  const snap = await scope.tx.get(agreementCounterRef(scope));
  return (snap.data() as SubcontractAgreementCounter | undefined) ?? null;
}

/** Ο νέος μετρητής — στην ίδια συναλλαγή με το έγγραφο που παίρνει τον αριθμό. Χωρίς ίχνος: δεν είναι οντότητα. */
export function stageAgreementCounter(scope: SubcontractTx, counter: SubcontractAgreementCounter): void {
  scope.tx.set(agreementCounterRef(scope), counter);
}

/** Ο CAS: ο πελάτης στέλνει την αναθεώρηση που διάβασε· αν άλλαξε στο μεταξύ ⇒ 409 με την τρέχουσα. */
export function assertRevision(record: { readonly revision: number }, expectedRevision: number): void {
  if (record.revision !== expectedRevision) {
    throw new SubcontractWriteError('revisionMismatch', [], { currentRevision: record.revision });
  }
}

// ── Σκηνοθεσία εγγραφών (ΜΕΤΑ από όλες τις αναγνώσεις) ──────────────────────

/**
 * Νέο έγγραφο με `create()`: αρνείται υπάρχον **ακόμη κι αν κάποιος πρόλαβε μετά την ανάγνωση** — η δομική
 * μοναδικότητα των ντετερμινιστικών ids (δύο ταυτόχρονες προτάσεις της ίδιας έκδοσης ⇒ η δεύτερη αποτυγχάνει).
 */
export function stageCreate<K extends SubcontractKind>(scope: SubcontractTx, kind: K, ref: DocumentReference, record: SubcontractRecords[K]): SubcontractRecords[K] {
  scope.tx.create(ref, record);
  scope.changes.push({ kind, before: null, after: record });
  return record;
}

/** Αλλαγή υπάρχοντος: αναθεώρηση +1 και σφραγίδα ενημέρωσης — ο **ένας** δρόμος. */
export function stageUpdate<K extends UpdatableKind>(
  scope: SubcontractTx,
  kind: K,
  ref: DocumentReference,
  current: SubcontractRecords[K],
  patch: Partial<SubcontractRecords[K]>,
): SubcontractRecords[K] {
  const next = { ...current, ...patch, revision: revisionAfterWrite(current.revision), updatedAt: scope.now, updatedBy: scope.ctx.uid };
  scope.tx.set(ref, next);
  scope.changes.push({ kind, before: current, after: next });
  return next;
}
