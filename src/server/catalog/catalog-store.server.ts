import 'server-only';

/**
 * =============================================================================
 * Η ΜΗΧΑΝΗ ΑΠΟΘΗΚΕΥΣΗΣ ΤΟΥ ΣΧΗΜΑΤΟΣ ΚΑΤΑΛΟΓΟΥ — ΤΟ ΕΝΑ ΣΗΜΕΙΟ ΠΟΥ ΓΡΑΦΕΙ (ADR-923 §5.9 · CHECK 3.106)
 * =============================================================================
 *
 * Κάθε γραφή σε `catalog_*` περνά από εδώ: **μία** συναλλαγή, **ένας** έλεγχος ιδιοκτησίας, **ένας** έλεγχος
 * αναθεώρησης (CAS), **ένα** ίχνος ιστορικού μετά το commit. Οι γραφείς ανά οντότητα κρατούν μόνο τους
 * κανόνες του τομέα τους (τι επιτρέπεται να αλλάξει, ποιος χρησιμοποιεί τι).
 *
 * 🔑 **Οι χρονοσφραγίδες είναι ISO 8601 `string`** σε βάση, σύρμα και πελάτη — **μία** αναπαράσταση αντί για
 * τρεις (ADR-663 §4). Το σχήμα δεν χρειάζεται ταξινόμηση κατά χρόνο στον διακομιστή.
 *
 * ⚠️ **Firestore: όλες οι αναγνώσεις ΠΡΙΝ από κάθε εγγραφή μέσα στη συναλλαγή.** Γι' αυτό η μηχανή χωρίζει
 * **ανάγνωση** (`readOwned` · `readForCreate`) από **σκηνοθεσία εγγραφής** (`stage*`): ο γραφέας διαβάζει όσα
 * χρειάζεται, κρίνει, και μόνο τότε σκηνοθετεί.
 *
 * @module server/catalog/catalog-store.server
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import type { CatalogRecord } from '@/subapps/catalog/types/catalog-record';
import { CATALOG_KIND_SPECS, type CatalogKind } from './catalog-kinds';
import { CatalogWriteError } from './catalog-write-error';

/** Αποθηκευμένη εγγραφή: ορισμός + περίβλημα, χρονοσφραγίδες ISO. */
export type StoredCatalogRecord<TDefinition> = CatalogRecord<TDefinition, string>;

/** Μία σκηνοθετημένη αλλαγή — ό,τι χρειάζεται το ίχνος μετά το commit. */
interface StagedChange {
  readonly kind: CatalogKind;
  readonly before: StoredCatalogRecord<object> | null;
  readonly after: StoredCatalogRecord<object>;
}

/** Το πλαίσιο μιας συναλλαγής: η βάση, η συναλλαγή, ο δρων, και οι αλλαγές για το ίχνος. */
export interface CatalogTx {
  readonly db: Firestore;
  readonly tx: Transaction;
  readonly ctx: AuthContext;
  readonly now: string;
  readonly changes: StagedChange[];
}

export function catalogDocRef(db: Firestore, kind: CatalogKind, id: string): DocumentReference {
  return db.collection(CATALOG_KIND_SPECS[kind].collection).doc(id);
}

/**
 * Τρέχει τη δουλειά σε **μία** συναλλαγή και γράφει το ίχνος **κάθε** αλλαγής μετά το commit
 * (ADR-195· ίδιο πρότυπο με την παράδοση φακέλου). Το ίχνος αποτυγχάνει **σιωπηλά προς τον χρήστη**
 * (το `recordChange` καταγράφει και επιστρέφει) — η αποθήκευση έχει ήδη γίνει.
 */
export async function runCatalogTransaction<T>(ctx: AuthContext, work: (scope: CatalogTx) => Promise<T>): Promise<T> {
  const db = getAdminFirestore();
  let staged: StagedChange[] = [];
  const result = await db.runTransaction(async (tx) => {
    const scope: CatalogTx = { db, tx, ctx, now: nowISO(), changes: [] };
    const value = await work(scope);
    staged = scope.changes;
    return value;
  });
  for (const change of staged) await recordChange(change, ctx.uid);
  return result;
}

async function recordChange(change: StagedChange, performedBy: string): Promise<void> {
  const spec = CATALOG_KIND_SPECS[change.kind];
  await recordTrackedEntityWrite({
    entityType: spec.entityType,
    entityId: change.after.id,
    entityName: entityNameOf(change.after),
    trackedFields: spec.trackedFields,
    before: change.before,
    after: change.after,
    performedBy,
    ledger: { companyId: change.after.companyId },
  });
}

function entityNameOf(record: object): string | null {
  return 'code' in record && typeof record.code === 'string' ? record.code : null;
}

// ── Αναγνώσεις ──────────────────────────────────────────────────────────────

/**
 * Η ενεργή εγγραφή **αυτού** του χώρου. Ανύπαρκτη, διαγραμμένη ή ξένη ⇒ `notFound` — **ίδια** απάντηση
 * και για τα τρία, ώστε να μη διαρρέει η ύπαρξη ξένου σχήματος (ADR-742 §3.3).
 */
export async function readOwned<TDefinition>(
  scope: CatalogTx,
  kind: CatalogKind,
  id: string,
): Promise<StoredCatalogRecord<TDefinition>> {
  const snap = await scope.tx.get(catalogDocRef(scope.db, kind, id));
  const owned = ownedOrNull(snap.data() as StoredCatalogRecord<TDefinition> | undefined, scope.ctx.companyId, {
    resource: CATALOG_KIND_SPECS[kind].collection,
    resourceId: id,
  });
  if (owned === null || owned.isDeleted) throw new CatalogWriteError('notFound');
  return owned;
}

/** Ο CAS: ο πελάτης στέλνει την αναθεώρηση που διάβασε· αν άλλαξε στο μεταξύ ⇒ 409 με την τρέχουσα. */
export function assertRevision(record: { readonly revision: number }, expectedRevision: number): void {
  if (record.revision !== expectedRevision) {
    throw new CatalogWriteError('revisionMismatch', [], { currentRevision: record.revision });
  }
}

/** Ο κωδικός είναι **αμετάβλητος** από τη δημιουργία (§5.2.1) — η ταυτότητα που διαβάζουν εισαγωγές/εξαγωγές. */
export function assertCodeUnchanged(record: { readonly code: string }, nextCode: string): void {
  if (record.code !== nextCode) throw new CatalogWriteError('immutable', [{ code: 'codeImmutable', path: 'code' }]);
}

/**
 * Για δημιουργία: το id είναι ντετερμινιστικό από `(χώρος, κωδικός)`, άρα **ενεργό** έγγραφο στο ίδιο id
 * σημαίνει διπλότυπο κωδικό. Διαγραμμένο έγγραφο **ξαναγεννιέται** στη θέση του (ο κωδικός ξαναγίνεται
 * διαθέσιμος, η αναθεώρηση συνεχίζει να ανεβαίνει — καμία παλιά αναφορά δεν ξαναζωντανεύει σιωπηλά).
 */
export async function readForCreate(
  scope: CatalogTx,
  kind: CatalogKind,
  code: string,
): Promise<{ readonly id: string; readonly previousRevision: number }> {
  const id = CATALOG_KIND_SPECS[kind].idOf(scope.ctx.companyId, code);
  const snap = await scope.tx.get(catalogDocRef(scope.db, kind, id));
  const data = snap.data() as StoredCatalogRecord<object> | undefined;
  if (data && !data.isDeleted) throw new CatalogWriteError('duplicateCode', [], { code });
  return { id, previousRevision: data?.revision ?? 0 };
}

// ── Σκηνοθεσία εγγραφών (ΜΕΤΑ από όλες τις αναγνώσεις) ──────────────────────

export function stageCreate<TDefinition extends object>(
  scope: CatalogTx,
  kind: CatalogKind,
  target: { readonly id: string; readonly previousRevision: number },
  definition: TDefinition,
): StoredCatalogRecord<TDefinition> {
  const { ctx, now } = scope;
  const record: StoredCatalogRecord<TDefinition> = {
    ...definition,
    id: target.id,
    companyId: ctx.companyId,
    revision: target.previousRevision + 1,
    isDeleted: false,
    createdAt: now,
    createdBy: ctx.uid,
    updatedAt: now,
    updatedBy: ctx.uid,
    deletedAt: null,
    deletedBy: null,
  };
  scope.tx.set(catalogDocRef(scope.db, kind, target.id), record);
  scope.changes.push({ kind, before: null, after: record });
  return record;
}

/**
 * Η **μία** διαδρομή κάθε αλλαγής υπάρχουσας εγγραφής: αναθεώρηση +1, σφραγίδα ενημέρωσης, εγγραφή, ίχνος.
 * Αντικατάσταση και διαγραφή διαφέρουν **μόνο** στο τι αλλάζει (`patch`).
 */
function stageRevision<TDefinition extends object>(
  scope: CatalogTx,
  kind: CatalogKind,
  current: StoredCatalogRecord<TDefinition>,
  patch: Partial<StoredCatalogRecord<TDefinition>>,
): StoredCatalogRecord<TDefinition> {
  const record: StoredCatalogRecord<TDefinition> = {
    ...current,
    ...patch,
    revision: current.revision + 1,
    updatedAt: scope.now,
    updatedBy: scope.ctx.uid,
  };
  scope.tx.set(catalogDocRef(scope.db, kind, current.id), record);
  scope.changes.push({ kind, before: current, after: record });
  return record;
}

/** Αντικατάσταση ορισμού (το περίβλημα κρατιέται, η αναθεώρηση ανεβαίνει). */
export function stageReplace<TDefinition extends object>(
  scope: CatalogTx,
  kind: CatalogKind,
  current: StoredCatalogRecord<TDefinition>,
  definition: TDefinition,
): StoredCatalogRecord<TDefinition> {
  return stageRevision(scope, kind, current, definition);
}

export function stageSoftDelete<TDefinition extends object>(
  scope: CatalogTx,
  kind: CatalogKind,
  current: StoredCatalogRecord<TDefinition>,
): StoredCatalogRecord<TDefinition> {
  return stageRevision(scope, kind, current, { isDeleted: true, deletedAt: scope.now, deletedBy: scope.ctx.uid });
}
