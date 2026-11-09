import 'server-only';

/**
 * Ο **γραφέας προτάσεων** (ADR-923 §5.5): κατασκευή από `ExtractedGroup` · απόφαση/διόρθωση ανθρώπου · απόρριψη · κλείσιμο και
 * εγκατάλειψη της παρτίδας (οι μεταβάσεις της που κρίνονται από τις προτάσεις της). Η εφαρμογή
 * ζει στο `import-apply.server.ts`.
 *
 * Η διόρθωση γράφεται στον **κατάλογο διορθώσεων** της πρότασης (§5.5.2 Β6), **όχι** μέσα στην ανάγνωση, και ξανατρέχει τον ίδιο
 * αγωγό: ό,τι διόρθωσε ο άνθρωπος περνά από τον ίδιο κωδικοποιητή και τον ίδιο κριτή, και καμία δεύτερη διαδρομή «τιμή από την
 * οθόνη» δεν υπάρχει. Η διορθωμένη τιμή έχει βεβαιότητα 1: την είδε άνθρωπος. Κάθε ξαναχτίσιμο της πρότασης ξαναεφαρμόζει τον
 * κατάλογο (`applyHumanEdits`), άρα αναίρεση γραμμής ή αναβάθμιση σελίδας δεν σβήνει ούτε διόρθωση ούτε κωδικό μοντέλου.
 * @module server/catalog/import-proposal-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import { applyHumanEdits, fieldAddress, humanEditFields, recordEdits, recordModelCodeEdit, type EditStamp } from '@/subapps/catalog/import/human-edits';
import { importProposalKey, priceGroupKeyOf } from '@/subapps/catalog/import/import-keys';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type {
  ExtractedGroup,
  ImportBatchDefinition,
  ImportProposalDefinition,
  ImportProposalField,
  ImportProposalRow,
} from '@/subapps/catalog/types/catalog-import';
import type { UpdateImportProposalRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { assertRevision, readForUpsert, readOwned, runCatalogReadOnly, runCatalogTransaction, stageCreate, stageReplace, stageSoftDelete, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertImportBatchOpen, assertPurposeAuthority, batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { planProposal, resolveGroupIdentity, type PlannedProposal } from './import-proposal-plan.server';
import { readBatchProposals, readImportBase } from './import-reads.server';

export type StoredImportProposal = StoredCatalogRecord<ImportProposalDefinition>;

/** Ο ορισμός **χωρίς** τον κατάλογο διορθώσεων: ο γραφέας που τον αλλάζει τον ξαναβάζει ρητά (§5.5.2 Β6). */
function coreDefinitionOf(proposal: StoredImportProposal): ImportProposalDefinition {
  const { batchId, groupKey, purpose, status, familyId, variantSchemeCode, modelCode, priceListVersionId, pages, extracted, rows, violations, appliedAt, appliedBy } = proposal;
  return { batchId, groupKey, purpose, status, familyId, variantSchemeCode, modelCode, priceListVersionId, pages, extracted, rows, violations, appliedAt, appliedBy };
}

export function proposalDefinitionOf(proposal: StoredImportProposal): ImportProposalDefinition {
  return { ...coreDefinitionOf(proposal), ...humanEditFields(proposal.edits ?? [], proposal.modelCodeEdit ?? null) };
}

/** Η πρόταση όπως τη βλέπει ο αγωγός: η καθαρή ανάγνωση **με** τις διορθώσεις του ανθρώπου (§5.5.2 Β6). */
const effectiveGroup = (group: ExtractedGroup, current: ImportProposalDefinition | null): ExtractedGroup =>
  applyHumanEdits(group, current?.edits ?? [], current?.modelCodeEdit ?? null);

const planFields = (plan: PlannedProposal) => ({
  familyId: plan.familyId,
  variantSchemeCode: plan.variantSchemeCode,
  modelCode: plan.modelCode,
  priceListVersionId: plan.priceListVersionId,
  rows: plan.rows,
  violations: plan.violations,
});

/** Η αναθεώρηση της πρότασης πάνω στην οποία διαβάστηκαν οι διορθώσεις· `null` = δεν υπήρχε. */
type SeenRevision = number | null;

/**
 * Ίδια ομάδα ⇒ ίδιο έγγραφο. Εφαρμοσμένη ή απορριφθείσα πρόταση **δεν** ξαναγράφεται: η απόφαση του ανθρώπου μένει. Σε εκκρεμή, οι
 * ανθρώπινες αποφάσεις πεδίων **επιβιώνουν** όσο η τιμή δεν άλλαξε (`carryDecisions`), και οι **διορθώσεις** του επιβιώνουν
 * αυτούσιες (§5.5.2 Β6): η ξαναερμηνεία πίνακα (Β3), η αναβάθμιση σελίδας (Β3.1) και ο επανασχεδιασμός της πρότασης τιμών (Β4 Δ5)
 * δεν σβήνουν ό,τι έγραψε ο άνθρωπος. Το `extracted` μένει **καθαρή** ανάγνωση. Διόρθωση που μπήκε ανάμεσα στην ανάγνωση και τη
 * συναλλαγή ⇒ `revisionMismatch`, και ο `proposeGroup` ξαναπροσπαθεί με τον νέο κατάλογο: ποτέ σχέδιο πάνω σε παλιές διορθώσεις.
 */
async function stageGroup(
  scope: CatalogTx,
  batch: StoredCatalogRecord<ImportBatchDefinition>,
  group: ExtractedGroup,
  plan: PlannedProposal,
  seen: SeenRevision,
): Promise<StoredImportProposal> {
  const key = importProposalKey(batch.id, group.groupKey);
  const { target, current } = await readForUpsert<ImportProposalDefinition>(scope, 'importProposal', key);
  if (current !== null && current.status !== 'pending') return current;
  if ((current?.revision ?? null) !== seen) throw new CatalogWriteError('revisionMismatch', [], { currentRevision: current?.revision ?? 0 });
  const rows = current === null ? plan.rows : carryDecisions(current.rows, plan.rows);
  const definition: ImportProposalDefinition = {
    batchId: batch.id,
    groupKey: group.groupKey,
    purpose: group.purpose ?? batch.target.purpose,
    status: 'pending',
    pages: group.pages,
    extracted: group,
    appliedAt: null,
    appliedBy: null,
    ...planFields({ ...plan, rows }),
    ...humanEditFields(current?.edits ?? [], current?.modelCodeEdit ?? null),
  };
  return current === null ? stageCreate(scope, 'importProposal', target, definition) : stageReplace(scope, 'importProposal', current, definition);
}

/** Πόσες φορές ξαναπροσπαθεί ο `proposeGroup` όταν μπει διόρθωση ανάμεσα στην ανάγνωση και τη συναλλαγή. */
const PROPOSE_ATTEMPTS = 3;

async function proposeOnce(ctx: AuthContext, batchId: string, group: ExtractedGroup): Promise<StoredImportProposal> {
  const seen = await runCatalogReadOnly(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    const { current } = await readForUpsert<ImportProposalDefinition>(scope, 'importProposal', importProposalKey(batchId, group.groupKey));
    const pending = current?.status === 'pending' ? current : null;
    return { revision: current?.revision ?? null, resolved: await resolveGroupIdentity(scope, batch.target, effectiveGroup(group, pending)) };
  });
  const base = await readImportBase(ctx, seen.resolved.modelCode === null ? null : suggestCatalogCode(seen.resolved.modelCode));
  return runCatalogTransaction(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    assertImportBatchOpen(batch);
    return stageGroup(scope, batch, group, await planProposal(scope, batch, seen.resolved, base), seen.revision);
  });
}

/**
 * Μία ομάδα σε μία συναλλαγή: σχέδιο απέναντι στα ζωντανά + εγγραφή. Η παρτίδα ελέγχεται **μέσα** στη συναλλαγή: ανάγνωση σελίδας
 * που ήταν ήδη σε εξέλιξη όταν πατήθηκε «Εγκατάλειψη» δεν γεννά πρόταση σε τελειωμένη παρτίδα (ADR-934 Ε3, η σειρά με την απόσυρση).
 * Το `group` είναι **καθαρή** ανάγνωση: οι διορθώσεις του ανθρώπου μπαίνουν εδώ, από τον κατάλογο της πρότασης (§5.5.2 Β6).
 */
export async function proposeGroup(ctx: AuthContext, batchId: string, group: ExtractedGroup): Promise<StoredImportProposal> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await proposeOnce(ctx, batchId, group);
    } catch (error) {
      if (attempt >= PROPOSE_ATTEMPTS || !(error instanceof CatalogWriteError) || error.kind !== 'revisionMismatch') throw error;
    }
  }
}

/**
 * §5.5.2 Β4 Δ5 — **ο κύριος δρόμος**: η πρόταση ιδιοτήτων ενός πίνακα κρίθηκε (έγκριση · απόρριψη) ⇒ η εκκρεμής πρόταση τιμών του
 * ξανασχεδιάζεται **αμέσως**, γιατί από εκείνη παίρνει την ταυτότητα των SKU: όσα γέννησε η έγκριση αποκτούν τιμή, όσα δεν γεννήθηκαν
 * γίνονται δηλωμένα «άγνωστα». Το δίχτυ ασφαλείας είναι ο επανασχεδιασμός σε κάθε διόρθωση (`updateImportProposal`). Ανάγνωση με
 * ντετερμινιστικό id, όχι ερώτημα: οι παρτίδες αρχείου δεν πληρώνουν τίποτα.
 */
export async function replanPriceSibling(ctx: AuthContext, decided: Pick<ImportProposalDefinition, 'batchId' | 'groupKey' | 'purpose'>): Promise<void> {
  if (decided.purpose !== 'attributes') return;
  const key = importProposalKey(decided.batchId, priceGroupKeyOf(decided.groupKey));
  const sibling = await runCatalogReadOnly(ctx, async (scope) => (await readForUpsert<ImportProposalDefinition>(scope, 'importProposal', key)).current);
  if (sibling?.status === 'pending') await proposeGroup(ctx, decided.batchId, sibling.extracted);
}

/**
 * Η τελευταία ανάγνωση της σελίδας είναι η αλήθεια: πρόταση σε εκκρεμότητα που γέννησε προηγούμενη ανάγνωση και δεν ξαναβρέθηκε
 * φεύγει, αλλιώς θα έμενε στον έλεγχο μια τιμή που το μοντέλο απέσυρε. Ο άνθρωπος δεν την έχει δει: η σελίδα διαβάζεται ακόμη.
 */
export function retireStalePageProposals(ctx: AuthContext, batchId: string, page: number, kept: ReadonlySet<string>): Promise<void> {
  return retireStaleProposals(ctx, batchId, kept, (proposal) => proposal.pages.includes(page));
}

/**
 * Το ίδιο για **όλη** την πηγή (αρχείο · xChange): νέα χαρτογράφηση που ομαδοποιεί αλλιώς (ADR-934 §5.1.13) δεν αφήνει δίπλα τις
 * παλιές ομάδες σε εκκρεμότητα — θα πρότειναν δεύτερη φορά τις ίδιες τιμές. Εφαρμοσμένες/απορριφθείσες μένουν: είναι απόφαση.
 */
export function retireStaleSourceProposals(ctx: AuthContext, batchId: string, kept: readonly StoredImportProposal[]): Promise<void> {
  return retireStaleProposals(ctx, batchId, new Set(kept.map((proposal) => proposal.id)), () => true);
}

async function retireStaleProposals(ctx: AuthContext, batchId: string, kept: ReadonlySet<string>, inScope: (proposal: Pick<ImportProposalDefinition, 'pages'>) => boolean): Promise<void> {
  const stale = (await readBatchProposals(ctx, batchId)).filter((proposal) => proposal.status === 'pending' && inScope(proposal) && !kept.has(proposal.id));
  if (stale.length === 0) return;
  await runCatalogTransaction(ctx, async (scope) => {
    const current = await Promise.all(stale.map((proposal) => readOwned<ImportProposalDefinition>(scope, 'importProposal', proposal.id)));
    for (const proposal of current) stageSoftDelete(scope, 'importProposal', proposal);
  });
}

/**
 * Απόφαση που ισχύει ακόμη: ίδια εισερχόμενη τιμή με αυτή πάνω στην οποία πάρθηκε. Η προέλευση (§5.5.2 Α1) ταξιδεύει **μαζί**
 * με την απόφαση: ανθρώπινη απόφαση που κρατήθηκε μένει ανθρώπινη. Απόφαση του **κανόνα** δεν μεταφέρεται: ο κανόνας ξανακρίνει με
 * τα σημερινά δεδομένα (§5.5.2 Β4 — η γραμμή τιμής που απορρίφθηκε γιατί το SKU δεν υπήρχε ακόμη ξανανοίγει μόλις γεννηθεί).
 * ⚠️ Μόνο το **ρητό** `rule`: απόφαση χωρίς προέλευση (πριν το Β1) μπορεί να ήταν ανθρώπινη και δεν χάνεται.
 */
function carriedDecision(next: ImportProposalField, previous: ImportProposalField | undefined): ImportProposalField {
  if (!previous || previous.decision === 'pending' || previous.decisionBy === 'rule') return next;
  const holds = canonicalJson(previous.incoming) === canonicalJson(next.incoming) && next.status !== 'unchanged';
  return holds ? { ...next, decision: previous.decision, decisionBy: decisionSourceOf(previous) } : next;
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
      return decision === undefined || (decision === 'accept' && field.incoming === null) ? field : { ...field, decision, decisionBy: 'human' as const };
    }),
  }));
}

/** Η μία πόρτα των αποφάσεων (διόρθωση · απόρριψη): ίδια αναθεώρηση, πρόταση σε εκκρεμότητα, παρτίδα ανοιχτή. */
async function readPendingProposal(scope: CatalogTx, id: string, expectedRevision: number): Promise<StoredImportProposal> {
  const proposal = await readOwned<ImportProposalDefinition>(scope, 'importProposal', id);
  assertRevision(proposal, expectedRevision);
  if (proposal.status !== 'pending') throw new CatalogWriteError('immutable', [{ code: 'fieldImmutable', path: 'status', params: { field: 'status' } }]);
  assertImportBatchOpen(await readOwned<ImportBatchDefinition>(scope, 'importBatch', proposal.batchId));
  return proposal;
}

/**
 * Οι διορθώσεις του αιτήματος πάνω στον κατάλογο της πρότασης (§5.5.2 Β6). Η πηγή μένει ανέγγιχτη· η διορθωμένη τιμή έχει
 * βεβαιότητα 1 (την είδε άνθρωπος). Το ίδιο κελί της πρότασης μετά: διόρθωση = **ανθρώπινη** αποδοχή της (`withEditDecisions`).
 */
function editedProposal(proposal: ImportProposalDefinition, request: UpdateImportProposalRequest, stamp: EditStamp) {
  const edits = recordEdits(proposal.edits ?? [], request.edits, proposal.extracted, stamp);
  const modelCodeEdit = recordModelCodeEdit(proposal.modelCodeEdit ?? null, request.modelCode, proposal.extracted, stamp);
  return { edits, modelCodeEdit, group: applyHumanEdits(proposal.extracted, edits, modelCodeEdit) };
}

/** Πεδίο που ο άνθρωπος μόλις διόρθωσε (όχι επανέφερε) έχει απόφαση **του**: την τιμή του τη δέχεται, εκτός αν ο κριτής βρει εύρημα. */
function withEditDecisions(rows: readonly ImportProposalRow[], request: UpdateImportProposalRequest): ImportProposalRow[] {
  const typed = new Set(request.edits.filter((edit) => edit.revert !== true).map((edit) => fieldAddress(edit.rowKey, edit.targetKey)));
  if (typed.size === 0) return [...rows];
  return rows.map((row) => ({
    ...row,
    fields: row.fields.map((field) => {
      const ours = typed.has(fieldAddress(row.rowKey, importTargetKey(field.target)));
      return ours && field.incoming !== null && field.issues.length === 0 && field.status !== 'unchanged' ? { ...field, decision: 'accept' as const, decisionBy: 'human' as const } : field;
    }),
  }));
}

/** `PUT /api/catalog/import-proposals/[id]` — αποφάσεις και διορθώσεις. Ο επανυπολογισμός τρέχει κάθε φορά απέναντι στα ζωντανά. */
export async function updateImportProposal(ctx: AuthContext, id: string, request: UpdateImportProposalRequest): Promise<StoredImportProposal> {
  const stamp = { by: ctx.uid, at: nowISO() };
  const preview = await runCatalogTransaction(ctx, (scope) => readOwned<ImportProposalDefinition>(scope, 'importProposal', id));
  await assertPurposeAuthority(ctx, preview.purpose);
  const base = await readImportBase(ctx, preview.modelCode);
  return runCatalogTransaction(ctx, async (scope) => {
    const proposal = await readPendingProposal(scope, id, request.expectedRevision);
    const edited = editedProposal(proposal, request, stamp);
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', proposal.batchId);
    const plan = await planProposal(scope, batch, edited.group, base);
    const rows = withDecisions(withEditDecisions(carryDecisions(proposal.rows, plan.rows), request), request);
    return stageReplace(scope, 'importProposal', proposal, {
      ...coreDefinitionOf(proposal),
      ...planFields({ ...plan, rows }),
      ...humanEditFields(edited.edits, edited.modelCodeEdit),
    });
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

/**
 * `POST /api/catalog/imports/[id]/discard` — η παρτίδα εγκαταλείπεται **και** οι εκκρεμείς της προτάσεις αποσύρονται (μαλακή
 * διαγραφή, ίδιος δρόμος με τη νέα χαρτογράφηση)· ό,τι εφαρμόστηκε ή απορρίφθηκε μένει, είναι απόφαση. Ιδεμπότητη: σε ήδη
 * εγκαταλειμμένη παρτίδα ξανατρέχει μόνο η απόσυρση, άρα αν χαθεί μία φορά, τη συμπληρώνει η επόμενη κλήση (ADR-934 Ε3).
 */
export async function discardImportBatch(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredImportBatch> {
  const discarded = await runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    await assertPurposeAuthority(ctx, current.target.purpose);
    if (current.status === 'discarded') return current;
    assertRevision(current, expectedRevision);
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status: 'discarded' });
  });
  await retireStaleProposals(ctx, id, new Set(), () => true);
  return discarded;
}

/** `POST /api/catalog/import-proposals/[id]/reject` — τίποτα δεν γράφεται, και η απόφαση μένει στο ιστορικό. */
export async function rejectImportProposal(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredImportProposal> {
  const rejected = await runCatalogTransaction(ctx, async (scope) => {
    const proposal = await readPendingProposal(scope, id, expectedRevision);
    await assertPurposeAuthority(ctx, proposal.purpose);
    return stageReplace(scope, 'importProposal', proposal, { ...proposalDefinitionOf(proposal), status: 'rejected' });
  });
  await replanPriceSibling(ctx, rejected);
  await settleImportBatch(ctx, rejected.batchId);
  return rejected;
}
