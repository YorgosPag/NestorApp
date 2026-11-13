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
import { decidedField, decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import { applyHumanEdits, fieldAddress, humanEditFields, recordEdits, recordModelCodeEdit, type EditStamp } from '@/subapps/catalog/import/human-edits';
import { importProposalKey, priceGroupKeyOf } from '@/subapps/catalog/import/import-keys';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type {
  ExtractedGroup,
  ImportBatchDefinition,
  ImportProposalDefinition,
  ImportProposalField,
  ImportProposalRow,
  ImportValueEdit,
} from '@/subapps/catalog/types/catalog-import';
import type { UpdateImportProposalRequest } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportBaseValues } from '@/subapps/catalog/import/build-attribute-proposal';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import {
  assertRevision,
  readForUpsert,
  readOwned,
  runCatalogReadOnly,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
  type TargetAndCurrent,
} from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertImportBatchOpen, assertPurposeAuthority, batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { planProposal, resolveGroupIdentity, type PlannedProposal, type ProposalSibling } from './import-proposal-plan.server';
import { readBatchProposals, readImportBase } from './import-reads.server';
import { readValueMemoryEdits } from './import-value-memory.server';
import { releaseFinishedBatchMedia } from './media-quarantine-release.server';

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
 * Ό,τι διαβάζεται για μια ομάδα **έξω** από τη συναλλαγή (στιγμιότυπο μόνο-ανάγνωσης): η αναθεώρηση της πρότασης, η μνήμη τιμών της
 * γέννησης, η λυμένη ταυτότητα και η βάση σύγκρισης. Μέσα στη συναλλαγή ελέγχεται ότι η αναθεώρηση δεν άλλαξε (`planGroup`).
 */
export interface GroupInputs {
  readonly group: ExtractedGroup;
  readonly revision: SeenRevision;
  readonly memoryEdits: readonly ImportValueEdit[];
  readonly resolved: ExtractedGroup;
  readonly base: ImportBaseValues;
}

export async function readGroupInputs(ctx: AuthContext, batchId: string, group: ExtractedGroup): Promise<GroupInputs> {
  const stamp = { by: ctx.uid, at: nowISO() };
  const seen = await runCatalogReadOnly(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    const { current } = await readForUpsert<ImportProposalDefinition>(scope, 'importProposal', importProposalKey(batchId, group.groupKey));
    const pending = current?.status === 'pending' ? current : null;
    // §5.5.2 Β10: νέα πρόταση ⇒ η μνήμη τιμών του προμηθευτή, ως διορθώσεις με προέλευση, πριν το σχέδιο (ίδιος κριτής, ίδια ταυτότητα).
    const memoryEdits = current === null ? await readValueMemoryEdits(scope, batch, group, undefined, stamp) : [];
    const effective = current === null ? applyHumanEdits(group, memoryEdits, null) : effectiveGroup(group, pending);
    return { revision: current?.revision ?? null, memoryEdits, resolved: await resolveGroupIdentity(scope, batch.target, effective) };
  });
  const base = await readImportBase(ctx, seen.resolved.modelCode === null ? null : suggestCatalogCode(seen.resolved.modelCode));
  return { group, ...seen, base };
}

/** Η θέση της πρότασης μιας ομάδας μέσα στη συναλλαγή: ντετερμινιστικό id (`importProposalKey`) και ό,τι υπάρχει εκεί. */
export type GroupSlot = TargetAndCurrent<ImportProposalDefinition>;

export const readGroupSlot = (scope: CatalogTx, batchId: string, groupKey: string): Promise<GroupSlot> =>
  readForUpsert<ImportProposalDefinition>(scope, 'importProposal', importProposalKey(batchId, groupKey));

/**
 * Ίδια ομάδα ⇒ ίδιο έγγραφο. Εφαρμοσμένη ή απορριφθείσα πρόταση **δεν** ξαναγράφεται: η απόφαση του ανθρώπου μένει (`null`). Σε
 * εκκρεμή, οι ανθρώπινες αποφάσεις πεδίων **επιβιώνουν** όσο η τιμή δεν άλλαξε (`carryDecisions`), και οι **διορθώσεις** του
 * επιβιώνουν αυτούσιες (§5.5.2 Β6): η ξαναερμηνεία πίνακα (Β3), η αναβάθμιση σελίδας (Β3.1) και ο επανασχεδιασμός της πρότασης τιμών
 * (Β4 Δ5) δεν σβήνουν ό,τι έγραψε ο άνθρωπος. Το `extracted` μένει **καθαρή** ανάγνωση. Διόρθωση που μπήκε ανάμεσα στην ανάγνωση και
 * τη συναλλαγή ⇒ `revisionMismatch`, και ο καλών ξαναπροσπαθεί με τον νέο κατάλογο: ποτέ σχέδιο πάνω σε παλιές διορθώσεις.
 * **Μόνο αναγνώσεις** (`planProposal`): η εγγραφή είναι το `writeGroup`, ώστε πολλές ομάδες να μπαίνουν στην **ίδια** συναλλαγή
 * (Firestore: όλες οι αναγνώσεις πριν από κάθε εγγραφή). `sibling` = η πρόταση ιδιοτήτων που σχεδιάστηκε **στην ίδια** συναλλαγή (Β3.2).
 */
export async function planGroup(
  scope: CatalogTx,
  batch: StoredCatalogRecord<ImportBatchDefinition>,
  inputs: GroupInputs,
  slot: GroupSlot,
  sibling?: ProposalSibling | null,
): Promise<GroupPlan> {
  const { current } = slot;
  const { group } = inputs;
  if (current !== null && current.status !== 'pending') return { kind: 'closed', proposal: current };
  if ((current?.revision ?? null) !== inputs.revision) throw new CatalogWriteError('revisionMismatch', [], { currentRevision: current?.revision ?? 0 });
  const plan = await planProposal(scope, batch, inputs.resolved, inputs.base, sibling);
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
    // §5.5.2 Β10: η μνήμη τιμών μπαίνει **μόνο** στη γέννηση· η πρόταση που υπάρχει κρατά τον δικό της κατάλογο (και τις αναιρέσεις του).
    ...humanEditFields(current === null ? inputs.memoryEdits : current.edits ?? [], current?.modelCodeEdit ?? null),
  };
  return { kind: 'planned', definition };
}

/** Το σχέδιο μιας ομάδας: κλειστή πρόταση (μένει ως έχει) ή ορισμός προς εγγραφή. */
export type GroupPlan =
  | { readonly kind: 'closed'; readonly proposal: StoredImportProposal }
  | { readonly kind: 'planned'; readonly definition: ImportProposalDefinition };

/** Η πρόταση όπως **θα είναι** μετά τη συναλλαγή — ό,τι χρειάζεται η αδελφή πρόταση τιμών για την ταυτότητά της (§5.5.2 Β4 Δ4). */
export const siblingOfPlan = (plan: GroupPlan): ProposalSibling =>
  plan.kind === 'closed' ? { rows: plan.proposal.rows, status: plan.proposal.status } : { rows: plan.definition.rows, status: plan.definition.status };

/** Η εγγραφή του σχεδίου στη θέση του. */
export const writeGroup = (scope: CatalogTx, { target, current }: GroupSlot, definition: ImportProposalDefinition): StoredImportProposal =>
  current === null ? stageCreate(scope, 'importProposal', target, definition) : stageReplace(scope, 'importProposal', current, definition);

/** Πόσες φορές ξαναπροσπαθεί μια πράξη πρότασης όταν μπει διόρθωση ανάμεσα στην ανάγνωση και τη συναλλαγή. */
const PROPOSE_ATTEMPTS = 3;

/** Ξανατρέχει την πράξη σε `revisionMismatch` (διόρθωση ή απόφαση που μπήκε στο μεταξύ), ως `PROPOSE_ATTEMPTS` φορές. Ό,τι άλλο πετιέται. */
export async function retryOnRevisionMismatch<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= PROPOSE_ATTEMPTS || !(error instanceof CatalogWriteError) || error.kind !== 'revisionMismatch') throw error;
    }
  }
}

async function proposeOnce(ctx: AuthContext, batchId: string, group: ExtractedGroup): Promise<StoredImportProposal> {
  const inputs = await readGroupInputs(ctx, batchId, group);
  return runCatalogTransaction(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    assertImportBatchOpen(batch);
    const slot = await readGroupSlot(scope, batchId, group.groupKey);
    const plan = await planGroup(scope, batch, inputs, slot);
    return plan.kind === 'closed' ? plan.proposal : writeGroup(scope, slot, plan.definition);
  });
}

/**
 * Μία ομάδα σε μία συναλλαγή: σχέδιο απέναντι στα ζωντανά + εγγραφή. Η παρτίδα ελέγχεται **μέσα** στη συναλλαγή: ανάγνωση σελίδας
 * που ήταν ήδη σε εξέλιξη όταν πατήθηκε «Εγκατάλειψη» δεν γεννά πρόταση σε τελειωμένη παρτίδα (ADR-934 Ε3, η σειρά με την απόσυρση).
 * Το `group` είναι **καθαρή** ανάγνωση: οι διορθώσεις του ανθρώπου μπαίνουν εδώ, από τον κατάλογο της πρότασης (§5.5.2 Β6).
 */
export function proposeGroup(ctx: AuthContext, batchId: string, group: ExtractedGroup): Promise<StoredImportProposal> {
  return retryOnRevisionMismatch(() => proposeOnce(ctx, batchId, group));
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
      const address = fieldAddress(row.rowKey, importTargetKey(field.target));
      // Ο ΕΝΑΣ κανόνας (§5.5.2 Β9α): ίδιος με την αισιόδοξη όψη· `null` ⇒ επιστροφή στον κανόνα.
      return decisions.has(address) ? decidedField(field, decisions.get(address) ?? null) : field;
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

/**
 * §5.5.2 Β10: «επιστροφή στη μνήμη» για τα πεδία που το ζήτησαν (επανάληψη μιας αναιρεμένης εφαρμογής μνήμης). Ό,τι λέει η μνήμη **τώρα**,
 * με τον ίδιο κανόνα της γέννησης (`readValueMemoryEdits`)· αν δεν λέει πια τίποτα, το πεδίο μένει στην πηγή.
 */
async function withMemoryFallback(
  scope: CatalogTx,
  batch: ImportBatchDefinition,
  edited: ReturnType<typeof editedProposal>,
  extracted: ExtractedGroup,
  request: UpdateImportProposalRequest,
  stamp: EditStamp,
): Promise<ReturnType<typeof editedProposal>> {
  const wanted = new Set(request.edits.filter((edit) => edit.fallback === 'memory').map((edit) => fieldAddress(edit.rowKey, edit.targetKey)));
  if (wanted.size === 0) return edited;
  const found = await readValueMemoryEdits(scope, batch, extracted, edited.edits, stamp);
  const edits = [...edited.edits, ...found.filter((edit) => wanted.has(fieldAddress(edit.rowKey, edit.targetKey)))];
  return { ...edited, edits, group: applyHumanEdits(extracted, edits, edited.modelCodeEdit) };
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
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', proposal.batchId);
    const edited = await withMemoryFallback(scope, batch, editedProposal(proposal, request, stamp), proposal.extracted, request, stamp);
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
 * Το ερώτημα είναι έξω από τη συναλλαγή· η συναλλαγή κρίνει μόνο την κατάσταση της παρτίδας. Όταν κλείνει **τώρα**, η καραντίνα
 * μέσων της αποδεσμεύεται (ADR-934 §5.2.2 Μ-β5).
 */
export async function settleImportBatch(ctx: AuthContext, batchId: string): Promise<void> {
  const proposals = await readBatchProposals(ctx, batchId);
  if (proposals.some((proposal) => proposal.status === 'pending')) return;
  const closed = await runCatalogTransaction(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    if (batch.status !== 'reviewing' || (batch.pages?.failed.length ?? 0) > 0) return false;
    stageReplace(scope, 'importBatch', batch, { ...batchDefinitionOf(batch), status: 'closed' });
    return true;
  });
  if (closed) await releaseFinishedBatchMedia(ctx.companyId, batchId);
}

/**
 * `POST /api/catalog/imports/[id]/discard` — η παρτίδα εγκαταλείπεται **και** οι εκκρεμείς της προτάσεις αποσύρονται (μαλακή
 * διαγραφή, ίδιος δρόμος με τη νέα χαρτογράφηση)· ό,τι εφαρμόστηκε ή απορρίφθηκε μένει, είναι απόφαση. Ιδεμπότητη: σε ήδη
 * εγκαταλειμμένη παρτίδα ξανατρέχει μόνο η απόσυρση, άρα αν χαθεί μία φορά, τη συμπληρώνει η επόμενη κλήση (ADR-934 Ε3).
 * Το ίδιο και η αποδέσμευση της καραντίνας μέσων (ADR-934 §5.2.2 Μ-β5) — ιδεμπότητη, με δίχτυ το cron.
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
  await releaseFinishedBatchMedia(ctx.companyId, id);
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
