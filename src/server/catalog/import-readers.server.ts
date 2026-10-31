import 'server-only';

/**
 * Οι **δύο πηγές** του αγωγού (ADR-923 §5.5.1) προς την ίδια `ExtractedGroup`: πίνακας αρχείου και σελίδα PDF. Από εκεί και πέρα
 * ένας δρόμος (`proposeGroup`). Ένας σύνδεσμος §18 ή ένα ETIM xChange θα είναι τρίτη συνάρτηση εδώ.
 *
 * Η σελίδα διαβάζεται **μία-μία** με οδηγό τον πελάτη: κανένα αίτημα δεν κρατά ώρες, η πρόοδος είναι ζωντανή, και η διακοπή
 * συνεχίζει. Ιδεμπότητη: σελίδα που έχει διαβαστεί δεν ξαναπληρώνεται (~$0,024/σελίδα, §21.3).
 * 🔑 Ευρήματα κανόνων ⇒ **μία** επανάληψη με ανατροφοδότηση (η ίδια στρατηγική με το ADR-327). Αν επιμένουν, περνούν στον
 * άνθρωπο ως σημαίες, ποτέ δεν κρύβονται.
 * @module server/catalog/import-readers.server
 */

import type { AuthContext } from '@/lib/auth';
import { readPdfPage } from '@/services/pdf/pdf-rasterize.service';
import { extractGroupsFromTable } from '@/subapps/catalog/import/apply-column-rules';
import { extractGroupsFromPage, type PageAttributeSpec, type RawPageExtraction } from '@/subapps/catalog/import/page-extraction';
import { tokenizePage, type PageToken } from '@/subapps/catalog/import/page-tokens';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ImportBatchDefinition, ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { IMPORT_PAGE_DPI } from '@/subapps/catalog/vocabulary/catalog-import';
import { attributeOwnerDepth } from '@/subapps/catalog/values/attribute-levels';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertPurposeAuthority, batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { createCatalogPageAnalyzer } from './import-page-analyzer.server';
import { proposeGroup, type StoredImportProposal } from './import-proposal-writer.server';
import { downloadBatchFile, readBatchFileRecord, readBatchTable } from './import-source.server';

const FEEDBACK_ATTEMPTS = 2;

async function readBatchFile(ctx: AuthContext, batch: StoredImportBatch): Promise<Buffer> {
  if (batch.fileId === null) throw new CatalogWriteError('invalid', [{ code: 'fileNotFound', path: 'fileId' }]);
  return downloadBatchFile(await readBatchFileRecord(ctx, batch.id, batch.fileId));
}

function setStatus(ctx: AuthContext, id: string, status: ImportBatchDefinition['status']): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    return current.status === status ? current : stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status });
  });
}

/** `POST /api/catalog/imports/[id]/map` — το αρχείο περνά από το προφίλ: μία συναλλαγή ανά σύνολο. */
export async function buildTableProposals(ctx: AuthContext, id: string): Promise<readonly StoredImportProposal[]> {
  const { batch, profile } = await runCatalogTransaction(ctx, async (scope) => {
    const stored = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    if (stored.profileId === null) throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'profileId' }]);
    return { batch: stored, profile: await readOwned<ImportProfileDefinition>(scope, 'importProfile', stored.profileId) };
  });
  await assertPurposeAuthority(ctx, batch.target.purpose);
  const table = await readBatchTable(batch, await readBatchFile(ctx, batch), profile);
  const proposals: StoredImportProposal[] = [];
  for (const group of extractGroupsFromTable(table, profile)) proposals.push(await proposeGroup(ctx, id, group));
  await setStatus(ctx, id, 'reviewing');
  return proposals;
}

function attributeSpecOf(attribute: CatalogAttributeDefinition, depth: number): PageAttributeSpec {
  const config = attribute.config as { readonly defaultUnitCode?: string; readonly options?: readonly { readonly code: string }[] };
  return {
    code: attribute.code,
    label: attribute.labels.el ?? attribute.labels.en ?? attribute.code,
    type: attribute.type,
    unit: config.defaultUnitCode ?? null,
    level: depth === 0 ? 'shared' : 'variant',
    options: config.options?.map((option) => option.code) ?? [],
  };
}

function pageSpecs(schema: CatalogSchemaSnapshot) {
  const entries = [...schema.attributes].map(([id, attribute]) => ({ id, attribute }));
  return {
    specs: entries.map(({ id, attribute }) => attributeSpecOf(attribute, schema.scheme ? attributeOwnerDepth(schema.scheme, id) : 1)),
    byCode: new Map(entries.map(({ id, attribute }) => [attribute.code, { ...attribute, id }])),
  };
}

function feedbackOf(proposals: readonly StoredImportProposal[]): string[] {
  return proposals.flatMap((proposal) => proposal.violations.map((violation) => `Rule ${violation.ruleId} (${violation.kind}) fails for attributes ${violation.attributeIds.join(', ')}.`));
}

function markPage(ctx: AuthContext, id: string, page: number, outcome: 'done' | 'failed'): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    const pages = current.pages;
    if (!pages) return current;
    const done = outcome === 'done' ? [...new Set([...pages.done, page])] : pages.done;
    const failed = outcome === 'failed' ? [...new Set([...pages.failed, page])] : pages.failed.filter((other) => other !== page);
    const total = pages.to - pages.from + 1;
    const status = done.length + failed.length >= total ? 'reviewing' : current.status;
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status, pages: { ...pages, done, failed } });
  });
}

interface PageContext {
  readonly ctx: AuthContext;
  readonly batchId: string;
  readonly page: number;
  readonly png: Buffer;
  readonly tokens: readonly PageToken[];
  readonly specs: ReturnType<typeof pageSpecs>;
}

function proposeExtraction(input: PageContext, extraction: RawPageExtraction): Promise<StoredImportProposal[]> {
  const context = { page: input.page, tokens: new Map(input.tokens.map((token) => [token.id, token])), attributesByCode: input.specs.byCode };
  return Promise.all(extractGroupsFromPage(extraction, context).map((group) => proposeGroup(input.ctx, input.batchId, group)));
}

/** Διάβασμα → πρόταση → αν σηκώθηκαν κανόνες, μία ακόμη ανάγνωση με ανατροφοδότηση. */
async function readAndPropose(input: PageContext): Promise<{ readonly ok: boolean; readonly proposals: readonly StoredImportProposal[] }> {
  const analyzer = createCatalogPageAnalyzer();
  let feedback: readonly string[] = [];
  let proposals: readonly StoredImportProposal[] = [];
  let ok = false;
  for (let attempt = 0; attempt < FEEDBACK_ATTEMPTS; attempt += 1) {
    const reading = await analyzer.readPage({ png: input.png, tokens: input.tokens, attributes: input.specs.specs, feedback });
    if (reading.kind === 'unavailable') throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'analyzer' }]);
    if (reading.kind === 'failed') break;
    proposals = await proposeExtraction(input, reading.extraction);
    ok = true;
    feedback = feedbackOf(proposals);
    if (feedback.length === 0) break;
  }
  return { ok, proposals };
}

/** `POST /api/catalog/imports/[id]/pages` — μία σελίδα. */
export async function readImportPage(ctx: AuthContext, id: string, page: number): Promise<StoredImportBatch> {
  const { batch, schema } = await runCatalogTransaction(ctx, async (scope) => {
    const stored = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    if (stored.target.purpose !== 'attributes') throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'target' }]);
    return { batch: stored, schema: await readSchemaSnapshot(scope, stored.target.familyId, stored.target.variantSchemeCode) };
  });
  const pages = batch.pages;
  if (!pages || page < pages.from || page > pages.to) throw new CatalogWriteError('invalid', [{ code: 'tooMany', path: 'page' }]);
  if (pages.done.includes(page)) return batch;
  const { png, items } = await readPdfPage(await readBatchFile(ctx, batch), page, { dpi: IMPORT_PAGE_DPI });
  const { ok } = await readAndPropose({ ctx, batchId: id, page, png, tokens: tokenizePage(items), specs: pageSpecs(schema) });
  return markPage(ctx, id, page, ok ? 'done' : 'failed');
}
