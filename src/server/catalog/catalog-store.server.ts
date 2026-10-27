import 'server-only';

/**
 * =============================================================================
 * Η ΜΗΧΑΝΗ ΑΠΟΘΗΚΕΥΣΗΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ — ΤΟ ΕΝΑ ΣΗΜΕΙΟ ΠΟΥ ΓΡΑΦΕΙ (ADR-923 §5.9 · §5.10 · CHECK 3.106)
 * =============================================================================
 *
 * Κάθε γραφή σε `catalog_*` περνά από εδώ: **μία** συναλλαγή, **ένας** έλεγχος ιδιοκτησίας, **ένας** έλεγχος
 * αναθεώρησης (CAS), **ένα** ίχνος ιστορικού μετά το commit. Οι γραφείς ανά οντότητα κρατούν μόνο τους
 * κανόνες του τομέα τους (τι επιτρέπεται να αλλάξει, ποιος χρησιμοποιεί τι).
 *
 * 🔑 **Οι χρονοσφραγίδες είναι ISO 8601 `string`** σε βάση, σύρμα και πελάτη — **μία** αναπαράσταση αντί για
 * τρεις (ADR-663 §4). Το σχήμα δεν χρειάζεται ταξινόμηση κατά χρόνο στον διακομιστή.
 *
 * 🔑 **Δύο είδη εγγραφής, επίτηδες** (ADR-923 §5.10 Θωράκιση 1):
 *   - **αλλαγή ανθρώπου** (`stageCreate/Replace/SoftDelete`): αναθεώρηση +1, σφραγίδα, ίχνος ιστορικού·
 *   - **παράγωγο** (`stageDerived`): γράφει **μόνο** το `derived` — χωρίς αναθεώρηση, χωρίς ίχνος. Ο
 *     επανυπολογισμός πληρότητας 200 παραλλαγών δεν είναι «αλλαγή» κανενός: με αναθεώρηση θα έδινε 200 ψευδή
 *     409 σε όποιον τις επεξεργάζεται, και 200 ψεύτικες γραμμές στο ιστορικό. Η **σειριοποίηση** δεν χάνεται:
 *     η συναλλαγή διάβασε το έγγραφο, άρα κάθε ταυτόχρονη εγγραφή (και παραγώγου) την ξανατρέχει.
 *
 * ⚠️ **Firestore: όλες οι αναγνώσεις ΠΡΙΝ από κάθε εγγραφή μέσα στη συναλλαγή.** Γι' αυτό η μηχανή χωρίζει
 * **ανάγνωση** (`read*`) από **σκηνοθεσία εγγραφής** (`stage*`): ο γραφέας διαβάζει όσα χρειάζεται, κρίνει, και
 * μόνο τότε σκηνοθετεί.
 *
 * @module server/catalog/catalog-store.server
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { enterpriseIdFromRequest } from '@/services/enterprise-id-parse';
import type { CatalogRecord } from '@/subapps/catalog/types/catalog-record';
import { CATALOG_KIND_SPECS, type CatalogKind, type CatalogKindIdentity } from './catalog-kinds';
import { CatalogWriteError } from './catalog-write-error';
import { revisionAfterWrite } from '@/subapps/catalog/aggregate/aggregate-members';

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

/** Ο στόχος μιας δημιουργίας: το id και η αναθεώρηση που είχε (0 = ποτέ· > 0 = διαγραμμένο που ξαναγεννιέται). */
export interface CreateTarget {
  readonly id: string;
  readonly previousRevision: number;
}

export function catalogDocRef(db: Firestore, kind: CatalogKind, id: string): DocumentReference {
  return db.collection(CATALOG_KIND_SPECS[kind].collection).doc(id);
}

/** Η αναθεώρηση μετά από μία αλλαγή ανθρώπου — ο **ένας** κανόνας «+1», για μηχανή και αποτύπωμα πληρότητας. */
// Ο κανόνας ζει στο κοινό `aggregate-members` — ίδιος για γραφέα, κρίση και οθόνη (ADR-923 §5.10.4 Β4).
export { revisionAfterWrite };

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
  const view = (record: StoredCatalogRecord<object>): Record<string, unknown> =>
    spec.auditView ? spec.auditView(record as Readonly<Record<string, unknown>>) : (record as Record<string, unknown>);
  await recordTrackedEntityWrite({
    entityType: spec.entityType,
    entityId: change.after.id,
    entityName: spec.auditName ? spec.auditName(change.after as Readonly<Record<string, unknown>>) : entityNameOf(change.after),
    trackedFields: spec.trackedFields,
    before: change.before ? view(change.before) : null,
    after: view(change.after),
    performedBy,
    ledger: { companyId: change.after.companyId },
  });
}

/** Το όνομα στο ιστορικό: ο κωδικός· για το SKU (χωρίς κωδικό-ταυτότητα) η παραγόμενη ετικέτα του. */
function entityNameOf(record: object): string | null {
  if ('code' in record && typeof record.code === 'string') return record.code;
  if ('derived' in record && record.derived && typeof record.derived === 'object' && 'label' in record.derived) {
    return typeof record.derived.label === 'string' ? record.derived.label : null;
  }
  return null;
}

// ── Αναγνώσεις ──────────────────────────────────────────────────────────────

/** Η ενεργή εγγραφή **αυτού** του χώρου — ή `null` (ανύπαρκτη, διαγραμμένη ή ξένη: **ίδια** απάντηση). */
export async function readOwnedOrNull<TDefinition>(
  scope: CatalogTx,
  kind: CatalogKind,
  id: string,
): Promise<StoredCatalogRecord<TDefinition> | null> {
  const snap = await scope.tx.get(catalogDocRef(scope.db, kind, id));
  const owned = ownedOrNull(snap.data() as StoredCatalogRecord<TDefinition> | undefined, scope.ctx.companyId, {
    resource: CATALOG_KIND_SPECS[kind].collection,
    resourceId: id,
  });
  return owned === null || owned.isDeleted ? null : owned;
}

/**
 * Η ενεργή εγγραφή **αυτού** του χώρου. Ανύπαρκτη, διαγραμμένη ή ξένη ⇒ `notFound` — **ίδια** απάντηση
 * και για τα τρία, ώστε να μη διαρρέει η ύπαρξη ξένου σχήματος (ADR-742 §3.3).
 */
export async function readOwned<TDefinition>(
  scope: CatalogTx,
  kind: CatalogKind,
  id: string,
): Promise<StoredCatalogRecord<TDefinition>> {
  const owned = await readOwnedOrNull<TDefinition>(scope, kind, id);
  if (owned === null) throw new CatalogWriteError('notFound');
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

function identityOf<M extends CatalogKindIdentity['mode']>(kind: CatalogKind, mode: M): Extract<CatalogKindIdentity, { mode: M }> {
  const identity = CATALOG_KIND_SPECS[kind].identity;
  if (identity.mode !== mode) throw new Error(`catalog kind ${kind} has ${identity.mode} identity, not ${mode}`);
  return identity as Extract<CatalogKindIdentity, { mode: M }>;
}

/**
 * Για δημιουργία: το id είναι ντετερμινιστικό από `(χώρος, κωδικός)`, άρα **ενεργό** έγγραφο στο ίδιο id
 * σημαίνει διπλότυπο κωδικό. Διαγραμμένο έγγραφο **ξαναγεννιέται** στη θέση του (ο κωδικός ξαναγίνεται
 * διαθέσιμος, η αναθεώρηση συνεχίζει να ανεβαίνει — καμία παλιά αναφορά δεν ξαναζωντανεύει σιωπηλά).
 */
export async function readForCreate(scope: CatalogTx, kind: CatalogKind, code: string): Promise<CreateTarget> {
  const id = identityOf(kind, 'code').idOf(scope.ctx.companyId, code);
  const snap = await scope.tx.get(catalogDocRef(scope.db, kind, id));
  const data = snap.data() as StoredCatalogRecord<object> | undefined;
  if (data && !data.isDeleted) throw new CatalogWriteError('duplicateCode', [], { code });
  return { id, previousRevision: data?.revision ?? 0 };
}

/**
 * Για δημιουργία με **τυχαίο** id (SKU, Δ3). Ο πελάτης **μπορεί** να το προ-γεννήσει (αισιόδοξη οθόνη, ADR-866
 * επίπεδο Β): ο διακομιστής **δεν** το εμπιστεύεται — ελέγχει πρόθεμα + uuid v4, διαβάζει το έγγραφο, και η
 * δημιουργία γράφει με `create()`, που αρνείται υπάρχον έγγραφο ακόμη κι αν κάποιος πρόλαβε μετά την ανάγνωση.
 */
export async function readForRandomCreate(scope: CatalogTx, kind: CatalogKind, requestedId: string | null): Promise<CreateTarget> {
  const identity = identityOf(kind, 'random');
  const id = requestedId === null ? identity.mint() : enterpriseIdFromRequest(requestedId, identity.prefix);
  if (id === null) throw new CatalogWriteError('invalid', [{ code: 'invalidCode', path: 'id' }]);
  const snap = await scope.tx.get(catalogDocRef(scope.db, kind, id));
  if (snap.exists) throw new CatalogWriteError('duplicateCode', [], { code: id });
  return { id, previousRevision: 0 };
}

/** Το id ενός είδους με ταυτότητα **φυσικού κλειδιού** σε αυτόν τον χώρο (χωρίς ανάγνωση). */
export function naturalKeyId(scope: CatalogTx, kind: CatalogKind, key: string): string {
  return identityOf(kind, 'code').idOf(scope.ctx.companyId, key);
}

/**
 * Για **upsert** με ντετερμινιστικό id (ADR-923 §5.11 «3β»: γραμμή τιμοκαταλόγου = έκδοση + υποκείμενο): ο στόχος
 * και η τρέχουσα **ενεργή** εγγραφή του χώρου, αν υπάρχει. Ίδιο έγγραφο με το `readForCreate`, χωρίς να ρίχνει: ο
 * γραφέας αποφασίζει αν «υπάρχει» σημαίνει «αντικατάσταση» ή «διπλότυπο». Ξένο έγγραφο στο ίδιο id είναι αδύνατο
 * (το id περιέχει τον χώρο), αλλά κρίνεται ξανά — ξένο ≡ ανύπαρκτο, ποτέ αντικατάσταση.
 */
export function readForUpsert<TDefinition>(scope: CatalogTx, kind: CatalogKind, key: string): Promise<TargetAndCurrent<TDefinition>> {
  return readTargetAndCurrent<TDefinition>(scope, kind, naturalKeyId(scope, kind, key));
}

/** Ο στόχος μιας εγγραφής σε γνωστό id **και** η τρέχουσα ενεργή εγγραφή του χώρου — ο ένας δρόμος upsert/singleton. */
interface TargetAndCurrent<TDefinition> {
  readonly target: CreateTarget;
  readonly current: StoredCatalogRecord<TDefinition> | null;
}

async function readTargetAndCurrent<TDefinition>(scope: CatalogTx, kind: CatalogKind, id: string): Promise<TargetAndCurrent<TDefinition>> {
  const snap = await scope.tx.get(catalogDocRef(scope.db, kind, id));
  const data = snap.data() as StoredCatalogRecord<TDefinition> | undefined;
  const current = data && !data.isDeleted && data.companyId === scope.ctx.companyId ? data : null;
  return { target: { id, previousRevision: data?.revision ?? 0 }, current };
}

/** Το singleton του χώρου (ρυθμίσεις): ο στόχος και η τρέχουσα ενεργή εγγραφή, αν υπάρχει. */
export function readSingleton<TDefinition>(scope: CatalogTx, kind: CatalogKind): Promise<TargetAndCurrent<TDefinition>> {
  return readTargetAndCurrent<TDefinition>(scope, kind, identityOf(kind, 'singleton').idOf(scope.ctx.companyId));
}

// ── Σκηνοθεσία εγγραφών (ΜΕΤΑ από όλες τις αναγνώσεις) ──────────────────────

function freshRecord<TDefinition extends object>(
  scope: CatalogTx,
  target: CreateTarget,
  definition: TDefinition,
): StoredCatalogRecord<TDefinition> {
  const { ctx, now } = scope;
  return {
    ...definition,
    id: target.id,
    companyId: ctx.companyId,
    revision: revisionAfterWrite(target.previousRevision),
    isDeleted: false,
    createdAt: now,
    createdBy: ctx.uid,
    updatedAt: now,
    updatedBy: ctx.uid,
    deletedAt: null,
    deletedBy: null,
  };
}

export function stageCreate<TDefinition extends object>(
  scope: CatalogTx,
  kind: CatalogKind,
  target: CreateTarget,
  definition: TDefinition,
): StoredCatalogRecord<TDefinition> {
  const record = freshRecord(scope, target, definition);
  const ref = catalogDocRef(scope.db, kind, target.id);
  // Νέο έγγραφο ⇒ `create()` (αρνείται υπάρχον — ζώνη ασφαλείας πάνω από την ανάγνωση)· διαγραμμένο ⇒ `set()`.
  if (target.previousRevision === 0) scope.tx.create(ref, record);
  else scope.tx.set(ref, record);
  scope.changes.push({ kind, before: null, after: record });
  return record;
}

/**
 * **Σπορά** από αμετάβλητη πηγή (ADR-923 §5.11 «3β»: «νέα έκδοση από την τρέχουσα» αντιγράφει χιλιάδες γραμμές
 * δημοσιευμένης έκδοσης). Ίδιο περίβλημα με το `stageCreate`, αλλά **χωρίς ίχνος ανά εγγραφή**: η αντιγραφή δεν
 * είναι αλλαγή κανενός ανθρώπου — το ίχνος της είναι **ένα**, στην έκδοση (`basedOnVersionId`). `set()` (όχι
 * `create()`): η επανάληψη ενός τμήματος μετά από διακοπή γράφει **το ίδιο** έγγραφο με το ίδιο περιεχόμενο.
 * ⛔ Μόνο η μηχανή συνόλου της έκδοσης την καλεί (CHECK 3.106 Κ6) — αλλιώς είναι εγγραφή χωρίς ιστορικό.
 */
export function stageCopied<TDefinition extends object>(
  scope: CatalogTx,
  kind: CatalogKind,
  target: CreateTarget,
  definition: TDefinition,
): StoredCatalogRecord<TDefinition> {
  const record = freshRecord(scope, target, definition);
  scope.tx.set(catalogDocRef(scope.db, kind, target.id), record);
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
    revision: revisionAfterWrite(current.revision),
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

/**
 * Γράφει **μόνο** το `derived` (ADR-923 §5.10 Θωράκιση 1): **καμία** αναθεώρηση, **καμία** σφραγίδα ανθρώπου,
 * **κανένα** ίχνος. Ο μόνος δρόμος για παράγωγο σε έγγραφο που **δεν** αλλάζει ο άνθρωπος σε αυτή τη συναλλαγή
 * (CHECK 3.106 Κ4). `update` (όχι `set`): το υπόλοιπο έγγραφο μένει όπως διαβάστηκε.
 */
export function stageDerived<TDerived extends object, TDefinition extends { readonly derived: TDerived }>(
  scope: CatalogTx,
  kind: CatalogKind,
  current: StoredCatalogRecord<TDefinition>,
  derived: TDerived,
): StoredCatalogRecord<TDefinition> {
  scope.tx.update(catalogDocRef(scope.db, kind, current.id), { derived });
  return { ...current, derived };
}

// ── Κρατήσεις μοναδικών τιμών (Δ3) — ευρετήριο του γραφέα, ΟΧΙ οντότητα (χωρίς ιστορικό) ─────────────────

/** Μία κράτηση: «αυτή η κανονικοποιημένη τιμή αυτής της ιδιότητας ανήκει σε αυτόν τον φορέα». */
export interface CatalogUniqueValueDoc {
  readonly id: string;
  readonly companyId: string;
  readonly attributeId: string;
  readonly uniqueKey: string;
  /** Σκελετός UTS #39 — **μόνο** για την προειδοποίηση «μοιάζει με υπάρχοντα», ποτέ για ταυτότητα. */
  readonly skeleton: string;
  readonly holderKind: 'productModel' | 'product';
  readonly holderId: string;
  readonly createdAt: string;
}

export function uniqueValueRef(db: Firestore, id: string): DocumentReference {
  return db.collection(COLLECTIONS.CATALOG_UNIQUE_VALUES).doc(id);
}

export function stageUniqueClaim(scope: CatalogTx, reservation: CatalogUniqueValueDoc): void {
  scope.tx.set(uniqueValueRef(scope.db, reservation.id), reservation);
}

export function stageUniqueRelease(scope: CatalogTx, reservationId: string): void {
  scope.tx.delete(uniqueValueRef(scope.db, reservationId));
}

// ── Υποδοχές ασάφειας τιμολόγησης (ADR-923 §5.11 «3β») — ευρετήριο του γραφέα, ΟΧΙ οντότητα (χωρίς ιστορικό) ──

/** Ένα μέλος υποδοχής: ποιος την κατέχει και πότε ισχύει (ημιανοιχτό `[validFrom, validUntil)`, `null` = ανοιχτό). */
export interface CatalogPricingSlotMember {
  readonly holderId: string;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
}

/**
 * Όσοι μοιράζονται **κλειδί υποδοχής** (`pricing-keys.ts`) δεν επιτρέπεται να επικαλύπτονται. Η συναλλαγή που
 * γράφει μέλος **διαβάζει** το έγγραφο ⇒ δύο ταυτόχρονες εγγραφές συγκρούονται (ένα ερώτημα θα έχανε το
 * «φάντασμα» που δεν έχει γραφτεί ακόμα).
 */
export interface CatalogPricingSlotDoc {
  readonly id: string;
  readonly companyId: string;
  readonly slotKey: string;
  readonly members: readonly CatalogPricingSlotMember[];
  readonly updatedAt: string;
}

export function pricingSlotRef(db: Firestore, id: string): DocumentReference {
  return db.collection(COLLECTIONS.CATALOG_PRICING_SLOTS).doc(id);
}

/** Γράφει τα μέλη της υποδοχής — **καμία** κενή υποδοχή δεν μένει πίσω (άδεια ⇒ διαγραφή). */
export function stagePricingSlot(scope: CatalogTx, slot: Omit<CatalogPricingSlotDoc, 'updatedAt'>): void {
  const ref = pricingSlotRef(scope.db, slot.id);
  if (slot.members.length === 0) scope.tx.delete(ref);
  else scope.tx.set(ref, { ...slot, updatedAt: scope.now });
}
