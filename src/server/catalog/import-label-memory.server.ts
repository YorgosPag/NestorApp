import 'server-only';

/**
 * Ο **ένας αναγνώστης και γραφέας της μνήμης ετικετών γραμμής** (ADR-923 §5.5.2 Β5, `catalog_import_label_memory`).
 *
 * 🔑 **Ανάγνωση με γνωστά ids**, ποτέ ερώτημα: τα κλειδιά βγαίνουν από τις γραμμές της σελίδας (`labelMemoryKey`), άρα κανένας
 *    δείκτης (CHECK 3.91) και κανένα «υπάρχει ήδη;» με race.
 * 🔑 **Μάθηση μόνο στην έγκριση** (Απόφαση 2), **μέσα** στη συναλλαγή της έγκρισης: η εφαρμοσμένη πρόταση επιστρέφει νωρίς, άρα η
 *    επανάληψη δεν ξαναμετρά. Το Firestore θέλει όλες τις αναγνώσεις πριν από την πρώτη εγγραφή ⇒ δύο φάσεις: `readLearning` πριν
 *    γράψει η έγκριση, `stageLearning` μετά.
 * @module server/catalog/import-label-memory.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { pageTableAddressOf } from '@/subapps/catalog/import/import-keys';
import {
  EMPTY_LABEL_MEMORY,
  learnableOverrides,
  learnedEntry,
  memoryHintsFor,
  memoryKeyOf,
  memoryKeysOf,
  type LabelMemoryBook,
  type LabelMemoryScope,
  type LearnableOverride,
} from '@/subapps/catalog/import/label-memory';
import { lineDecisionOf } from '@/subapps/catalog/import/page-line-overrides';
import type { MemoryBook } from '@/subapps/catalog/import/supplier-memory-core';
import type {
  ImportBatchDefinition,
  ImportLabelMemoryDefinition,
  ImportLineDecision,
  ImportMemoryRecord,
  ImportProposalDefinition,
  ImportSupplierMemoryDefinition,
} from '@/subapps/catalog/types/catalog-import';
import type { ClearLabelMemoryResult, ImportMemoryHints, ImportSupplierMemoryWire, LabelMemoryListView } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_LABEL_MEMORY_LIST_LIMIT } from '@/subapps/catalog/vocabulary/catalog-import';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import {
  assertRevision,
  readForUpsert,
  readOwned,
  readOwnedOrNull,
  runCatalogReadOnly,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogReadScope,
  type CatalogTx,
  type CreateTarget,
  type StoredCatalogRecord,
} from './catalog-store.server';

type StoredLabelMemory = StoredCatalogRecord<ImportLabelMemoryDefinition>;
/** §5.5.2 Β10: η ίδια συλλογή κρατά γραμμές και τιμές — η διαχείριση (ξέχνα · άδειασμα) τα χειρίζεται μαζί. */
type StoredSupplierMemory = StoredCatalogRecord<ImportSupplierMemoryDefinition>;

/** Ο προμηθευτής και η οικογένεια μιας παρτίδας ιδιοτήτων· `null` = χωρίς προμηθευτή, άρα χωρίς μνήμη. */
export function labelMemoryScopeOf(batch: Pick<ImportBatchDefinition, 'target'>): LabelMemoryScope | null {
  const { target } = batch;
  if (target.purpose !== 'attributes' || !target.supplierContactId) return null;
  return { supplierContactId: target.supplierContactId, familyId: target.familyId };
}

/**
 * Μαθαίνουν οι εγκρίσεις της παρτίδας; Απόν = ναι (§5.5.2 Β5.2). **Ένας** διακόπτης για γραμμές **και** τιμές (§5.5.2 Β10): «μαθαίνει
 * από αυτόν τον προμηθευτή».
 */
export const learnsLabels = (batch: Pick<ImportBatchDefinition, 'target'>): boolean => batch.target.purpose !== 'attributes' || batch.target.learnLabels !== false;

/** Τα έγγραφα μνήμης για γνωστά κλειδιά, **ίδια** ανάγνωση για γραμμές και τιμές (§5.5.2 Β10): η συλλογή είναι μία. */
export async function readMemoryEntries<D>(scope: CatalogReadScope, keys: readonly string[]): Promise<MemoryBook<D>> {
  type Entry = { readonly decisions: readonly ImportMemoryRecord<D>[] };
  const found = await Promise.all(keys.map(async (key) => ({ key, read: await readForUpsert<Entry>(scope, 'importLabelMemory', key) })));
  return new Map(found.flatMap(({ key, read }) => (read.current ? [[key, { id: read.current.id, decisions: read.current.decisions }] as const] : [])));
}

/** Η μνήμη για τα κλειδιά μιας σελίδας. Κανένα κλειδί ⇒ καμία ανάγνωση. */
export function readLabelMemoryBook(ctx: AuthContext, keys: readonly string[]): Promise<LabelMemoryBook> {
  if (keys.length === 0) return Promise.resolve(EMPTY_LABEL_MEMORY);
  return runCatalogReadOnly(ctx, (scope) => readMemoryEntries<ImportLineDecision>(scope, keys));
}

interface LearningStep {
  readonly override: LearnableOverride;
  readonly target: CreateTarget;
  readonly current: StoredLabelMemory | null;
}

/** Ό,τι θα μάθει η έγκριση, διαβασμένο πριν γράψει οτιδήποτε. Κενό όταν η πρόταση δεν είναι πίνακα σελίδας ή λείπει προμηθευτής. */
export interface LearningPlan {
  readonly scope: LabelMemoryScope | null;
  readonly steps: readonly LearningStep[];
}

const NOTHING_TO_LEARN: LearningPlan = { scope: null, steps: [] };

/** Πρώτη φάση: οι αποφάσεις του πίνακα και τα τρέχοντα έγγραφα μνήμης τους. Δύο γραμμές με ίδια ταυτότητα ⇒ μετρούν μία φορά. */
export async function readLearning(scope: CatalogTx, batch: ImportBatchDefinition, proposal: Pick<ImportProposalDefinition, 'purpose' | 'groupKey'>): Promise<LearningPlan> {
  const memory = labelMemoryScopeOf(batch);
  const address = proposal.purpose === 'attributes' ? pageTableAddressOf(proposal.groupKey) : null;
  // §5.5.2 Β5.2: «μη μαθαίνεις» (`block_learning` του Akeneo) — η παρτίδα εφαρμόζει μνήμη, αλλά δεν διδάσκει.
  if (memory === null || address === null || !learnsLabels(batch)) return NOTHING_TO_LEARN;
  const unique = new Map(learnableOverrides(batch.pages?.lineOverrides, address.page, address.table).map((override) => [memoryKeyOf(memory, override.identity), override]));
  const steps = await Promise.all([...unique].map(async ([key, override]) => ({ override, ...(await readForUpsert<ImportLabelMemoryDefinition>(scope, 'importLabelMemory', key)) })));
  return { scope: memory, steps };
}

/** Δεύτερη φάση, μετά τις εγγραφές της έγκρισης: +1 σε κάθε απόφαση που εγκρίθηκε. */
export function stageLearning(scope: CatalogTx, plan: LearningPlan, batchId: string): void {
  if (plan.scope === null) return;
  const stamp = { batchId, by: scope.ctx.uid, at: scope.now };
  for (const { override, target, current } of plan.steps) {
    const next = learnedEntry(current, plan.scope, override, stamp);
    if (current) stageReplace(scope, 'importLabelMemory', current, next);
    else stageCreate(scope, 'importLabelMemory', target, next);
  }
}

/* ── §5.5.2 Β5.2: υποδείξεις στην οθόνη της παρτίδας · διαχείριση ανά προμηθευτή ─────────────────────────────────────────── */

/** Οι ιδιότητες του σχήματος της οικογένειας: μόνο αυτές εφαρμόζονται (ίδιο κριτήριο με την ανάγνωση). */
async function familyAttributeIds(ctx: AuthContext, batch: ImportBatchDefinition): Promise<ReadonlySet<string>> {
  if (batch.target.purpose !== 'attributes') return new Set();
  const { familyId, variantSchemeCode } = batch.target;
  const schema = await runCatalogReadOnly(ctx, (scope) => readSchemaSnapshot(scope, familyId, variantSchemeCode));
  return new Set(schema.attributes.keys());
}

/**
 * Τι θα έκανε η μνήμη στην παρτίδα, **χωρίς** να το κάνει (Απόφαση 4): η προβολή της λεπτομέρειας το δείχνει, η ρητή «Εφαρμογή μνήμης»
 * το κάνει. Γνωστά ids, κανένα ερώτημα (CHECK 3.91)· το σχήμα διαβάζεται μόνο όταν υπάρχει κάτι να κριθεί. `undefined` = χωρίς προμηθευτή.
 */
export async function readMemoryHints(ctx: AuthContext, batch: ImportBatchDefinition): Promise<ImportMemoryHints | undefined> {
  const scope = labelMemoryScopeOf(batch);
  if (scope === null) return undefined;
  const lines = batch.pages?.unmappedLines ?? [];
  const overrides = batch.pages?.lineOverrides ?? [];
  const identities = lines.flatMap((line) => (line.identity && lineDecisionOf(overrides, line) === null ? [line.identity] : []));
  const book = await readLabelMemoryBook(ctx, memoryKeysOf(scope, identities));
  const knownAttributeIds = book.size === 0 ? new Set<string>() : await familyAttributeIds(ctx, batch);
  const pricesEnabled = batch.target.purpose === 'attributes' && Boolean(batch.target.priceListVersionId);
  return memoryHintsFor(lines, overrides, { scope, book, knownAttributeIds, pricesEnabled, stamp: { by: ctx.uid, at: nowISO() } });
}

/** Εγγραφές ανά συναλλαγή στο άδειασμα: κάθε σβήσιμο γράφει έγγραφο **και** ίχνος, κάτω από το όριο των 500 εγγραφών. */
const CLEAR_CHUNK = 100;

const memoryOfSupplier = (ctx: AuthContext, supplierContactId: string) =>
  getAdminFirestore()
    .collection(COLLECTIONS.CATALOG_IMPORT_LABEL_MEMORY)
    .where('companyId', '==', ctx.companyId)
    .where('supplierContactId', '==', supplierContactId)
    .where('isDeleted', '==', false);

/** `GET /api/catalog/import-label-memory?supplier=` — η μνήμη ενός προμηθευτή, η πιο στηριγμένη πρώτα. */
export async function listLabelMemory(ctx: AuthContext, supplierContactId: string): Promise<LabelMemoryListView> {
  const snap = await memoryOfSupplier(ctx, supplierContactId).limit(IMPORT_LABEL_MEMORY_LIST_LIMIT + 1).get();
  const entries = snap.docs.slice(0, IMPORT_LABEL_MEMORY_LIST_LIMIT).map((doc) => doc.data() as ImportSupplierMemoryWire);
  const support = (entry: ImportSupplierMemoryWire) => entry.decisions.reduce((sum: number, decision: { readonly count: number }) => sum + decision.count, 0);
  return { entries: [...entries].sort((a, b) => support(b) - support(a) || a.printedLabel.localeCompare(b.printedLabel)), truncated: snap.size > IMPORT_LABEL_MEMORY_LIST_LIMIT };
}

/** `DELETE /api/catalog/import-label-memory/[id]` — η μνήμη μιας ετικέτας ξεχνιέται (soft delete, CAS). Η επόμενη έγκριση τη ξαναγεννά. */
export function deleteLabelMemory(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredSupplierMemory> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportSupplierMemoryDefinition>(scope, 'importLabelMemory', id);
    assertRevision(current, expectedRevision);
    return stageSoftDelete(scope, 'importLabelMemory', current);
  });
}

/** Μία δέσμη του αδειάσματος: ξαναδιαβάζει μέσα στη συναλλαγή, ώστε ό,τι άλλαξε ή σβήστηκε στο μεταξύ να μη μετρηθεί δύο φορές. */
function clearChunk(ctx: AuthContext, ids: readonly string[]): Promise<number> {
  return runCatalogTransaction(ctx, async (scope) => {
    const found = await Promise.all(ids.map((id) => readOwnedOrNull<ImportSupplierMemoryDefinition>(scope, 'importLabelMemory', id)));
    const live = found.filter((record): record is StoredSupplierMemory => record !== null);
    for (const record of live) stageSoftDelete(scope, 'importLabelMemory', record);
    return live.length;
  });
}

/** `POST /api/catalog/import-label-memory/clear` — όλη η μνήμη ενός προμηθευτή (Akeneo: «clear all mapping memory»), σε δέσμες. */
export async function clearLabelMemory(ctx: AuthContext, supplierContactId: string): Promise<ClearLabelMemoryResult> {
  let deleted = 0;
  for (;;) {
    const snap = await memoryOfSupplier(ctx, supplierContactId).limit(CLEAR_CHUNK).get();
    if (snap.empty) return { deleted };
    const done = await clearChunk(ctx, snap.docs.map((doc) => doc.id));
    deleted += done;
    if (done === 0) return { deleted };
  }
}
