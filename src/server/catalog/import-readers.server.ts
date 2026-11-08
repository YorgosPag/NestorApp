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
import { createModuleLogger } from '@/lib/telemetry';
import type { PdfTextLayer } from '@/services/pdf/pdf-rasterize.service';
import { extractGroupsFromTable } from '@/subapps/catalog/import/apply-column-rules';
import { addUsage, NO_USAGE } from '@/subapps/catalog/import/page-analyzer';
import type { ImportBatchDefinition, ImportPagesUsage, ImportPageTextless, ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertPurposeAuthority, batchDefinitionOf, replacedOnPage, type StoredImportBatch } from './import-batch-writer.server';
import { readAndProposePage, type PageFlowResult } from './import-page-flow.server';
import { axisAttributeIdsOf, loadPdfPageSource, pageSpecs, readBatchFile } from './import-page-source.server';
import { groupTableRowsByLiveModel } from './import-proposal-plan.server';
import { proposeGroup, retireStaleSourceProposals, type StoredImportProposal } from './import-proposal-writer.server';
import { buildXChangeProposals } from './import-xchange.server';
import { readBatchTable } from './import-source.server';

const logger = createModuleLogger('CatalogImportReaders');

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
  for (const group of await groupTableRowsByLiveModel(ctx, batch.target, extractGroupsFromTable(table, profile))) proposals.push(await proposeGroup(ctx, id, group));
  await retireStaleSourceProposals(ctx, id, proposals);
  await setStatus(ctx, id, 'reviewing');
  return proposals;
}

/** Ε8: η σελίδα χωρίς κείμενο δηλώνεται· με κείμενο, η δήλωση μιας παλαιότερης ανάγνωσης φεύγει. */
function textlessOf(page: number, layer: PdfTextLayer): ImportPageTextless[] {
  if (layer.state === 'present') return [];
  return [{ page, kind: layer.state, reason: layer.state === 'lost' ? layer.reason : null }];
}

/** Ε8: χαμένη στρώση κειμένου ⇒ η σελίδα **δεν** στέλνεται στο μοντέλο: αποτυγχάνει δηλωμένα, χωρίς χρέωση, και ξαναδιαβάζεται. */
const TEXT_LAYER_LOST: PageFlowResult = { ok: false, usage: NO_USAGE, setAside: [], unmappedLines: [] };

function markPage(ctx: AuthContext, id: string, page: number, { ok, usage, setAside, unmappedLines }: PageFlowResult, textless: readonly ImportPageTextless[]): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    const pages = current.pages;
    if (!pages) return current;
    const done = ok ? [...new Set([...pages.done, page])] : pages.done;
    const failed = ok ? pages.failed.filter((other) => other !== page) : [...new Set([...pages.failed, page])];
    const total = pages.to - pages.from + 1;
    const status = done.length + failed.length >= total ? 'reviewing' : current.status;
    const spent = addUsage(pages.usage ?? NO_USAGE, usage);
    const leftOut = {
      setAside: replacedOnPage(pages.setAside ?? [], page, setAside),
      unmappedLines: replacedOnPage(pages.unmappedLines ?? [], page, unmappedLines),
      textless: replacedOnPage(pages.textless ?? [], page, textless),
    };
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
  const { png, tokens, rules, tagTables, textLayer } = await loadPdfPageSource(ctx, batch, page);
  if (textLayer.state === 'lost') {
    logger.warn('PDF text layer lost on read', { batchId: id, page, reason: textLayer.reason });
    return markPage(ctx, id, page, TEXT_LAYER_LOST, textlessOf(page, textLayer));
  }
  if (textLayer.state === 'present' && textLayer.recovered) logger.info('PDF text layer recovered on strict re-read', { batchId: id, page });
  const outcome = await readAndProposePage({ ctx, batchId: id, page, png, tokens, rules, tagTables, specs: pageSpecs(schema), registry: schema.registry, axisAttributeIds: axisAttributeIdsOf(schema) });
  return markPage(ctx, id, page, outcome, textlessOf(page, textLayer));
}
