import 'server-only';

/**
 * Η **απόφαση γραμμής και η ξαναερμηνεία ενός πίνακα χωρίς AI** (ADR-923 §5.5.2 Β3 Γ3–Γ5).
 *
 * Ο άνθρωπος λέει «αυτή η γραμμή είναι εκείνη η ιδιότητα». Η σελίδα δεν ξαναδιαβάζεται: ο πίνακας ξαναχτίζεται από τον κοινό πυρήνα
 * (`import-table-rebuild.server`) με την ανθρώπινη απόφαση **από πάνω**. Ίδιος αγωγός, ίδιος κριτής, κόστος $0.
 *
 * 🔑 **Δομικά χωρίς πληρωμή:** ούτε αυτό το αρχείο ούτε ο πυρήνας εισάγουν τον αναλυτή. Όπου λείπει κάτι, αρνείται με λόγο
 *    (`ImportLineRefusal`) και **δεν γράφει τίποτα**· ο άνθρωπος αποφασίζει για νέα ανάγνωση.
 * 🔑 **Εμβέλεια πίνακα:** ξαναερμηνεύεται μόνο ο πίνακας της γραμμής. Άλλος πίνακας της ίδιας σελίδας έχει δική του πρόταση και δική
 *    του σειρά στην ουρά του πελάτη, άρα δύο αποφάσεις σε διαφορετικούς πίνακες δεν πατούν η μία την άλλη.
 * 🔑 Οι αποφάσεις πεδίων του ανθρώπου επιβιώνουν (`carriedDecision`)· πρόταση που εγκρίθηκε ή απορρίφθηκε δεν αγγίζεται.
 * 🔑 §5.5.2 Β3 Γ11: `create` ⇒ η ιδιότητα γεννιέται **μέσα** στην οικογένεια (μία συναλλαγή) και η γραμμή αντιστοιχίζεται σε αυτήν.
 * 🔑 §5.5.2 Β3 Γ13: μία γραμμή → περισσότερες ιδιότητες (`alsoAttributeIds`)· το `bind` δένει την ιδιότητα που **φέρνει** η απόφαση.
 * 🔑 §5.5.2 Β9δ: `fallback: 'memory'` (μόνο με `decision: null`, από την αναίρεση) ⇒ η γραμμή επιστρέφει στην κρίση της μνήμης του
 *    προμηθευτή, ρωτημένης **ξανά** εδώ (`resolveLine`) — ο client δεν δηλώνει ποτέ προέλευση.
 * @module server/catalog/import-page-reinterpret.server
 */

import type { AuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { priceGroupKeyOf } from '@/subapps/catalog/import/import-keys';
import {
  lineDecisionOf,
  priceLineOf,
  stepAttributeIdOf,
  tableOverridesOf,
  withLineOverride,
  type LineOverrideExtras,
} from '@/subapps/catalog/import/page-line-overrides';
import { tableLineIdentities } from '@/subapps/catalog/import/page-table-reading';
import { familyDefinitionOf, withAttributeAtLevel } from '@/subapps/catalog/schema/family-binding';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ImportBatchDefinition, ImportLineDecision, ImportMemoryOrigin } from '@/subapps/catalog/types/catalog-import';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { ImportLineOutcome, SetImportLineRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import type { ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogReadOnly } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { createAttributeInFamily, updateCatalogFamily } from './family-writer.server';
import { assertPurposeAuthority, setImportLineOverride, type StoredImportBatch } from './import-batch-writer.server';
import { memoryOverrideForLine, wantsMemoryFallback } from './import-line-memory.server';
import { readBatchProposals, readImportBatchDetail } from './import-reads.server';
import {
  commitTable,
  groupKeyOf,
  pageBasis,
  prepareTable,
  readBatchSchema,
  refuse,
  tableOf,
  type Judged,
  type TableBasis,
} from './import-table-rebuild.server';

/** Ο πίνακας της γραμμής, και η γραμμή μέσα στα όριά του (ο προσανατολισμός λέει αν οι γραμμές είναι σειρές ή στήλες). */
async function lineBasis(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest): Promise<Judged<TableBasis>> {
  const page = await pageBasis(ctx, batch, request.page);
  if (!page.ok) return page;
  const basis = tableOf(page.value, request.table);
  if (!basis.ok) return basis;
  const { answer, table } = basis.value;
  const lines = answer.variantsIn === 'columns' ? table.rowCount : table.colCount;
  return request.line < lines ? basis : refuse('lineUnknown');
}

/** Νέα ιδιότητα από τη γραμμή: δέσιμο στην οικογένεια της παρτίδας μέσω της μηχανής σχήματος (CHECK 3.106). Αλλαγή δομής ⇒ `schema`. */
async function bindToFamily(ctx: AuthContext, batch: StoredImportBatch, attributeId: string, level: ImportLineBindLevel): Promise<void> {
  if (batch.target.purpose !== 'attributes') return;
  // Ίδιο δόγμα με το `assertPurposeAuthority`: όποιος δεν αλλάζει δομή δεν μαθαίνει ότι η πόρτα υπάρχει.
  if (!(await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.schema))) throw new CatalogWriteError('notFound');
  const { familyId, variantSchemeCode } = batch.target;
  const { familyRecord } = await runCatalogReadOnly(ctx, (scope) => readSchemaSnapshot(scope, familyId, variantSchemeCode));
  const current = familyDefinitionOf(familyRecord);
  const next = withAttributeAtLevel(current, attributeId, level, variantSchemeCode);
  if (canonicalJson(next) === canonicalJson(current)) return;
  await updateCatalogFamily(ctx, familyId, familyRecord.revision, next);
}

/**
 * §5.5.2 Β3 Γ11: «Ναι, πρόσθεσέ την» — ιδιότητα **και** δέσιμο (επίπεδο + κανάλια) σε **μία** συναλλαγή της μηχανής σχήματος· μετά η
 * γραμμή αντιστοιχίζεται στη νέα ιδιότητα από τον ίδιο δρόμο με κάθε αντιστοίχιση. Ίδιο δικαίωμα και ίδια σιωπή με το `bindToFamily`.
 */
async function createLineAttribute(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest): Promise<SetImportLineRequest> {
  const { create, bind } = request;
  if (create === undefined || bind === null || batch.target.purpose !== 'attributes') throw new CatalogWriteError('notFound');
  if (!(await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.schema))) throw new CatalogWriteError('notFound');
  const { familyId, variantSchemeCode } = batch.target;
  const place = (family: CatalogFamilyDefinition, id: string) => withAttributeAtLevel(family, id, bind, variantSchemeCode, create.requiredChannels);
  const attributeId = await createAttributeInFamily(ctx, { definition: create.definition, familyId, place });
  return { page: request.page, table: request.table, line: request.line, decision: { kind: 'attribute', attributeId }, bind: null };
}

/** §5.5.2 Β7: η απόφαση `axis` δείχνει **μόνο** άξονα του σχήματος της παρτίδας· οι άλλες αποφάσεις δεν ελέγχονται εδώ. */
function axisDecisionFits(decision: ImportLineDecision | null, schema: CatalogSchemaSnapshot): boolean {
  if (decision?.kind !== 'axis') return true;
  return (schema.scheme?.levels ?? []).some((level) => level.axisAttributeIds.includes(decision.attributeId));
}

/**
 * Ο πίνακας με τις αποφάσεις από πάνω, **μαζί με τη νέα**. Η απόφαση κρίνεται στη μνήμη πριν γραφτεί: άρνηση εδώ δεν αφήνει πίσω της
 * μισή κατάσταση. Μετά γράφεται η απόφαση και ό,τι παράγει.
 */
async function reinterpretTable(ctx: AuthContext, batch: StoredImportBatch, resolved: ResolvedLine, basis: TableBasis): Promise<Judged<null>> {
  const { request, origin } = resolved;
  const schema = await readBatchSchema(ctx, batch);
  if (schema === null || !axisDecisionFits(request.decision, schema)) return refuse('lineUnknown');
  const stamp = { by: ctx.uid, at: nowISO() };
  // §5.5.2 Β5: η ταυτότητα της γραμμής ταξιδεύει με την απόφαση, ώστε η έγκριση του πίνακα να τη μάθει για τον προμηθευτή.
  const identity = tableLineIdentities(basis.table, basis.answer.variantsIn, schema.registry).get(request.line);
  const extras: LineOverrideExtras = { ...(identity ? { identity } : {}), ...(origin ? { origin } : {}) };
  const overrides = withLineOverride(tableOverridesOf(batch.pages?.lineOverrides, request.page, request.table), request, request.decision, stamp, extras);
  const prepared = prepareTable(schema, basis, overrides);
  if (!prepared.ok) return prepared;
  await setImportLineOverride(ctx, batch.id, request, request.decision, extras);
  await commitTable(ctx, batch.id, prepared.value);
  return { ok: true, value: null };
}

async function openBatch(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<Judged<StoredImportBatch>> {
  const batch = await runCatalogReadOnly(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  return batch.target.purpose !== 'attributes' || !batch.pages?.done.includes(request.page) ? refuse('lineUnknown') : { ok: true, value: batch };
}

/**
 * Η πρόταση που αλλάζει η απόφαση έχει κριθεί; Για γραμμή τιμής είναι η πρόταση **τιμών** του πίνακα (§5.5.2 Β4): η τιμή ορίζεται και
 * αφού εγκριθούν οι ιδιότητες, γιατί η εγκεκριμένη πρόταση ιδιοτήτων δεν ξαναγράφεται (`stageGroup`).
 */
async function judgeOpenProposal(ctx: AuthContext, id: string, request: SetImportLineRequest, previous: ImportLineDecision | null): Promise<Judged<null>> {
  const tableKey = groupKeyOf(request.page, request.table);
  const priced = request.decision?.kind === 'price' || previous?.kind === 'price';
  const key = priced ? priceGroupKeyOf(tableKey) : tableKey;
  const proposal = (await readBatchProposals(ctx, id)).find((candidate) => candidate.groupKey === key);
  return proposal && proposal.status !== 'pending' ? refuse('proposalClosed') : { ok: true, value: null };
}

/**
 * Η ταυτότητα μιας γραμμής χωρίς πεδίο από ό,τι έγραψε η ανάγνωση (§5.5.2 Β5): η «Αγνόηση» δεν ανοίγει PDF. Παλαιότερη παρτίδα χωρίς
 * ταυτότητα ⇒ η απόφαση ισχύει, απλώς δεν μαθαίνεται.
 */
function storedIdentityOf(batch: StoredImportBatch, request: SetImportLineRequest): LineOverrideExtras {
  const line = batch.pages?.unmappedLines?.find((entry) => entry.page === request.page && entry.table === request.table && entry.line === request.line);
  return line?.identity ? { identity: line.identity } : {};
}

/** Χρειάζεται ο πίνακας μόνο όταν αλλάζει η αντιστοίχιση: η αγνόηση (και η αναίρεσή της) είναι απλώς κατάσταση. */
const MAPPING_KINDS: ReadonlySet<ImportLineDecision['kind']> = new Set(['attribute', 'axis', 'price']);
const touchesMapping = (decision: ImportLineDecision | null, previous: ImportLineDecision | null): boolean =>
  [decision, previous].some((entry) => entry !== null && MAPPING_KINDS.has(entry.kind));

/**
 * Η γραμμή τιμής (§5.5.2 Β4 Δ2): θέλει το δικαίωμα της τιμολόγησης (ξένο ≡ ανύπαρκτο, όπως το `assertPurposeAuthority`), πρόχειρη
 * έκδοση στην παρτίδα, και **μία** γραμμή τιμής ανά πίνακα. Και η αναίρεσή της αλλάζει την πρόταση τιμών, άρα θέλει το ίδιο δικαίωμα.
 */
async function judgePriceLine(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest, previous: ImportLineDecision | null): Promise<Judged<null>> {
  if (request.decision?.kind !== 'price' && previous?.kind !== 'price') return { ok: true, value: null };
  await assertPurposeAuthority(ctx, 'priceLines');
  if (request.decision?.kind !== 'price') return { ok: true, value: null };
  if (batch.target.purpose !== 'attributes' || !batch.target.priceListVersionId) return refuse('priceTargetMissing');
  const taken = priceLineOf(tableOverridesOf(batch.pages?.lineOverrides, request.page, request.table));
  return taken && taken.line !== request.line ? refuse('priceLineTaken') : { ok: true, value: null };
}

/** Η απόφαση που θα γραφτεί, με την προέλευσή της όταν τη δίνει η μνήμη (§5.5.2 Β9δ, `fallback: 'memory'`). */
interface ResolvedLine {
  readonly request: SetImportLineRequest;
  readonly origin?: ImportMemoryOrigin;
}

/**
 * Η επιστροφή στη μνήμη κρίνεται **εδώ**, πριν από κάθε άλλη κρίση: από εκεί και πέρα η απόφαση της μνήμης περνά από τους ίδιους
 * κριτές (κλειστή πρόταση · γραμμή τιμής · ξαναερμηνεία) με οποιαδήποτε άλλη. Καμία απάντηση της μνήμης ⇒ σκέτη αναίρεση.
 */
async function resolveLine(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest): Promise<ResolvedLine> {
  if (!wantsMemoryFallback(request)) return { request };
  const schema = await readBatchSchema(ctx, batch);
  const memory = schema === null ? null : await memoryOverrideForLine(ctx, batch, schema, request);
  return memory?.origin ? { request: { ...request, decision: memory.decision }, origin: memory.origin } : { request };
}

async function decideLine(ctx: AuthContext, id: string, asked: SetImportLineRequest): Promise<ImportLineOutcome> {
  const opened = await openBatch(ctx, id, asked);
  if (!opened.ok) return { kind: 'refused', reason: opened.reason };
  const resolved = await resolveLine(ctx, opened.value, asked);
  const { request } = resolved;
  const previous = lineDecisionOf(opened.value.pages?.lineOverrides, request);
  const open = await judgeOpenProposal(ctx, id, request, previous);
  if (!open.ok) return { kind: 'refused', reason: open.reason };
  const price = await judgePriceLine(ctx, opened.value, request, previous);
  if (!price.ok) return { kind: 'refused', reason: price.reason };
  if (request.create !== undefined) return createAndMap(ctx, opened.value, request);
  if (!touchesMapping(request.decision, previous)) {
    const origin = resolved.origin ? { origin: resolved.origin } : {};
    await setImportLineOverride(ctx, id, request, request.decision, { ...storedIdentityOf(opened.value, request), ...origin });
    return { kind: 'settled' };
  }
  const basis = await lineBasis(ctx, opened.value, request);
  if (!basis.ok) return { kind: 'refused', reason: basis.reason };
  // §5.5.2 Β3 Γ13: δένεται η ιδιότητα που **φέρνει** η απόφαση — με δεύτερο στόχο, αυτός· η κύρια είναι ήδη στην οικογένεια.
  const bindTarget = request.decision?.kind === 'attribute' ? stepAttributeIdOf(previous, request.decision) : null;
  if (bindTarget !== null && request.bind !== null) await bindToFamily(ctx, opened.value, bindTarget, request.bind);
  const outcome = await reinterpretTable(ctx, opened.value, resolved, basis.value);
  return outcome.ok ? { kind: 'settled' } : { kind: 'refused', reason: outcome.reason };
}

/** Ο πίνακας κρίνεται **πριν** γεννηθεί η ιδιότητα: άρνηση εδώ δεν αφήνει πίσω της ιδιότητα χωρίς γραμμή. */
async function createAndMap(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest): Promise<ImportLineOutcome> {
  const basis = await lineBasis(ctx, batch, request);
  if (!basis.ok) return { kind: 'refused', reason: basis.reason };
  const mapped = await createLineAttribute(ctx, batch, request);
  const outcome = await reinterpretTable(ctx, batch, { request: mapped }, basis.value);
  return outcome.ok ? { kind: 'settled' } : { kind: 'refused', reason: outcome.reason };
}

/** `POST /api/catalog/imports/[id]/lines` — απόφαση γραμμής + ξαναερμηνεία του πίνακά της, χωρίς AI. */
export async function setImportLine(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<SetImportLineResult> {
  const outcome = await decideLine(ctx, id, request);
  return { view: await readImportBatchDetail(ctx, id), outcome };
}
