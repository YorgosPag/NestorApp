import 'server-only';

/**
 * Ο **αναγνώστης και γραφέας της μνήμης τιμών** του προμηθευτή (ADR-923 §5.5.2 Β10) — στην **ίδια** συλλογή με τη μνήμη γραμμών
 * (`catalog_import_label_memory`, `subject: 'value'`), με τον ίδιο αναγνώστη (`readMemoryEntries`) και τον ίδιο διακόπτη (`learnsLabels`).
 *
 * 🔑 **Εφαρμογή μόνο στη γέννηση της πρότασης** (και στη ρητή «Εφαρμογή μνήμης»): ποτέ στο ξαναχτίσιμο, ώστε η αναίρεση του ανθρώπου να
 *    μένει αναίρεση — ίδια σημασία με τη μνήμη γραμμών.
 * 🔑 **Μάθηση μόνο στην έγκριση**, μέσα στη συναλλαγή της· δύο φάσεις όπως το `readLearning`/`stageLearning` (Firestore: αναγνώσεις πριν
 *    από κάθε εγγραφή).
 * 🔑 Γνωστά ids, κανένα ερώτημα (CHECK 3.91).
 * @module server/catalog/import-value-memory.server
 */

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { importTextContextOf } from '@/subapps/catalog/import/proposal-values';
import {
  learnableValues,
  learnedValueEntry,
  valueMemoryEditsFor,
  valueMemoryHintsFor,
  valueMemoryKeysOf,
  type LearnableValue,
  type LearningProposal,
  type ValueMemoryApplication,
  type ValueMemorySchema,
} from '@/subapps/catalog/import/value-memory';
import type { EditStamp } from '@/subapps/catalog/import/human-edits';
import type { ExtractedGroup, ImportBatchDefinition, ImportValueEdit, ImportValueMemoryAnswer, ImportValueMemoryDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire, ImportValueMemoryHint } from '@/subapps/catalog/types/catalog-import-requests';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readForUpsert, runCatalogReadOnly, stageCreate, stageReplace, type CatalogReadScope, type CatalogTx, type CreateTarget, type StoredCatalogRecord } from './catalog-store.server';
import { labelMemoryScopeOf, learnsLabels, readMemoryEntries } from './import-label-memory.server';

/** Ο προμηθευτής της παρτίδας, όταν η ομάδα είναι ιδιοτήτων· αλλιώς καμία μνήμη τιμών. */
function supplierOf(batch: ImportBatchDefinition, group: Pick<ExtractedGroup, 'purpose'>): string | null {
  const purpose = group.purpose ?? batch.target.purpose;
  return purpose === 'attributes' ? labelMemoryScopeOf(batch)?.supplierContactId ?? null : null;
}

/** Το σχήμα της οικογένειας και ο ουδέτερος κωδικοποιητής της εισαγωγής — ο **ίδιος** κριτής με την πρόταση. */
async function memorySchemaOf(scope: CatalogReadScope, batch: ImportBatchDefinition): Promise<ValueMemorySchema | null> {
  if (batch.target.purpose !== 'attributes') return null;
  const schema = await readSchemaSnapshot(scope, batch.target.familyId, batch.target.variantSchemeCode);
  return { attributes: schema.attributes, context: importTextContextOf(schema.registry) };
}

/** Το σχήμα και το βιβλίο μνήμης για μια ανάγνωση· `null` = τίποτα να κριθεί (χωρίς προμηθευτή, ή καμία αδιάβαστη πηγή). */
async function applicationFor(
  scope: CatalogReadScope,
  batch: ImportBatchDefinition,
  group: ExtractedGroup,
  edits: readonly ImportValueEdit[] | undefined,
  stamp: EditStamp,
): Promise<ValueMemoryApplication | null> {
  const supplierContactId = supplierOf(batch, group);
  const schema = supplierContactId === null ? null : await memorySchemaOf(scope, batch);
  if (supplierContactId === null || schema === null) return null;
  const keys = valueMemoryKeysOf(group, edits, supplierContactId, schema);
  if (keys.length === 0) return null;
  const book = await readMemoryEntries<ImportValueMemoryAnswer>(scope, keys);
  return { ...schema, supplierContactId, book, stamp };
}

/** Οι διορθώσεις της μνήμης για μια ανάγνωση, πάνω στις διορθώσεις που ήδη υπάρχουν (ο άνθρωπος πρώτος). Κενό = τίποτα. */
export async function readValueMemoryEdits(
  scope: CatalogReadScope,
  batch: ImportBatchDefinition,
  group: ExtractedGroup,
  edits: readonly ImportValueEdit[] | undefined,
  stamp: EditStamp,
): Promise<ImportValueEdit[]> {
  const application = await applicationFor(scope, batch, group, edits, stamp);
  return application === null ? [] : valueMemoryEditsFor(group, edits, application);
}

/** Η πρόταση όπως τη βλέπουν οι υποδείξεις: εκκρεμής πρόταση ιδιοτήτων, με τον κατάλογο διορθώσεών της. */
type HintedProposal = Pick<ImportProposalWire, 'id' | 'status' | 'purpose' | 'extracted' | 'edits'>;

/**
 * Τι ξέρει η μνήμη τιμών για τις **εκκρεμείς** προτάσεις μιας παρτίδας (σύγκρουση · «δεν ισχύει πλέον» · αναιρεμένη), **χωρίς** να το
 * εφαρμόσει: ένα σχήμα, ένα βιβλίο, γνωστά ids. Κενό = τίποτα να πει.
 */
export async function readBatchValueMemoryHints(ctx: AuthContext, batch: ImportBatchDefinition, proposals: readonly HintedProposal[]): Promise<ImportValueMemoryHint[]> {
  const supplierContactId = labelMemoryScopeOf(batch)?.supplierContactId ?? null;
  const pending = proposals.filter((proposal) => proposal.status === 'pending' && proposal.purpose === 'attributes');
  if (supplierContactId === null || pending.length === 0) return [];
  return runCatalogReadOnly(ctx, async (scope) => {
    const schema = await memorySchemaOf(scope, batch);
    if (schema === null) return [];
    const keys = [...new Set(pending.flatMap((proposal) => valueMemoryKeysOf(proposal.extracted, proposal.edits, supplierContactId, schema)))];
    if (keys.length === 0) return [];
    const book = await readMemoryEntries<ImportValueMemoryAnswer>(scope, keys);
    const application = { ...schema, supplierContactId, book, stamp: { by: ctx.uid, at: nowISO() } };
    return pending.flatMap((proposal) => valueMemoryHintsFor(proposal.extracted, proposal.edits, application).map((hint) => ({ ...hint, proposalId: proposal.id })));
  });
}

/* ── Μάθηση στην έγκριση ──────────────────────────────────────────────────────────────────────────────────────────────── */

interface ValueLearningStep {
  readonly value: LearnableValue;
  readonly target: CreateTarget;
  readonly current: StoredCatalogRecord<ImportValueMemoryDefinition> | null;
}

export interface ValueLearningPlan {
  readonly supplierContactId: string | null;
  readonly steps: readonly ValueLearningStep[];
}

const NOTHING_TO_LEARN: ValueLearningPlan = { supplierContactId: null, steps: [] };

/** Πρώτη φάση, πριν γράψει η έγκριση: οι τιμές που μαθαίνει η πρόταση και τα τρέχοντα έγγραφά τους. */
export async function readValueLearning(scope: CatalogTx, batch: ImportBatchDefinition, proposal: LearningProposal): Promise<ValueLearningPlan> {
  const supplierContactId = supplierOf(batch, proposal.extracted);
  if (supplierContactId === null || !learnsLabels(batch) || (proposal.edits ?? []).length === 0) return NOTHING_TO_LEARN;
  const schema = await memorySchemaOf(scope, batch);
  if (schema === null) return NOTHING_TO_LEARN;
  const values = learnableValues(proposal, supplierContactId, schema);
  const steps = await Promise.all(values.map(async (value) => ({ value, ...(await readForUpsert<ImportValueMemoryDefinition>(scope, 'importLabelMemory', value.key)) })));
  return { supplierContactId, steps };
}

/** Δεύτερη φάση, μετά τις εγγραφές της έγκρισης: +1 σε κάθε απάντηση που εγκρίθηκε. */
export function stageValueLearning(scope: CatalogTx, plan: ValueLearningPlan, batchId: string): void {
  if (plan.supplierContactId === null) return;
  const stamp = { batchId, by: scope.ctx.uid, at: scope.now };
  for (const { value, target, current } of plan.steps) {
    const next = learnedValueEntry(current, plan.supplierContactId, value, stamp);
    if (current) stageReplace(scope, 'importLabelMemory', current, next);
    else stageCreate(scope, 'importLabelMemory', target, next);
  }
}
