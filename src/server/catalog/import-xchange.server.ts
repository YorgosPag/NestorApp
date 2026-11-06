import 'server-only';

/**
 * Η τρίτη πηγή του αγωγού (ADR-923 §5.5.1 · Φάση 7 · §23.2 K4γ): αρχείο ETIM xChange ⇒ `ExtractedGroup` ⇒ ο ίδιος δρόμος με το Excel
 * και το PDF, για **και τους δύο** σκοπούς.
 * - `attributes`: χωρίς προφίλ στηλών· τη θέση του την παίρνουν οι δηλωμένες αντιστοιχίσεις των ιδιοτήτων της οικογένειας.
 * - `priceLines`: το `TradeItem.Pricing` προς την πρόχειρη έκδοση-στόχο· ποιο ποσό και ποια περίοδο τα λένε η λίστα και η έκδοση.
 * @module server/catalog/import-xchange.server
 */

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { AuthContext } from '@/lib/auth';
import { MONEY_CURRENCY } from '@/lib/money/money';
import { readXChangeDocument, type XChangeDocumentView } from '@/subapps/catalog/interop/etim/xchange-document';
import { extractPriceGroupsFromXChange, type XChangePriceImportContext } from '@/subapps/catalog/interop/etim/xchange-pricing-to-groups';
import type { XChangeImportReport } from '@/subapps/catalog/interop/etim/xchange-report';
import { extractGroupsFromXChange, type XChangeAttribute, type XChangeImportSchema } from '@/subapps/catalog/interop/etim/xchange-to-groups';
import type { ExtractedGroup, ImportBatchDefinition, ImportBatchTarget } from '@/subapps/catalog/types/catalog-import';
import type { PriceListDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { proposeGroup, type StoredImportProposal } from './import-proposal-writer.server';

const NOT_XCHANGE = new CatalogWriteError('invalid', [{ code: 'fileTypeConflict', path: 'fileId' }]);

type Extraction = { readonly groups: readonly ExtractedGroup[]; readonly report: XChangeImportReport };

async function readImportSchema(ctx: AuthContext, target: Extract<ImportBatchTarget, { purpose: 'attributes' }>): Promise<XChangeImportSchema> {
  const schema = await runCatalogTransaction(ctx, (scope) => readSchemaSnapshot(scope, target.familyId, target.variantSchemeCode));
  const attributes: XChangeAttribute[] = [...schema.attributes].map(([id, attribute]) => ({ ...attribute, id }));
  return { etimClass: schema.family.etimClass ?? null, attributes, labelAttributeId: schema.family.labelAttributeId, hasVariants: schema.scheme !== null, language: DEFAULT_LANGUAGE };
}

/**
 * Τύπος τιμής και έναρξη ισχύος της έκδοσης-στόχου. 🔑 Το νόμισμα **δεν** αποθηκεύεται ανά λίστα (`MONEY_CURRENCY`, μία αλήθεια):
 * αρχείο σε άλλο νόμισμα απορρίπτεται ολόκληρο, γιατί κάθε γραμμή του θα ήταν λάθος τιμή. Αδήλωτο νόμισμα ⇒ λογίζεται, δηλωμένα.
 */
async function readPriceContext(ctx: AuthContext, target: Extract<ImportBatchTarget, { purpose: 'priceLines' }>, currency: string | null): Promise<XChangePriceImportContext> {
  if (currency !== null && currency.trim().toUpperCase() !== MONEY_CURRENCY) {
    throw new CatalogWriteError('invalid', [{ code: 'currencyConflict', path: 'fileId', params: { currency: currency.trim(), expected: MONEY_CURRENCY } }]);
  }
  return runCatalogTransaction(ctx, async (scope) => {
    const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', target.priceListVersionId);
    const list = await readOwned<PriceListDefinition>(scope, 'priceList', version.priceListId);
    return { priceType: list.priceType, validFrom: version.validFrom, currencyAssumed: currency === null };
  });
}

async function extract(ctx: AuthContext, target: ImportBatchTarget, view: XChangeDocumentView): Promise<Extraction> {
  if (target.purpose === 'attributes') return extractGroupsFromXChange(view.products, await readImportSchema(ctx, target));
  return extractPriceGroupsFromXChange(view.products, await readPriceContext(ctx, target, view.currency));
}

/** `POST /api/catalog/imports/[id]/map` για αρχείο xChange. Μία συναλλαγή ανά σύνολο, και η αναφορά μένει πάνω στην παρτίδα. */
export async function buildXChangeProposals(ctx: AuthContext, batch: StoredImportBatch, bytes: Buffer): Promise<readonly StoredImportProposal[]> {
  const view = readXChangeDocument(bytes.toString('utf8'));
  if (view === null) throw NOT_XCHANGE;
  const { groups, report } = await extract(ctx, batch.target, view);
  const proposals: StoredImportProposal[] = [];
  for (const group of groups) proposals.push(await proposeGroup(ctx, batch.id, group));
  await runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batch.id);
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), status: 'reviewing', xchangeReport: report });
  });
  return proposals;
}
