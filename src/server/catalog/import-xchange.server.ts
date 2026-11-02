import 'server-only';

/**
 * Η τρίτη πηγή του αγωγού (ADR-923 §5.5.1 · Φάση 7): αρχείο ETIM xChange ⇒ `ExtractedGroup` ⇒ ο ίδιος δρόμος με το Excel και το PDF.
 * Χωρίς προφίλ στηλών: τη θέση του την παίρνουν οι δηλωμένες αντιστοιχίσεις των ιδιοτήτων της οικογένειας.
 * @module server/catalog/import-xchange.server
 */

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { AuthContext } from '@/lib/auth';
import { readXChangeProducts } from '@/subapps/catalog/interop/etim/xchange-document';
import { extractGroupsFromXChange, type XChangeAttribute, type XChangeImportSchema } from '@/subapps/catalog/interop/etim/xchange-to-groups';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { proposeGroup, type StoredImportProposal } from './import-proposal-writer.server';

const NOT_XCHANGE = new CatalogWriteError('invalid', [{ code: 'fileTypeConflict', path: 'fileId' }]);

async function readImportSchema(ctx: AuthContext, target: Extract<ImportBatchDefinition['target'], { purpose: 'attributes' }>): Promise<XChangeImportSchema> {
  const schema = await runCatalogTransaction(ctx, (scope) => readSchemaSnapshot(scope, target.familyId, target.variantSchemeCode));
  const attributes: XChangeAttribute[] = [...schema.attributes].map(([id, attribute]) => ({ ...attribute, id }));
  return { etimClass: schema.family.etimClass ?? null, attributes, labelAttributeId: schema.family.labelAttributeId, hasVariants: schema.scheme !== null, language: DEFAULT_LANGUAGE };
}

/** `POST /api/catalog/imports/[id]/map` για αρχείο xChange. Μία συναλλαγή ανά σύνολο, και η αναφορά μένει πάνω στην παρτίδα. */
export async function buildXChangeProposals(ctx: AuthContext, batch: StoredImportBatch, bytes: Buffer): Promise<readonly StoredImportProposal[]> {
  if (batch.target.purpose !== 'attributes') throw NOT_XCHANGE;
  const products = readXChangeProducts(bytes.toString('utf8'));
  if (products === null) throw NOT_XCHANGE;
  const { groups, report } = extractGroupsFromXChange(products, await readImportSchema(ctx, batch.target));
  const proposals: StoredImportProposal[] = [];
  for (const group of groups) proposals.push(await proposeGroup(ctx, batch.id, group));
  await runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batch.id);
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status: 'reviewing', xchangeReport: report });
  });
  return proposals;
}
