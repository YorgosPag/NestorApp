import 'server-only';

/**
 * **Ρητή εφαρμογή και αναίρεση της μνήμης σε υπάρχουσα παρτίδα** (ADR-923 §5.5.2 Β5.2 · Απόφαση 4).
 *
 * Η μνήμη του προμηθευτή μπαίνει μόνη της **μόνο** σε νέα ανάγνωση σελίδας. Σε σελίδες που ήδη διαβάστηκαν μπαίνει **μόνο** όταν ο
 * άνθρωπος το ζητήσει: ποτέ στο άνοιγμα, ποτέ σιωπηλά. Εδώ ζει αυτό το κουμπί, και το αντίστροφό του («αναίρεση όλων από μνήμη»).
 *
 * 🔑 **Ο ίδιος πυρήνας** με την απόφαση γραμμής (`import-table-rebuild.server`): η φυλαγμένη απάντηση και η ανασύνθεση από το PDF, οι
 *    αποφάσεις από πάνω, ο ίδιος αγωγός. **Δομικά χωρίς πληρωμή**: ούτε αυτό το αρχείο ούτε ο πυρήνας εισάγουν τον αναλυτή.
 * 🔑 **Ο ίδιος κανόνας** με την ανάγνωση (`memoryOverridesFor`): άνθρωπος πρώτα, μόνο ιδιότητες του σχήματος, τιμή μόνο με τιμοκατάλογο
 *    **και** δικαίωμα τιμολόγησης, σύγκρουση ⇒ τίποτα.
 * 🔑 **Παλιά παρτίδα** (πριν το Β5): το ξαναχτίσιμο ξαναπαράγει την ταυτότητα κάθε γραμμής, οπότε η παρτίδα την αποκτά **με αυτή την
 *    πράξη**, όχι στο άνοιγμα. Είναι η πρακτική του Revit: αναβάθμιση που μένει μόνο με ρητή αποθήκευση.
 * 🔑 Ένας πίνακας τη φορά· πίνακας που δεν ξαναχτίζεται αρνείται με λόγο και οι υπόλοιποι συνεχίζουν.
 * @module server/catalog/import-memory-apply.server
 */

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { pageTableAddressOf, pageTableGroupKey, priceGroupKeyOf } from '@/subapps/catalog/import/import-keys';
import { isMemoryOverride, memoryKeysOf, memoryOverridesFor, withMemoryApplied } from '@/subapps/catalog/import/label-memory';
import { tableOverridesOf } from '@/subapps/catalog/import/page-line-overrides';
import { tableLineIdentities } from '@/subapps/catalog/import/page-table-reading';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ImportBatchDefinition, ImportLineOverride } from '@/subapps/catalog/types/catalog-import';
import type {
  ImportMemoryActionOutcome,
  ImportMemoryActionRequest,
  ImportMemoryActionResult,
  ImportMemoryTableRefusal,
  ImportProposalWire,
} from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_MAX_LINE_OVERRIDES } from '@/subapps/catalog/vocabulary/catalog-import';
import { readOwned, runCatalogReadOnly } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertImportBatchOpen, assertPurposeAuthority, type StoredImportBatch } from './import-batch-writer.server';
import { labelMemoryScopeOf, readLabelMemoryBook } from './import-label-memory.server';
import { memoryMayPrice } from './import-line-memory.server';
import { readBatchProposals, readImportBatchDetail } from './import-reads.server';
import { runValueMemoryAction } from './import-value-memory-action.server';
import { commitTable } from './import-table-commit.server';
import { pageBasis, prepareTable, readBatchSchema, tableOf, type Judged, type TableBasis } from './import-table-rebuild.server';

interface TableAddress {
  readonly page: number;
  readonly table: string;
}

/** Ό,τι ξέρει η πράξη για την παρτίδα, διαβασμένο μία φορά. */
interface MemoryRun {
  readonly ctx: AuthContext;
  readonly batch: StoredImportBatch;
  readonly schema: CatalogSchemaSnapshot;
  /** Τιμή από μνήμη: τιμοκατάλογος στην παρτίδα **και** δικαίωμα τιμολόγησης (ίδιο δόγμα με το `judgePriceLine`). */
  readonly canPrice: boolean;
  readonly proposals: readonly ImportProposalWire[];
}

type TableResult = { readonly kind: 'skipped' } | { readonly kind: 'done'; readonly lines: number } | { readonly kind: 'refused'; readonly refusal: ImportMemoryTableRefusal } | { readonly kind: 'full' };

const pendingProposal = (run: MemoryRun, groupKey: string): boolean => run.proposals.some((proposal) => proposal.groupKey === groupKey && proposal.status === 'pending');

/** Οι πίνακες με **εκκρεμή** πρόταση ιδιοτήτων, σε σελίδες που διαβάστηκαν: εγκεκριμένη ή απορριμμένη πρόταση δεν αλλάζει πια. */
function openTables(run: MemoryRun): TableAddress[] {
  const done = new Set(run.batch.pages?.done ?? []);
  return run.proposals.flatMap((proposal) => {
    const address = proposal.purpose === 'attributes' && proposal.status === 'pending' ? pageTableAddressOf(proposal.groupKey) : null;
    return address && done.has(address.page) ? [address] : [];
  });
}

async function openRun(ctx: AuthContext, id: string): Promise<MemoryRun> {
  const batch = await runCatalogReadOnly(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  assertImportBatchOpen(batch);
  const schema = await readBatchSchema(ctx, batch);
  if (schema === null || batch.target.purpose !== 'attributes') throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'target' }]);
  const canPrice = await memoryMayPrice(ctx, batch);
  return { ctx, batch, schema, canPrice, proposals: await readBatchProposals(ctx, id) };
}

/** Ο πίνακας όπως τον είδε το μοντέλο. Ίδια σελίδα ⇒ ίδιο PDF: η ανασύνθεση γίνεται μία φορά ανά σελίδα. */
function tableBasisOf(run: MemoryRun, pages: Map<number, ReturnType<typeof pageBasis>>, address: TableAddress): Promise<Judged<TableBasis>> {
  const page = pages.get(address.page) ?? pageBasis(run.ctx, run.batch, address.page);
  pages.set(address.page, page);
  return page.then((basis) => (basis.ok ? tableOf(basis.value, address.table) : basis));
}

/**
 * Κρίνει στη μνήμη, και μόνο αν πέρασε γράφει τις αποφάσεις **μαζί** με ό,τι παράγουν, σε μία συναλλαγή (§5.5.2 Β3.2, ίδιος γραφέας με
 * την απόφαση γραμμής). Απόφαση ανθρώπου που μπήκε στον πίνακα στο μεταξύ ⇒ revisionMismatch: ο πίνακας δεν γράφεται πάνω σε άλλες αποφάσεις.
 */
async function rebuild(run: MemoryRun, basis: TableBasis, next: readonly ImportLineOverride[], rewrite: (own: readonly ImportLineOverride[]) => ImportLineOverride[]): Promise<Judged<null>> {
  const prepared = prepareTable(run.schema, basis, next);
  if (!prepared.ok) return prepared;
  await commitTable(run.ctx, run.batch.id, prepared.value, rewrite);
  return { ok: true, value: null };
}

const refusedAt = (address: TableAddress, judged: { readonly reason: ImportMemoryTableRefusal['reason'] }): TableResult => ({ kind: 'refused', refusal: { ...address, reason: judged.reason } });

/** Πίνακας με γραμμές χωρίς ταυτότητα, ή αποφάσεις χωρίς ταυτότητα: το ξαναχτίσιμο θα τις δώσει (η «αποθήκευση» της παλιάς παρτίδας). */
function lacksIdentity(run: MemoryRun, address: TableAddress, own: readonly ImportLineOverride[]): boolean {
  const lines = (run.batch.pages?.unmappedLines ?? []).filter((line) => line.page === address.page && line.table === address.table);
  return lines.some((line) => !line.identity) || own.some((override) => !override.identity);
}

async function applyToTable(run: MemoryRun, basis: TableBasis, address: TableAddress, room: number): Promise<TableResult> {
  const scope = labelMemoryScopeOf(run.batch);
  if (scope === null) return { kind: 'skipped' };
  const identities = tableLineIdentities(basis.table, basis.answer.variantsIn, run.schema.registry);
  const book = await readLabelMemoryBook(run.ctx, memoryKeysOf(scope, identities.values()));
  const all = run.batch.pages?.lineOverrides ?? [];
  const application = { scope, book, knownAttributeIds: new Set(run.schema.attributes.keys()), pricesEnabled: run.canPrice, stamp: { by: run.ctx.uid, at: nowISO() } };
  const found = memoryOverridesFor({ ...address, identities }, all, application);
  const own = tableOverridesOf(all, address.page, address.table);
  if (found.length === 0 && !lacksIdentity(run, address, own)) return { kind: 'skipped' };
  if (found.length > room) return { kind: 'full' };
  const judged = await rebuild(run, basis, withMemoryApplied(own, found, identities), (current) => withMemoryApplied(current, found, identities));
  return judged.ok ? { kind: 'done', lines: found.length } : refusedAt(address, judged);
}

/**
 * Οι αποφάσεις μνήμης που φεύγουν από έναν πίνακα. Οι αποφάσεις τιμής φεύγουν μόνο όταν η πρόταση τιμών του πίνακα εκκρεμεί **και** ο
 * άνθρωπος τιμολογεί: εγκεκριμένη τιμή δεν ξεγράφεται από εδώ (ίδιο δόγμα με το `judgeOpenProposal`).
 */
function removableMemory(run: MemoryRun, address: TableAddress, own: readonly ImportLineOverride[]): ImportLineOverride[] {
  const pricesOpen = run.canPrice && pendingProposal(run, priceGroupKeyOf(pageTableGroupKey(address.page, address.table)));
  return own.filter((override) => isMemoryOverride(override) && (override.decision.kind !== 'price' || pricesOpen));
}

async function undoInTable(run: MemoryRun, basis: TableBasis, address: TableAddress): Promise<TableResult> {
  const own = tableOverridesOf(run.batch.pages?.lineOverrides, address.page, address.table);
  const removable = removableMemory(run, address, own);
  if (removable.length === 0) return { kind: 'skipped' };
  const gone = new Set(removable.map(({ line }) => line));
  const keep = (current: readonly ImportLineOverride[]) => current.filter((override) => !gone.has(override.line) || !isMemoryOverride(override));
  const judged = await rebuild(run, basis, keep(own), keep);
  return judged.ok ? { kind: 'done', lines: removable.length } : refusedAt(address, judged);
}

/**
 * Πίνακες που ίσως χρειάζονται δουλειά, πριν ανοίξει PDF. Η εφαρμογή κοιτά **κάθε** ανοιχτό πίνακα: η μνήμη ισχύει και σε γραμμές που
 * το μοντέλο αντιστοίχισε (κερδίζει, με σήμανση — Απόφαση 3), και η ταυτότητά τους βγαίνει μόνο από το PDF. Η αναίρεση μόνο όπου υπάρχει.
 */
function candidateTables(run: MemoryRun, action: ImportMemoryActionRequest['action']): TableAddress[] {
  const tables = openTables(run);
  if (action === 'apply') return tables;
  return tables.filter((address) => tableOverridesOf(run.batch.pages?.lineOverrides, address.page, address.table).some(isMemoryOverride));
}

async function runAction(run: MemoryRun, action: ImportMemoryActionRequest['action']): Promise<ImportMemoryActionOutcome> {
  const pages = new Map<number, ReturnType<typeof pageBasis>>();
  let room = IMPORT_MAX_LINE_OVERRIDES - (run.batch.pages?.lineOverrides?.length ?? 0);
  let lines = 0;
  let tables = 0;
  const refused: ImportMemoryTableRefusal[] = [];
  for (const address of candidateTables(run, action)) {
    const basis = await tableBasisOf(run, pages, address);
    const result = !basis.ok ? refusedAt(address, basis) : action === 'apply' ? await applyToTable(run, basis.value, address, room) : await undoInTable(run, basis.value, address);
    if (result.kind === 'full') return { lines, tables, refused, limitReached: true, values: 0 };
    if (result.kind === 'refused') refused.push(result.refusal);
    if (result.kind !== 'done') continue;
    lines += result.lines;
    tables += 1;
    room -= action === 'apply' ? result.lines : -result.lines;
  }
  return { lines, tables, refused, limitReached: false, values: 0 };
}

/** `POST /api/catalog/imports/[id]/memory` — ρητή εφαρμογή (`apply`) ή αναίρεση όλων (`undo`) της μνήμης, χωρίς AI. */
export async function runImportMemoryAction(ctx: AuthContext, id: string, request: ImportMemoryActionRequest): Promise<ImportMemoryActionResult> {
  const run = await openRun(ctx, id);
  const lineOutcome = await runAction(run, request.action);
  // §5.5.2 Β10: μετά τις γραμμές (που ξαναχτίζουν προτάσεις), η μνήμη τιμών — με τις **φρέσκες** αναθεωρήσεις των προτάσεων.
  const values = await runValueMemoryAction(ctx, run.batch, await readBatchProposals(ctx, id), request.action);
  return { view: await readImportBatchDetail(ctx, id), outcome: { ...lineOutcome, values } };
}
