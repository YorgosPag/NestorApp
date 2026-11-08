import 'server-only';

/**
 * Η **απόφαση γραμμής και η ξαναερμηνεία ενός πίνακα χωρίς AI** (ADR-923 §5.5.2 Β3 Γ3–Γ5).
 *
 * Ο άνθρωπος λέει «αυτή η γραμμή είναι εκείνη η ιδιότητα». Η σελίδα δεν ξαναδιαβάζεται: η ανασύνθεση του πίνακα από το PDF είναι
 * ντετερμινιστική, η απάντηση αντιστοίχισης του μοντέλου είναι φυλαγμένη (Ε6), και η ανθρώπινη απόφαση μπαίνει **από πάνω**. Ίδιος
 * αγωγός (`readPageTables` → `proposeGroup`), ίδιος κριτής, κόστος $0.
 *
 * 🔑 **Δομικά χωρίς πληρωμή:** αυτό το αρχείο δεν εισάγει τον αναλυτή. Όπου λείπει κάτι, αρνείται με λόγο (`ImportLineRefusal`) και
 *    **δεν γράφει τίποτα**· ο άνθρωπος αποφασίζει για νέα ανάγνωση.
 * 🔑 **Εμβέλεια πίνακα:** ξαναερμηνεύεται μόνο ο πίνακας της γραμμής. Άλλος πίνακας της ίδιας σελίδας έχει δική του πρόταση και δική
 *    του σειρά στην ουρά του πελάτη, άρα δύο αποφάσεις σε διαφορετικούς πίνακες δεν πατούν η μία την άλλη.
 * 🔑 Οι αποφάσεις πεδίων του ανθρώπου επιβιώνουν (`carriedDecision`)· πρόταση που εγκρίθηκε ή απορρίφθηκε δεν αγγίζεται.
 * @module server/catalog/import-page-reinterpret.server
 */

import type { AuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { createModuleLogger } from '@/lib/telemetry';
import { reconstructPageTables } from '@/lib/pdf-tables/reconstruct-page-tables';
import type { PageTable } from '@/lib/pdf-tables/page-table-types';
import { applyLineOverrides, lineDecisionOf, tableOverridesOf, withLineOverride } from '@/subapps/catalog/import/page-line-overrides';
import { isRawPageMapping, type RawTableMapping } from '@/subapps/catalog/import/page-table-mapping';
import { readPageTables } from '@/subapps/catalog/import/page-table-reading';
import { familyDefinitionOf, withAttributeAtLevel } from '@/subapps/catalog/schema/family-binding';
import type { ImportBatchDefinition, ImportLineDecision } from '@/subapps/catalog/types/catalog-import';
import type { ImportLineOutcome, SetImportLineRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import type { ImportLineBindLevel, ImportLineRefusal } from '@/subapps/catalog/vocabulary/catalog-import';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogReadOnly } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { updateCatalogFamily } from './family-writer.server';
import { assertPurposeAuthority, replaceTableLeftOut, setImportLineOverride, type StoredImportBatch } from './import-batch-writer.server';
import { readPageReadings, type StoredPageReading } from './import-page-reading.server';
import { axisAttributeIdsOf, loadPdfPageSource, pageSpecs } from './import-page-source.server';
import { proposeGroup, retireStalePageProposals } from './import-proposal-writer.server';
import { readBatchProposals, readImportBatchDetail } from './import-reads.server';

const logger = createModuleLogger('CatalogImportReinterpret');

type Judged<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: ImportLineRefusal };

const refuse = (reason: ImportLineRefusal): { readonly ok: false; readonly reason: ImportLineRefusal } => ({ ok: false, reason });

const groupKeyOf = (page: number, table: string): string => `page:${page}:${table}`;

/** Αποτυχημένη απάντηση δεν έγινε ποτέ πρόταση: οι προτάσεις της σελίδας ήρθαν από την αμέσως προηγούμενη επιτυχή. */
function standingReading(readings: readonly StoredPageReading[]): Judged<StoredPageReading> {
  const latest = readings.find((reading) => reading.outcome === 'read');
  if (!latest) return refuse('readingMissing');
  if (latest.route !== 'table' || latest.abandoned) return refuse('readingVision');
  if (latest.rawTextClipped) return refuse('readingClipped');
  return { ok: true, value: latest };
}

function tableAnswer(reading: StoredPageReading, table: string): Judged<RawTableMapping> {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(reading.rawText ?? 'null');
  } catch {
    return refuse('readingMissing');
  }
  if (!isRawPageMapping(parsed)) return refuse('readingMissing');
  const answer = parsed.tables.find((entry) => entry.table === table);
  return answer ? { ok: true, value: answer } : refuse('lineUnknown');
}

/** Ίδιοι πίνακες με εκείνους που είδε το μοντέλο: κλειδί, πηγή, μάρτυρας, διαστάσεις. Αλλιώς οι αριθμοί γραμμών δεν σημαίνουν το ίδιο. */
function sameTables(seen: StoredPageReading['tables'], rebuilt: readonly PageTable[]): boolean {
  if (seen.length !== rebuilt.length) return false;
  return seen.every((entry) => rebuilt.some((table) => table.key === entry.key && table.source === entry.source && table.witness === entry.witness
    && table.rowCount === entry.rows && table.colCount === entry.columns));
}

interface TableBasis {
  readonly answer: RawTableMapping;
  readonly table: PageTable;
}

async function tableBasis(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest): Promise<Judged<TableBasis>> {
  const reading = standingReading(await readPageReadings(ctx, batch.id, request.page));
  if (!reading.ok) return reading;
  const answer = tableAnswer(reading.value, request.table);
  if (!answer.ok) return answer;
  const source = await loadPdfPageSource(ctx, batch, request.page);
  if (source.textLayer.state === 'lost' || source.tokens.length === 0) return refuse('tablesDrifted');
  const tables = reconstructPageTables({ words: source.tokens, rules: source.rules, tagTables: source.tagTables });
  if (!sameTables(reading.value.tables, tables)) return refuse('tablesDrifted');
  const table = tables.find((candidate) => candidate.key === request.table);
  if (!table) return refuse('tablesDrifted');
  const lines = answer.value.variantsIn === 'columns' ? table.rowCount : table.colCount;
  return request.line < lines ? { ok: true, value: { answer: answer.value, table } } : refuse('lineUnknown');
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

interface Reinterpretation {
  readonly batch: StoredImportBatch;
  readonly request: SetImportLineRequest;
  readonly basis: TableBasis;
}

/**
 * Ο πίνακας με τις αποφάσεις από πάνω ⇒ ίδιος αγωγός ⇒ πρόταση + όσα έμειναν απέξω, μόνο για αυτόν τον πίνακα. Η απόφαση κρίνεται
 * **στη μνήμη** πριν γραφτεί: άρνηση εδώ δεν αφήνει πίσω της μισή κατάσταση.
 */
async function reinterpretTable(ctx: AuthContext, { batch, request, basis }: Reinterpretation): Promise<Judged<null>> {
  if (batch.target.purpose !== 'attributes') return refuse('lineUnknown');
  const { familyId, variantSchemeCode } = batch.target;
  const schema = await runCatalogReadOnly(ctx, (scope) => readSchemaSnapshot(scope, familyId, variantSchemeCode));
  const specs = pageSpecs(schema);
  const stamp = { by: ctx.uid, at: nowISO() };
  const overrides = withLineOverride(tableOverridesOf(batch.pages?.lineOverrides, request.page, request.table), request, request.decision, stamp);
  const overridden = applyLineOverrides(basis.answer, overrides, specs.codeById, new Set(specs.byCode.keys()));
  if (overridden.unknownAttributeIds.length > 0) return refuse('lineUnknown');
  if (overridden.staleCodes.length > 0) logger.warn('Stored mapping names attributes no longer in the family', { batchId: batch.id, page: request.page, codes: overridden.staleCodes });
  await setImportLineOverride(ctx, batch.id, request, request.decision);
  const context = { page: request.page, tables: [basis.table], attributesByCode: specs.byCode, registry: schema.registry, axisAttributeIds: axisAttributeIdsOf(schema) };
  const reading = readPageTables({ tables: [overridden.mapping] }, context);
  const proposals = await Promise.all(reading.groups.map((group) => proposeGroup(ctx, batch.id, group)));
  const others = (await readBatchProposals(ctx, batch.id)).filter((proposal) => proposal.groupKey !== groupKeyOf(request.page, request.table));
  await retireStalePageProposals(ctx, batch.id, request.page, new Set([...others, ...proposals].map((proposal) => proposal.id)));
  await replaceTableLeftOut(ctx, batch.id, request.page, request.table, { setAside: reading.setAside, unmappedLines: reading.unmappedLines });
  return { ok: true, value: null };
}

async function openBatch(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<Judged<StoredImportBatch>> {
  const batch = await runCatalogReadOnly(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  if (batch.target.purpose !== 'attributes' || !batch.pages?.done.includes(request.page)) return refuse('lineUnknown');
  const proposal = (await readBatchProposals(ctx, id)).find((candidate) => candidate.groupKey === groupKeyOf(request.page, request.table));
  return proposal && proposal.status !== 'pending' ? refuse('proposalClosed') : { ok: true, value: batch };
}

/** Χρειάζεται ο πίνακας μόνο όταν αλλάζει η αντιστοίχιση: η αγνόηση (και η αναίρεσή της) είναι απλώς κατάσταση. */
const touchesMapping = (decision: ImportLineDecision | null, previous: ImportLineDecision | null): boolean =>
  decision?.kind === 'attribute' || previous?.kind === 'attribute';

async function decideLine(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<ImportLineOutcome> {
  const opened = await openBatch(ctx, id, request);
  if (!opened.ok) return { kind: 'refused', reason: opened.reason };
  const previous = lineDecisionOf(opened.value.pages?.lineOverrides, request);
  if (!touchesMapping(request.decision, previous)) {
    await setImportLineOverride(ctx, id, request, request.decision);
    return { kind: 'settled' };
  }
  const basis = await tableBasis(ctx, opened.value, request);
  if (!basis.ok) return { kind: 'refused', reason: basis.reason };
  if (request.decision?.kind === 'attribute' && request.bind !== null) await bindToFamily(ctx, opened.value, request.decision.attributeId, request.bind);
  const outcome = await reinterpretTable(ctx, { batch: opened.value, request, basis: basis.value });
  return outcome.ok ? { kind: 'settled' } : { kind: 'refused', reason: outcome.reason };
}

/** `POST /api/catalog/imports/[id]/lines` — απόφαση γραμμής + ξαναερμηνεία του πίνακά της, χωρίς AI. */
export async function setImportLine(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<SetImportLineResult> {
  const outcome = await decideLine(ctx, id, request);
  return { view: await readImportBatchDetail(ctx, id), outcome };
}
