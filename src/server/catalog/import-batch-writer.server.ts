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
import { countPdfPages } from '@/services/pdf/pdf-rasterize.service';
import { importBatchKey } from '@/subapps/catalog/import/import-keys';
import type { ImportBatchDefinition, ImportBatchPages, ImportBatchTarget, ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import type { CreateImportBatchRequest } from '@/subapps/catalog/types/catalog-import-requests';
import type { PriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import { IMPORT_MAX_PAGES_PER_BATCH, type ImportPurpose } from '@/subapps/catalog/vocabulary/catalog-import';
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
import { downloadBatchFile, readBatchFileRecord } from './import-source.server';

export type StoredImportBatch = StoredCatalogRecord<ImportBatchDefinition>;

/**
 * Η ροή «μόνο τιμές» κουβαλά τιμές: πέρα από το δικαίωμα της διαδρομής (`products`) θέλει και της τιμολόγησης. Ξένο ≡
 * ανύπαρκτο: ποιος δεν βλέπει τιμές δεν μαθαίνει ότι υπάρχει παρτίδα τιμών.
 */
export async function assertPurposeAuthority(ctx: AuthContext, purpose: ImportPurpose): Promise<void> {
  if (purpose !== 'priceLines') return;
  if (!(await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing))) throw new CatalogWriteError('notFound');
}

async function assertTargetExists(scope: CatalogTx, target: ImportBatchTarget): Promise<void> {
  if (target.purpose === 'attributes') {
    await readOwned<object>(scope, 'family', target.familyId);
    return;
  }
  const version = await readOwned<PriceListVersionDefinition>(scope, 'priceListVersion', target.priceListVersionId);
  if (version.status !== 'draft') throw new CatalogWriteError('immutable', [{ code: 'versionNotDraft', path: 'target' }]);
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
  return { code, sourceKind, contentSha256, fileName, sizeBytes, fileId: null, target, profileId, profileRevision, run, status: 'awaitingFile', pages: pagesOf(request) };
}

async function profileRevisionOf(scope: CatalogTx, profileId: string | null): Promise<number | null> {
  if (profileId === null) return null;
  return (await readOwned<ImportProfileDefinition>(scope, 'importProfile', profileId)).revision;
}

/** `POST /api/catalog/imports` — ιδεμπότητη: ίδια είσοδος δίνει πίσω την ίδια παρτίδα. */
export async function createImportBatch(ctx: AuthContext, request: CreateImportBatchRequest): Promise<StoredImportBatch> {
  await assertPurposeAuthority(ctx, request.target.purpose);
  return runCatalogTransaction(ctx, async (scope) => {
    const profileRevision = await profileRevisionOf(scope, request.profileId);
    const code = importBatchKey({ ...request, profileRevision });
    const { target, current } = await readForUpsert<ImportBatchDefinition>(scope, 'importBatch', code);
    if (current !== null) return current;
    await assertTargetExists(scope, request.target);
    return stageCreate(scope, 'importBatch', target, definitionOf(request, code, profileRevision));
  });
}

export function batchDefinitionOf(batch: StoredImportBatch): ImportBatchDefinition {
  const { code, sourceKind, contentSha256, fileName, sizeBytes, fileId, target, profileId, profileRevision, run, status, pages } = batch;
  return { code, sourceKind, contentSha256, fileName, sizeBytes, fileId, target, profileId, profileRevision, run, status, pages };
}

async function assertContent(batch: StoredImportBatch, bytes: Buffer): Promise<void> {
  if (createHash('sha256').update(bytes).digest('hex') !== batch.contentSha256) {
    throw new CatalogWriteError('invalid', [{ code: 'fileTypeConflict', path: 'contentSha256' }]);
  }
  const pages = batch.pages;
  if (batch.sourceKind === 'pdf' && pages && pages.to > (await countPdfPages(bytes))) {
    assertNoIssues([{ code: 'tooMany', path: 'pageRange', params: { max: await countPdfPages(bytes) } }]);
  }
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
      status: current.sourceKind === 'pdf' ? 'extracting' : 'mapping',
    });
  });
}

/** `POST /api/catalog/imports/[id]/discard` — η παρτίδα εγκαταλείπεται· ό,τι εφαρμόστηκε μένει. */
export async function discardImportBatch(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    assertRevision(current, expectedRevision);
    await assertPurposeAuthority(ctx, current.target.purpose);
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status: 'discarded' });
  });
}
