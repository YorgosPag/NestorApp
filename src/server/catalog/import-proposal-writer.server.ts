import 'server-only';

/**
 * Ο **γραφέας προτάσεων** (ADR-923 §5.5): κατασκευή από `ExtractedGroup` · απόφαση/διόρθωση ανθρώπου · απόρριψη. Η εφαρμογή
 * ζει στο `import-apply.server.ts`.
 *
 * Η διόρθωση αλλάζει την **πηγή** της πρότασης και ξανατρέχει τον ίδιο αγωγό: ό,τι διόρθωσε ο άνθρωπος περνά από τον ίδιο
 * κωδικοποιητή και τον ίδιο κριτή, και καμία δεύτερη διαδρομή «τιμή από την οθόνη» δεν υπάρχει. Η διορθωμένη τιμή έχει
 * βεβαιότητα 1: την είδε άνθρωπος.
 * @module server/catalog/import-proposal-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { importProposalKey } from '@/subapps/catalog/import/import-keys';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type {
  ExtractedCell,
  ExtractedGroup,
  ExtractedRow,
  ImportBatchDefinition,
  ImportProposalDefinition,
  ImportProposalField,
  ImportProposalRow,
} from '@/subapps/catalog/types/catalog-import';
import type { ImportFieldEditInput, UpdateImportProposalRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { assertRevision, readForUpsert, readOwned, runCatalogTransaction, stageCreate, stageReplace, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertPurposeAuthority, batchDefinitionOf } from './import-batch-writer.server';
import { planProposal, type PlannedProposal } from './import-proposal-plan.server';
import { readBatchProposals, readImportBase } from './import-reads.server';

export type StoredImportProposal = StoredCatalogRecord<ImportProposalDefinition>;

export function proposalDefinitionOf(proposal: StoredImportProposal): ImportProposalDefinition {
  const { batchId, groupKey, purpose, status, familyId, variantSchemeCode, modelCode, priceListVersionId, pages, extracted, rows, violations, appliedAt, appliedBy } = proposal;
  return { batchId, groupKey, purpose, status, familyId, variantSchemeCode, modelCode, priceListVersionId, pages, extracted, rows, violations, appliedAt, appliedBy };
}

const planFields = (plan: PlannedProposal) => ({
  familyId: plan.familyId,
  variantSchemeCode: plan.variantSchemeCode,
  modelCode: plan.modelCode,
  priceListVersionId: plan.priceListVersionId,
  rows: plan.rows,
  violations: plan.violations,
});

/** Ίδια ομάδα ⇒ ίδιο έγγραφο. Εφαρμοσμένη ή απορριφθείσα πρόταση **δεν** ξαναγράφεται: η απόφαση του ανθρώπου μένει. */
async function stageGroup(scope: CatalogTx, batch: StoredCatalogRecord<ImportBatchDefinition>, group: ExtractedGroup, plan: PlannedProposal): Promise<StoredImportProposal> {
  const key = importProposalKey(batch.id, group.groupKey);
  const { target, current } = await readForUpsert<ImportProposalDefinition>(scope, 'importProposal', key);
  if (current !== null && current.status !== 'pending') return current;
  const definition: ImportProposalDefinition = {
    batchId: batch.id,
    groupKey: group.groupKey,
    purpose: batch.target.purpose,
    status: 'pending',
    pages: group.pages,
    extracted: group,
    appliedAt: null,
    appliedBy: null,
    ...planFields(plan),
  };
  return current === null ? stageCreate(scope, 'importProposal', target, definition) : stageReplace(scope, 'importProposal', current, definition);
}

/** Μία ομάδα σε μία συναλλαγή: σχέδιο απέναντι στα ζωντανά + εγγραφή. */
export async function proposeGroup(ctx: AuthContext, batchId: string, group: ExtractedGroup): Promise<StoredImportProposal> {
  const base = await readImportBase(ctx, group.modelCode === null ? null : suggestCatalogCode(group.modelCode));
  return runCatalogTransaction(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    return stageGroup(scope, batch, group, await planProposal(scope, batch.target, group, base));
  });
}

const fieldAddress = (rowKey: string, targetKey: string): string => `${rowKey}\u0000${targetKey}`;

function editedCells(rowKey: string, cells: readonly ExtractedCell[], edits: ReadonlyMap<string, string>): ExtractedCell[] {
  return cells.map((cell) => {
    const text = edits.get(fieldAddress(rowKey, importTargetKey(cell.target)));
    return text === undefined ? cell : { ...cell, text: text.trim() === '' ? null : text, confidence: 1, flags: [] };
  });
}

function editedGroup(group: ExtractedGroup, inputs: readonly ImportFieldEditInput[], modelCode: string | null): ExtractedGroup {
  const edits = new Map(inputs.map((edit) => [fieldAddress(edit.rowKey, edit.targetKey), edit.text]));
  const rows = group.rows.map((row): ExtractedRow => ({ ...row, cells: editedCells(row.rowKey, row.cells, edits) }));
  return { ...group, modelCode: modelCode ?? group.modelCode, rows, sharedCells: editedCells(`model:${group.groupKey}`, group.sharedCells, edits) };
}

/** Απόφαση ανθρώπου που ισχύει ακόμη: ίδια εισερχόμενη τιμή με αυτή πάνω στην οποία αποφάσισε. */
function carriedDecision(next: ImportProposalField, previous: ImportProposalField | undefined): ImportProposalField {
  if (!previous || previous.decision === 'pending') return next;
  return canonicalJson(previous.incoming) === canonicalJson(next.incoming) && next.status !== 'unchanged' ? { ...next, decision: previous.decision } : next;
}

function carryDecisions(previous: readonly ImportProposalRow[], next: readonly ImportProposalRow[]): ImportProposalRow[] {
  const fields = new Map(previous.flatMap((row) => row.fields.map((field) => [fieldAddress(row.rowKey, importTargetKey(field.target)), field] as const)));
  return next.map((row) => ({ ...row, fields: row.fields.map((field) => carriedDecision(field, fields.get(fieldAddress(row.rowKey, importTargetKey(field.target))))) }));
}

function withDecisions(rows: readonly ImportProposalRow[], request: UpdateImportProposalRequest): ImportProposalRow[] {
  const decisions = new Map(request.decisions.map((input) => [fieldAddress(input.rowKey, input.targetKey), input.decision]));
  return rows.map((row) => ({
    ...row,
    fields: row.fields.map((field) => {
      const decision = decisions.get(fieldAddress(row.rowKey, importTargetKey(field.target)));
      // Τιμή που δεν διαβάστηκε δεν γίνεται αποδεκτή: δεν υπάρχει τι να γραφτεί, θέλει διόρθωση.
      return decision === undefined || (decision === 'accept' && field.incoming === null) ? field : { ...field, decision };
    }),
  }));
}

async function readPendingProposal(scope: CatalogTx, id: string, expectedRevision: number): Promise<StoredImportProposal> {
  const proposal = await readOwned<ImportProposalDefinition>(scope, 'importProposal', id);
  assertRevision(proposal, expectedRevision);
  if (proposal.status !== 'pending') throw new CatalogWriteError('immutable', [{ code: 'fieldImmutable', path: 'status', params: { field: 'status' } }]);
  return proposal;
}

/** `PUT /api/catalog/import-proposals/[id]` — αποφάσεις και διορθώσεις. Ο επανυπολογισμός τρέχει κάθε φορά απέναντι στα ζωντανά. */
export async function updateImportProposal(ctx: AuthContext, id: string, request: UpdateImportProposalRequest): Promise<StoredImportProposal> {
  const preview = await runCatalogTransaction(ctx, (scope) => readOwned<ImportProposalDefinition>(scope, 'importProposal', id));
  await assertPurposeAuthority(ctx, preview.purpose);
  const group = editedGroup(preview.extracted, request.edits, request.modelCode);
  const base = await readImportBase(ctx, preview.modelCode);
  return runCatalogTransaction(ctx, async (scope) => {
    const proposal = await readPendingProposal(scope, id, request.expectedRevision);
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', proposal.batchId);
    const plan = await planProposal(scope, batch.target, group, base);
    const rows = withDecisions(carryDecisions(proposal.rows, plan.rows), request);
    return stageReplace(scope, 'importProposal', proposal, { ...proposalDefinitionOf(proposal), ...planFields({ ...plan, rows }), extracted: group });
  });
}

/**
 * Ο **κύκλος ζωής**: παρτίδα σε έλεγχο κλείνει όταν δεν μένει ούτε πρόταση σε εκκρεμότητα ούτε αποτυχημένη σελίδα. Ιδεμπότητο,
 * και τρέχει μετά από κάθε απόφαση: αν χαθεί μία φορά, το ξανακρίνει η επόμενη, και τα δεδομένα έχουν ήδη γραφτεί.
 * Το ερώτημα είναι έξω από τη συναλλαγή· η συναλλαγή κρίνει μόνο την κατάσταση της παρτίδας.
 */
export async function settleImportBatch(ctx: AuthContext, batchId: string): Promise<void> {
  const proposals = await readBatchProposals(ctx, batchId);
  if (proposals.some((proposal) => proposal.status === 'pending')) return;
  await runCatalogTransaction(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    if (batch.status !== 'reviewing' || (batch.pages?.failed.length ?? 0) > 0) return;
    stageReplace(scope, 'importBatch', batch, { ...batchDefinitionOf(batch), status: 'closed' });
  });
}

/** `POST /api/catalog/import-proposals/[id]/reject` — τίποτα δεν γράφεται, και η απόφαση μένει στο ιστορικό. */
export async function rejectImportProposal(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredImportProposal> {
  const rejected = await runCatalogTransaction(ctx, async (scope) => {
    const proposal = await readPendingProposal(scope, id, expectedRevision);
    await assertPurposeAuthority(ctx, proposal.purpose);
    return stageReplace(scope, 'importProposal', proposal, { ...proposalDefinitionOf(proposal), status: 'rejected' });
  });
  await settleImportBatch(ctx, rejected.batchId);
  return rejected;
}
