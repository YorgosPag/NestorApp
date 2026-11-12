import 'server-only';

/**
 * **Ξαναχτίσιμο πίνακα σελίδας χωρίς AI** (ADR-923 §5.5.2 Β3 Γ3–Γ5 · Β3.1) — ο ένας πυρήνας που μοιράζονται η απόφαση γραμμής και η
 * αναβάθμιση έκδοσης παραγωγής.
 *
 * Η ανασύνθεση των πινάκων από το PDF είναι ντετερμινιστική, η απάντηση αντιστοίχισης του μοντέλου είναι φυλαγμένη (Ε6), και οι
 * αποφάσεις του ανθρώπου μπαίνουν **από πάνω**. Ίδιος αγωγός με την ανάγνωση (`readPageTables` → `proposeGroup`), κόστος $0.
 *
 * 🔑 **Δομικά χωρίς πληρωμή:** αυτό το αρχείο δεν εισάγει τον αναλυτή. Όπου λείπει κάτι, αρνείται με λόγο (`ImportLineRefusal`).
 * 🔑 **Δύο φάσεις:** `prepareTable` κρίνει στη μνήμη (καμία εγγραφή), `commitTable` γράφει. Ο καλών βάζει ανάμεσα ό,τι πρέπει να
 *    γραφτεί μόνο αν η κρίση πέρασε (η απόφαση γραμμής), ώστε η άρνηση να μην αφήνει πίσω της μισή κατάσταση.
 * 🔑 Πρόταση που εγκρίθηκε ή απορρίφθηκε δεν αγγίζεται (`stageGroup`)· οι αποφάσεις πεδίων επιβιώνουν (`carriedDecision`).
 * @module server/catalog/import-table-rebuild.server
 */

import type { AuthContext } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { reconstructPageTables } from '@/lib/pdf-tables/reconstruct-page-tables';
import type { PageTable } from '@/lib/pdf-tables/page-table-types';
import { pageTableGroupKey, priceGroupKeyOf } from '@/subapps/catalog/import/import-keys';
import { readPageWithDecisions } from '@/subapps/catalog/import/page-decisions-reading';
import { isRawPageMapping, type RawPageMapping, type RawTableMapping } from '@/subapps/catalog/import/page-table-mapping';
import type { PageTableReading } from '@/subapps/catalog/import/page-table-reading';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ImportLineOverride } from '@/subapps/catalog/types/catalog-import';
import type { ImportLineRefusal } from '@/subapps/catalog/vocabulary/catalog-import';
import { readSchemaSnapshot, type StoredFamilyRecord } from './catalog-product-reads.server';
import { runCatalogReadOnly } from './catalog-store.server';
import { replaceTableLeftOut, type StoredImportBatch } from './import-batch-writer.server';
import { readPageReadings, type StoredPageReading } from './import-page-reading.server';
import { axisAttributeIdsOf, loadPdfPageSource, pageSpecs } from './import-page-source.server';
import { proposeGroup, retireStalePageProposals, type StoredImportProposal } from './import-proposal-writer.server';
import { readBatchProposals } from './import-reads.server';

const logger = createModuleLogger('CatalogImportTableRebuild');

export type Judged<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: ImportLineRefusal };

export const refuse = (reason: ImportLineRefusal): { readonly ok: false; readonly reason: ImportLineRefusal } => ({ ok: false, reason });

export const groupKeyOf = pageTableGroupKey;

/** Αποτυχημένη απάντηση δεν έγινε ποτέ πρόταση: οι προτάσεις της σελίδας ήρθαν από την αμέσως προηγούμενη επιτυχή. */
function standingReading(readings: readonly StoredPageReading[]): Judged<StoredPageReading> {
  const latest = readings.find((reading) => reading.outcome === 'read');
  if (!latest) return refuse('readingMissing');
  if (latest.route !== 'table' || latest.abandoned) return refuse('readingVision');
  if (latest.rawTextClipped) return refuse('readingClipped');
  return { ok: true, value: latest };
}

function pageAnswer(reading: StoredPageReading): Judged<RawPageMapping> {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(reading.rawText ?? 'null');
  } catch {
    return refuse('readingMissing');
  }
  return isRawPageMapping(parsed) ? { ok: true, value: parsed } : refuse('readingMissing');
}

/** Ίδιοι πίνακες με εκείνους που είδε το μοντέλο: κλειδί, πηγή, μάρτυρας, διαστάσεις. Αλλιώς οι αριθμοί γραμμών δεν σημαίνουν το ίδιο. */
function sameTables(seen: StoredPageReading['tables'], rebuilt: readonly PageTable[]): boolean {
  if (seen.length !== rebuilt.length) return false;
  return seen.every((entry) => rebuilt.some((table) => table.key === entry.key && table.source === entry.source && table.witness === entry.witness
    && table.rowCount === entry.rows && table.colCount === entry.columns));
}

/** Η σελίδα όπως την είδε το μοντέλο: η φυλαγμένη απάντηση + οι πίνακες ξανά από το PDF, επαληθευμένα ίδιοι. */
interface PageBasis {
  readonly page: number;
  readonly answer: RawPageMapping;
  readonly tables: readonly PageTable[];
}

export async function pageBasis(ctx: AuthContext, batch: StoredImportBatch, page: number): Promise<Judged<PageBasis>> {
  const reading = standingReading(await readPageReadings(ctx, batch.id, page));
  if (!reading.ok) return reading;
  const answer = pageAnswer(reading.value);
  if (!answer.ok) return answer;
  const source = await loadPdfPageSource(ctx, batch, page);
  if (source.textLayer.state === 'lost' || source.tokens.length === 0) return refuse('tablesDrifted');
  const tables = reconstructPageTables({ words: source.tokens, rules: source.rules, tagTables: source.tagTables });
  return sameTables(reading.value.tables, tables) ? { ok: true, value: { page, answer: answer.value, tables } } : refuse('tablesDrifted');
}

/** Ένας πίνακας της σελίδας: η απάντηση του μοντέλου γι' αυτόν + η ανασύνθεσή του. */
export interface TableBasis {
  readonly page: number;
  readonly answer: RawTableMapping;
  readonly table: PageTable;
}

export function tableOf(basis: PageBasis, key: string): Judged<TableBasis> {
  const answer = basis.answer.tables.find((entry) => entry.table === key);
  if (!answer) return refuse('lineUnknown');
  const table = basis.tables.find((candidate) => candidate.key === key);
  return table ? { ok: true, value: { page: basis.page, answer, table } } : refuse('tablesDrifted');
}

/** Το σχήμα της παρτίδας **μαζί με την αναθεώρηση της οικογένειας** (σφραγίδα Γ12)· `null` = παρτίδα χωρίς οικογένεια. */
export function readBatchSchema(ctx: AuthContext, batch: StoredImportBatch): Promise<BatchSchema | null> {
  if (batch.target.purpose !== 'attributes') return Promise.resolve(null);
  const { familyId, variantSchemeCode } = batch.target;
  return runCatalogReadOnly(ctx, (scope) => readSchemaSnapshot(scope, familyId, variantSchemeCode));
}

/** Το σχήμα που κρίνει τους πίνακες, και η εγγραφή της οικογένειας από την οποία βγήκε (η αναθεώρησή της σφραγίζει τη σελίδα). */
export type BatchSchema = CatalogSchemaSnapshot & { readonly familyRecord: StoredFamilyRecord };

/** Πίνακας κριμένος στη μνήμη, έτοιμος να γραφτεί. */
export interface PreparedTable {
  readonly basis: TableBasis;
  readonly reading: PageTableReading;
}

/**
 * Οι αποφάσεις από πάνω ⇒ ίδιος αγωγός ⇒ πρόταση + «απέξω», **χωρίς εγγραφή**. Ιδιότητα που δεν υπάρχει ⇒ άρνηση. Ίδια συνάρτηση με
 * την πληρωμένη ανάγνωση (`readPageWithDecisions`, §5.5.2 Β5 Μ5). Η μνήμη **δεν** ρωτιέται εδώ (Απόφαση 4): μετρά ό,τι είναι ήδη φυλαγμένο.
 */
export function prepareTable(schema: CatalogSchemaSnapshot, basis: TableBasis, overrides: readonly ImportLineOverride[]): Judged<PreparedTable> {
  const specs = pageSpecs(schema);
  const context = { page: basis.page, tables: [basis.table], attributesByCode: specs.byCode, registry: schema.registry, axisAttributeIds: axisAttributeIdsOf(schema) };
  const decided = readPageWithDecisions({ tables: [basis.answer] }, context, overrides, { codeById: specs.codeById, knownCodes: new Set(specs.byCode.keys()) });
  if (decided.unknownAttributeIds.length > 0) return refuse('lineUnknown');
  if (decided.staleCodes.length > 0) logger.warn('Stored mapping names attributes no longer in the family', { page: basis.page, table: basis.table.key, codes: decided.staleCodes });
  return { ok: true, value: { basis, reading: decided.reading } };
}

/** Οι προτάσεις του πίνακα: ιδιότητες **πριν** από τιμές, γιατί η πρόταση τιμών παίρνει την ταυτότητα από εκείνη (§5.5.2 Β4 Δ4). */
const attributesFirst = (reading: PageTableReading) =>
  [...reading.groups].sort((a, b) => Number(a.purpose === 'priceLines') - Number(b.purpose === 'priceLines'));

/** Γράφει ό,τι κρίθηκε: προτάσεις του πίνακα, απόσυρση όσων δεν ξαναβρέθηκαν, «απέξω» μόνο αυτού του πίνακα. */
export async function commitTable(ctx: AuthContext, batchId: string, { basis, reading }: PreparedTable): Promise<void> {
  const { page, table } = basis;
  const proposals: StoredImportProposal[] = [];
  for (const group of attributesFirst(reading)) proposals.push(await proposeGroup(ctx, batchId, group));
  const ownKeys = new Set([groupKeyOf(page, table.key), priceGroupKeyOf(groupKeyOf(page, table.key))]);
  const others = (await readBatchProposals(ctx, batchId)).filter((proposal) => !ownKeys.has(proposal.groupKey));
  await retireStalePageProposals(ctx, batchId, page, new Set([...others, ...proposals].map((proposal) => proposal.id)));
  await replaceTableLeftOut(ctx, batchId, page, table.key, { setAside: reading.setAside, unmappedLines: reading.unmappedLines });
}
