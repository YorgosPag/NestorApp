import 'server-only';

/**
 * Οι **δύο πηγές** του αγωγού (ADR-923 §5.5.1) προς την ίδια `ExtractedGroup`: πίνακας αρχείου και σελίδα PDF. Από εκεί και πέρα
 * ένας δρόμος (`proposeGroup`). Ένας σύνδεσμος §18 ή ένα ETIM xChange θα είναι τρίτη συνάρτηση εδώ.
 *
 * Η σελίδα διαβάζεται **μία-μία** με οδηγό τον πελάτη: κανένα αίτημα δεν κρατά ώρες, η πρόοδος είναι ζωντανή, και η διακοπή
 * συνεχίζει. Ιδεμπότητη: σελίδα που έχει διαβαστεί δεν ξαναπληρώνεται (~$0,024/σελίδα, §21.3). Η ροή της ζει στο `import-page-flow`.
 * @module server/catalog/import-readers.server
 */

import type { AuthContext } from '@/lib/auth';
import { readPdfPage } from '@/services/pdf/pdf-rasterize.service';
import { extractGroupsFromTable } from '@/subapps/catalog/import/apply-column-rules';
import { addUsage, NO_USAGE } from '@/subapps/catalog/import/page-analyzer';
import type { PageAttributeSpec } from '@/subapps/catalog/import/page-extraction';
import { tokenizePage } from '@/subapps/catalog/import/page-tokens';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ImportBatchDefinition, ImportPagesUsage, ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { IMPORT_PAGE_DPI } from '@/subapps/catalog/vocabulary/catalog-import';
import { attributeOwnerDepth } from '@/subapps/catalog/values/attribute-levels';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertPurposeAuthority, batchDefinitionOf, fileOwnerOf, type StoredImportBatch } from './import-batch-writer.server';
import { readAndProposePage, type PageFlowResult, type PageSpecs } from './import-page-flow.server';
import { proposeGroup, type StoredImportProposal } from './import-proposal-writer.server';
import { buildXChangeProposals } from './import-xchange.server';
import { downloadBatchFile, readBatchFileRecord, readBatchTable } from './import-source.server';

async function readBatchFile(ctx: AuthContext, batch: StoredImportBatch): Promise<Buffer> {
  if (batch.fileId === null) throw new CatalogWriteError('invalid', [{ code: 'fileNotFound', path: 'fileId' }]);
  return downloadBatchFile(await readBatchFileRecord(ctx, fileOwnerOf(batch), batch.fileId));
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
    if (stored.sourceKind === 'etimXchange') return { batch: stored, profile: null };
    if (stored.profileId === null) throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'profileId' }]);
    return { batch: stored, profile: await readOwned<ImportProfileDefinition>(scope, 'importProfile', stored.profileId) };
  });
  await assertPurposeAuthority(ctx, batch.target.purpose);
  if (profile === null) return buildXChangeProposals(ctx, batch, await readBatchFile(ctx, batch));
  const table = await readBatchTable(batch, await readBatchFile(ctx, batch), profile);
  const proposals: StoredImportProposal[] = [];
  for (const group of extractGroupsFromTable(table, profile)) proposals.push(await proposeGroup(ctx, id, group));
  await setStatus(ctx, id, 'reviewing');
  return proposals;
}

function attributeSpecOf(attribute: CatalogAttributeDefinition, depth: number): PageAttributeSpec {
  const config = attribute.config as { readonly options?: readonly { readonly code: string }[] };
  return {
    code: attribute.code,
    label: attribute.labels.el ?? attribute.labels.en ?? attribute.code,
    description: attribute.description.el ?? attribute.description.en ?? null,
    type: attribute.type,
    level: depth === 0 ? 'shared' : 'variant',
    unique: attribute.unique,
    options: config.options?.map((option) => option.code) ?? [],
  };
}

function pageSpecs(schema: CatalogSchemaSnapshot): PageSpecs {
  const entries = [...schema.attributes].map(([id, attribute]) => ({ id, attribute }));
  return {
    specs: entries.map(({ id, attribute }) => attributeSpecOf(attribute, schema.scheme ? attributeOwnerDepth(schema.scheme, id) : 1)),
    byCode: new Map(entries.map(({ id, attribute }) => [attribute.code, { ...attribute, id }])),
    codeById: new Map(entries.map(({ id, attribute }) => [id, attribute.code])),
  };
}

/** Η τελευταία ανάγνωση της σελίδας είναι η αλήθεια και για όσα έμειναν απέξω (πίνακες Ε3 · γραμμές Ε7). */
const replacedOnPage = <TEntry extends { readonly page: number }>(current: readonly TEntry[], page: number, next: readonly TEntry[]): TEntry[] =>
  [...current.filter((entry) => entry.page !== page), ...next];

function markPage(ctx: AuthContext, id: string, page: number, { ok, usage, setAside, unmappedLines }: PageFlowResult): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    const pages = current.pages;
    if (!pages) return current;
    const done = ok ? [...new Set([...pages.done, page])] : pages.done;
    const failed = ok ? pages.failed.filter((other) => other !== page) : [...new Set([...pages.failed, page])];
    const total = pages.to - pages.from + 1;
    const status = done.length + failed.length >= total ? 'reviewing' : current.status;
    const spent = addUsage(pages.usage ?? NO_USAGE, usage);
    const leftOut = { setAside: replacedOnPage(pages.setAside ?? [], page, setAside), unmappedLines: replacedOnPage(pages.unmappedLines ?? [], page, unmappedLines) };
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status, pages: { ...pages, done, failed, usage: spent, ...leftOut } });
  });
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
  const { png, items, rules, tagTables } = await readPdfPage(await readBatchFile(ctx, batch), page, { dpi: IMPORT_PAGE_DPI });
  const axisAttributeIds = schema.scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [];
  const outcome = await readAndProposePage({ ctx, batchId: id, page, png, tokens: tokenizePage(items), rules, tagTables, specs: pageSpecs(schema), registry: schema.registry, axisAttributeIds });
  return markPage(ctx, id, page, outcome);
}
