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

import type { AuthContext } from '@/lib/auth';
import { pageTableAddressOf } from '@/subapps/catalog/import/import-keys';
import {
  EMPTY_LABEL_MEMORY,
  learnableOverrides,
  learnedEntry,
  memoryKeyOf,
  type LabelMemoryBook,
  type LabelMemoryScope,
  type LearnableOverride,
} from '@/subapps/catalog/import/label-memory';
import type { ImportBatchDefinition, ImportLabelMemoryDefinition, ImportProposalDefinition } from '@/subapps/catalog/types/catalog-import';
import { readForUpsert, runCatalogReadOnly, stageCreate, stageReplace, type CatalogReadScope, type CatalogTx, type CreateTarget, type StoredCatalogRecord } from './catalog-store.server';

type StoredLabelMemory = StoredCatalogRecord<ImportLabelMemoryDefinition>;

/** Ο προμηθευτής και η οικογένεια μιας παρτίδας ιδιοτήτων· `null` = χωρίς προμηθευτή, άρα χωρίς μνήμη. */
export function labelMemoryScopeOf(batch: Pick<ImportBatchDefinition, 'target'>): LabelMemoryScope | null {
  const { target } = batch;
  if (target.purpose !== 'attributes' || !target.supplierContactId) return null;
  return { supplierContactId: target.supplierContactId, familyId: target.familyId };
}

async function readEntries(scope: CatalogReadScope, keys: readonly string[]): Promise<LabelMemoryBook> {
  const found = await Promise.all(keys.map(async (key) => ({ key, read: await readForUpsert<ImportLabelMemoryDefinition>(scope, 'importLabelMemory', key) })));
  return new Map(found.flatMap(({ key, read }) => (read.current ? [[key, { id: read.current.id, decisions: read.current.decisions }] as const] : [])));
}

/** Η μνήμη για τα κλειδιά μιας σελίδας. Κανένα κλειδί ⇒ καμία ανάγνωση. */
export function readLabelMemoryBook(ctx: AuthContext, keys: readonly string[]): Promise<LabelMemoryBook> {
  if (keys.length === 0) return Promise.resolve(EMPTY_LABEL_MEMORY);
  return runCatalogReadOnly(ctx, (scope) => readEntries(scope, keys));
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
  if (memory === null || address === null) return NOTHING_TO_LEARN;
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
