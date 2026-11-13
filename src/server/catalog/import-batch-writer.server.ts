import 'server-only';

/**
 * Ο **γραφέας παρτίδας εισαγωγής** (ADR-923 §5.5.1): γέννηση (ιδεμπότητη δομικά) · σύνδεση αρχείου με **μετρημένο** sha256 ·
 * εγκατάλειψη.
 *
 * Ίδια είσοδος ⇒ ίδιο id: η δεύτερη `createImportBatch` επιστρέφει την υπάρχουσα παρτίδα, χωρίς ερώτημα και χωρίς race. Η
 * δημιουργία δεν είναι σφάλμα αν υπάρχει ήδη, γιατί ο άνθρωπος που ξαναρίχνει το ίδιο αρχείο θέλει τη δουλειά του πίσω.
 * Το `contentSha256` το δηλώνει ο πελάτης για να βρεθεί η παρτίδα **πριν** το ανέβασμα· στη σύνδεση μετριέται από τα bytes.
 * @module server/catalog/import-batch-writer.server
 */

import { createHash } from 'node:crypto';

import type { AuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { countPdfPages } from '@/services/pdf/pdf-rasterize.service';
import { importBatchKey } from '@/subapps/catalog/import/import-keys';
import { currentDerivation, derivationAfterTable } from '@/subapps/catalog/import/page-derivation';
import { pageDecisionsDigest, tableOverridesOf, withLineOverride, type LineOverrideExtras } from '@/subapps/catalog/import/page-line-overrides';
import type {
  ImportBatchDefinition,
  ImportBatchPages,
  ImportBatchTarget,
  ImportLineDecision,
  ImportLineOverride,
  ImportPageSetAside,
  ImportPageUnmappedLine,
  ImportProfileDefinition,
} from '@/subapps/catalog/types/catalog-import';
import type { CreateImportBatchRequest } from '@/subapps/catalog/types/catalog-import-requests';
import type { PriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import {
  IMPORT_FINISHED_BATCH_STATUSES,
  IMPORT_MAX_LINE_OVERRIDES,
  IMPORT_MAX_PAGES_PER_BATCH,
  IMPORT_MAX_RUNS,
  type ImportLineRefusal,
  type ImportPurpose,
} from '@/subapps/catalog/vocabulary/catalog-import';
import {
  assertRevision,
  readForUpsert,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import { downloadBatchFile, findStoredBatchFile, readBatchFileRecord } from './import-source.server';

export type StoredImportBatch = StoredCatalogRecord<ImportBatchDefinition>;

/**
 * Η ροή «μόνο τιμές» κουβαλά τιμές: πέρα από το δικαίωμα της διαδρομής (`products`) θέλει και της τιμολόγησης. Ξένο ≡
 * ανύπαρκτο: ποιος δεν βλέπει τιμές δεν μαθαίνει ότι υπάρχει παρτίδα τιμών.
 */
export async function assertPurposeAuthority(ctx: AuthContext, purpose: ImportPurpose): Promise<void> {
  if (purpose !== 'priceLines') return;
  if (!(await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing))) throw new CatalogWriteError('notFound');
}

/**
 * Παρτίδα που τελείωσε (`closed` · `discarded`) δεν δέχεται αποφάσεις: καμία έγκριση, απόρριψη ή διόρθωση πρότασής της. Ελέγχεται
 * **μέσα** στη συναλλαγή της απόφασης — η απόσυρση των εκκρεμών στην εγκατάλειψη είναι ο κύριος δρόμος, αυτό η δικλίδα (ADR-934 Ε3).
 */
export function assertImportBatchOpen(batch: Pick<ImportBatchDefinition, 'status'>): void {
  if (IMPORT_FINISHED_BATCH_STATUSES.includes(batch.status)) {
    throw new CatalogWriteError('immutable', [{ code: 'fieldImmutable', path: 'status', params: { field: 'status' } }]);
  }
}

/** Οι εισαγωγές γράφουν τιμές **μόνο** σε πρόχειρη έκδοση (§5.4): η δημοσιευμένη δεν αλλάζει. */
export async function assertDraftPriceVersion(scope: CatalogTx, versionId: string): Promise<void> {
  const version = await readOwned<PriceListVersionDefinition>(scope, 'priceListVersion', versionId);
  if (version.status !== 'draft') throw new CatalogWriteError('immutable', [{ code: 'versionNotDraft', path: 'target' }]);
}

async function assertTargetExists(scope: CatalogTx, target: ImportBatchTarget): Promise<void> {
  if (target.purpose === 'priceLines') return assertDraftPriceVersion(scope, target.priceListVersionId);
  await readOwned<object>(scope, 'family', target.familyId);
  if (target.priceListVersionId) await assertDraftPriceVersion(scope, target.priceListVersionId);
}

function pagesOf(request: CreateImportBatchRequest): ImportBatchPages | null {
  if (request.sourceKind !== 'pdf') return null;
  const range = request.pageRange ?? { from: 1, to: 1 };
  const count = range.to - range.from + 1;
  if (count < 1 || count > IMPORT_MAX_PAGES_PER_BATCH) {
    assertNoIssues([{ code: 'tooMany', path: 'pageRange', params: { max: IMPORT_MAX_PAGES_PER_BATCH } }]);
  }
  return { from: range.from, to: range.to, done: [], failed: [] };
}

function definitionOf(request: CreateImportBatchRequest, code: string, profileRevision: number | null): ImportBatchDefinition {
  const { sourceKind, contentSha256, fileName, sizeBytes, target, profileId, run } = request;
  return { code, sourceKind, contentSha256, fileName, sizeBytes, fileId: null, fileBatchId: null, target, profileId, profileRevision, run, status: 'awaitingFile', pages: pagesOf(request) };
}

async function profileRevisionOf(scope: CatalogTx, profileId: string | null): Promise<number | null> {
  if (profileId === null) return null;
  return (await readOwned<ImportProfileDefinition>(scope, 'importProfile', profileId)).revision;
}

const statusAfterFile = (batch: Pick<ImportBatchDefinition, 'sourceKind'>): ImportBatchDefinition['status'] => (batch.sourceKind === 'pdf' ? 'extracting' : 'mapping');

/** Η παρτίδα-κάτοχος του αρχείου: η ίδια, εκτός αν ξαναχρησιμοποιεί αντίγραφο άλλης. */
export const fileOwnerOf = (batch: StoredImportBatch): string => batch.fileBatchId ?? batch.id;

async function assertPageRange(batch: Pick<ImportBatchDefinition, 'sourceKind' | 'pages'>, bytes: Buffer): Promise<void> {
  const { pages } = batch;
  if (batch.sourceKind !== 'pdf' || !pages) return;
  const count = await countPdfPages(bytes);
  if (pages.to > count) assertNoIssues([{ code: 'tooMany', path: 'pageRange', params: { max: count } }]);
}

/** Ίδιο περιεχόμενο δεν ξανανεβαίνει: η νέα παρτίδα δείχνει το ζωντανό αρχείο, και ο πελάτης βλέπει ότι δεν περιμένει αρχείο (§5.5.1). */
async function reuseStoredFile(ctx: AuthContext, batch: StoredImportBatch): Promise<StoredImportBatch> {
  if (batch.status !== 'awaitingFile') return batch;
  const stored = await findStoredBatchFile(ctx, batch.contentSha256, batch.id);
  if (stored === null) return batch;
  await assertPageRange(batch, await downloadBatchFile(stored.record));
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batch.id);
    if (current.status !== 'awaitingFile') return current;
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), fileId: stored.fileId, fileBatchId: stored.ownerBatchId, status: statusAfterFile(current) });
  });
}

/**
 * `POST /api/catalog/imports` — ιδεμπότητη: ίδια είσοδος δίνει πίσω την ίδια παρτίδα όσο υπάρχει δουλειά της. Παρτίδα που
 * τελείωσε ή εγκαταλείφθηκε δεν ξανανοίγει, γιατί δεν έχει τι να δώσει πίσω: η ίδια είσοδος γίνεται η επόμενη εκτέλεση.
 */
export async function createImportBatch(ctx: AuthContext, request: CreateImportBatchRequest): Promise<StoredImportBatch> {
  await assertPurposeAuthority(ctx, request.target.purpose);
  // §5.5.2 Β4: παρτίδα ιδιοτήτων που δηλώνει τιμοκατάλογο κουβαλά και τιμές.
  if (request.target.purpose === 'attributes' && request.target.priceListVersionId) await assertPurposeAuthority(ctx, 'priceLines');
  return reuseStoredFile(ctx, await openImportBatch(ctx, request));
}

function openImportBatch(ctx: AuthContext, request: CreateImportBatchRequest): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const profileRevision = await profileRevisionOf(scope, request.profileId);
    for (let run = request.run; run < request.run + IMPORT_MAX_RUNS; run += 1) {
      const code = importBatchKey({ ...request, run, profileRevision });
      const { target, current } = await readForUpsert<ImportBatchDefinition>(scope, 'importBatch', code);
      if (current !== null && !IMPORT_FINISHED_BATCH_STATUSES.includes(current.status)) return current;
      if (current === null) {
        await assertTargetExists(scope, request.target);
        return stageCreate(scope, 'importBatch', target, definitionOf({ ...request, run }, code, profileRevision));
      }
    }
    throw new CatalogWriteError('invalid', [{ code: 'tooMany', path: 'run', params: { max: IMPORT_MAX_RUNS } }]);
  });
}

export function batchDefinitionOf(batch: StoredImportBatch): ImportBatchDefinition {
  const { code, sourceKind, contentSha256, fileName, sizeBytes, fileId, target, profileId, profileRevision, run, status, pages, xchangeReport } = batch;
  return { code, sourceKind, contentSha256, fileName, sizeBytes, fileId, fileBatchId: batch.fileBatchId ?? null, target, profileId, profileRevision, run, status, pages, ...(xchangeReport ? { xchangeReport } : {}) };
}

async function assertContent(batch: StoredImportBatch, bytes: Buffer): Promise<void> {
  if (createHash('sha256').update(bytes).digest('hex') !== batch.contentSha256) {
    throw new CatalogWriteError('invalid', [{ code: 'fileTypeConflict', path: 'contentSha256' }]);
  }
  await assertPageRange(batch, bytes);
}

/** `POST /api/catalog/imports/[id]/file` — μέτρηση έξω από τη συναλλαγή, κρίση μέσα. */
export async function attachImportBatchFile(ctx: AuthContext, id: string, expectedRevision: number, fileId: string): Promise<StoredImportBatch> {
  const preview = await runCatalogTransaction(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, preview.target.purpose);
  await assertContent(preview, await downloadBatchFile(await readBatchFileRecord(ctx, id, fileId)));
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    assertRevision(current, expectedRevision);
    return stageReplace(scope, 'importBatch', current, {
      ...batchDefinitionOf(current),
      fileId,
      status: statusAfterFile(current),
    });
  });
}

/** Η τελευταία ανάγνωση της σελίδας είναι η αλήθεια και για όσα έμειναν απέξω (πίνακες Ε3 · γραμμές Ε7). */
export const replacedOnPage = <TEntry extends { readonly page: number }>(current: readonly TEntry[], page: number, next: readonly TEntry[]): TEntry[] =>
  [...current.filter((entry) => entry.page !== page), ...next];

/** Η ξαναερμηνεία ενός πίνακα αντικαθιστά μόνο ό,τι ανήκει σε **εκείνον** τον πίνακα (§5.5.2 Β3 Γ3). */
const replacedOnTable = <TEntry extends { readonly page: number; readonly table: string }>(current: readonly TEntry[], page: number, table: string, next: readonly TEntry[]): TEntry[] =>
  [...current.filter((entry) => entry.page !== page || entry.table !== table), ...next];

type LineAddress = Pick<ImportLineOverride, 'page' | 'table' | 'line'>;

/** Η `pages` της παρτίδας, ή άρνηση: παρτίδα χωρίς σελίδες δεν έχει πίνακες. */
export function pagesOrRefuse(batch: ImportBatchDefinition): ImportBatchPages {
  if (!batch.pages) throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'pages' }]);
  return batch.pages;
}

/**
 * `POST /api/catalog/imports/[id]/lines` (πρώτο μισό) — η απόφαση γραμμής (§5.5.2 Β3 Γ1). Κατάσταση με κλειδί μέσα σε συναλλαγή, όχι
 * αντικατάσταση εγγράφου με CAS: δύο αποφάσεις σε διαφορετικές γραμμές δεν συγκρούονται, και η ίδια απόφαση δύο φορές δεν αλλάζει τίποτα.
 */
export function setImportLineOverride(
  ctx: AuthContext,
  id: string,
  address: LineAddress,
  decision: ImportLineDecision | null,
  extras: LineOverrideExtras = {},
): Promise<StoredImportBatch> {
  return storeLineOverrides(ctx, id, (all) => withLineOverride(all, address, decision, { by: ctx.uid, at: nowISO() }, extras));
}

/**
 * Ο γραφέας των αποφάσεων γραμμής **που δεν ξαναχτίζουν πίνακα** (η «Αγνόηση» και η αναίρεσή της): ανοιχτή παρτίδα, νέα λίστα από την
 * τρέχουσα **μέσα** στη συναλλαγή, όριο `IMPORT_MAX_LINE_OVERRIDES`. Οι αποφάσεις που αλλάζουν παράγωγα γράφονται **μαζί** με αυτά
 * (`pagesAfterTable`, §5.5.2 Β3.2).
 */
function storeLineOverrides(ctx: AuthContext, id: string, next: (all: readonly ImportLineOverride[]) => ImportLineOverride[]): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    assertImportBatchOpen(current);
    const pages = pagesOrRefuse(current);
    const lineOverrides = withinLineOverrideLimit(next(pages.lineOverrides ?? []));
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), pages: { ...pages, lineOverrides } });
  });
}

/** Το όριο `IMPORT_MAX_LINE_OVERRIDES` — ένα σημείο για κάθε γραφέα αποφάσεων. */
function withinLineOverrideLimit(lineOverrides: ImportLineOverride[]): ImportLineOverride[] {
  if (lineOverrides.length > IMPORT_MAX_LINE_OVERRIDES) assertNoIssues([{ code: 'tooMany', path: 'lineOverrides', params: { max: IMPORT_MAX_LINE_OVERRIDES } }]);
  return lineOverrides;
}

export interface TableLeftOut {
  readonly setAside: readonly ImportPageSetAside[];
  readonly unmappedLines: readonly ImportPageUnmappedLine[];
}

/** Ό,τι γράφει στην παρτίδα το ξαναχτίσιμο **ενός** πίνακα (§5.5.2 Β3.2). */
export interface TableBatchChange {
  readonly page: number;
  readonly table: string;
  /** Οι αποφάσεις του πίνακα, ξαναγραμμένες πάνω στις **τρέχουσες** της συναλλαγής· απούσα = οι αποφάσεις δεν αλλάζουν (αναβάθμιση σελίδας). */
  readonly rewrite?: (own: readonly ImportLineOverride[]) => ImportLineOverride[];
  readonly leftOut: TableLeftOut;
}

/**
 * Η `pages` μετά το ξαναχτίσιμο ενός πίνακα, **καθαρά**: αποφάσεις του πίνακα · ό,τι έμεινε απέξω · αποτύπωμα σφραγίδας (§5.5.2 Β3.2,
 * `derivationAfterTable`). Μία εγγραφή της παρτίδας στη συναλλαγή του πίνακα, αντί για δύο χωριστές (απόφαση · απέξω) που άφηναν μισή κατάσταση.
 */
export function pagesAfterTable(pages: ImportBatchPages, { page, table, rewrite, leftOut }: TableBatchChange): ImportBatchPages {
  const all = pages.lineOverrides ?? [];
  const lineOverrides = rewrite
    ? withinLineOverrideLimit([...all.filter((override) => override.page !== page || override.table !== table), ...rewrite(tableOverridesOf(all, page, table))])
    : all;
  const derivation = derivationAfterTable(pages, page, pageDecisionsDigest(lineOverrides, page));
  return {
    ...pages,
    ...(rewrite ? { lineOverrides } : {}),
    setAside: replacedOnTable(pages.setAside ?? [], page, table, leftOut.setAside),
    unmappedLines: replacedOnTable(pages.unmappedLines ?? [], page, table, leftOut.unmappedLines),
    ...(derivation ? { derivations: replacedOnPage(pages.derivations ?? [], page, [derivation]) } : {}),
  };
}

/**
 * `POST /api/catalog/imports/[id]/reinterpret` (τελευταία πράξη) — η σελίδα κρίθηκε με την τρέχουσα έκδοση παραγωγής (§5.5.2 Β3.1):
 * ξαναχτίστηκε, ή αρνήθηκε με λόγο. Μπαίνει **μετά** τα παράγωγα: διακοπή στη μέση αφήνει τη σελίδα μπαγιάτικη, άρα ξαναδοκιμάζεται.
 * `decisionsDigest` = το αποτύπωμα των αποφάσεων **πάνω στις οποίες κρίθηκε** (§5.5.2 Β3.2): απόφαση που μπήκε στο μεταξύ αφήνει τη
 * σελίδα μπαγιάτικη — ποτέ σφραγίδα νεότερη από την κρίση, ίδιο δόγμα με το `schemaRevision`.
 */
export function stampPageDerivation(
  ctx: AuthContext,
  id: string,
  page: number,
  refusal: ImportLineRefusal | null,
  schemaRevision: number | null,
  decisionsDigest: string,
): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    if (IMPORT_FINISHED_BATCH_STATUSES.includes(current.status)) return current;
    const pages = pagesOrRefuse(current);
    const derivations = replacedOnPage(pages.derivations ?? [], page, [currentDerivation(page, refusal, schemaRevision, decisionsDigest)]);
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), pages: { ...pages, derivations } });
  });
}
