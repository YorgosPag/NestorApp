import 'server-only';

/**
 * Ο **τιμοκατάλογος μιας παρτίδας ιδιοτήτων** (ADR-923 §5.5.2 Β4 Δ1): η πρόχειρη έκδοση όπου πάει η τιμή της ίδιας ανάγνωσης.
 *
 * 🔑 **Ρύθμιση, όχι ταυτότητα:** δεν μπαίνει στο κλειδί της παρτίδας, άρα ορίζεται ή αλλάζει σε υπάρχουσα παρτίδα **χωρίς** νέα
 *    πληρωμένη ανάγνωση. Οι εκκρεμείς προτάσεις τιμών ξανασχεδιάζονται απέναντι στη νέα έκδοση· εγκεκριμένες/απορριφθείσες μένουν.
 * 🔑 Όσο υπάρχει γραμμή τιμής, ο τιμοκατάλογος **δεν** αφαιρείται: θα έμενε πρόταση τιμών χωρίς προορισμό. Πρώτα αναιρείται η γραμμή
 *    (που ξαναχτίζει τον πίνακα), μετά αφαιρείται ο τιμοκατάλογος.
 * 🔑 Θέλει το δικαίωμα της τιμολόγησης· ξένο ≡ ανύπαρκτο (`assertPurposeAuthority`).
 * @module server/catalog/import-price-target.server
 */

import type { AuthContext } from '@/lib/auth';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, SetImportPriceTargetRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { assertRevision, readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertDraftPriceVersion, assertImportBatchOpen, assertPurposeAuthority, batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { proposeGroup } from './import-proposal-writer.server';
import { readBatchProposals, readImportBatchDetail } from './import-reads.server';

const hasPriceLines = (batch: ImportBatchDefinition): boolean => (batch.pages?.lineOverrides ?? []).some((override) => override.decision.kind === 'price');

function storePriceTarget(ctx: AuthContext, id: string, request: SetImportPriceTargetRequest): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    assertRevision(current, request.expectedRevision);
    assertImportBatchOpen(current);
    const { target } = current;
    if (target.purpose !== 'attributes') throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'priceListVersionId' }]);
    if (request.priceListVersionId === null && hasPriceLines(current)) {
      throw new CatalogWriteError('immutable', [{ code: 'fieldImmutable', path: 'priceListVersionId', params: { field: 'priceListVersionId' } }]);
    }
    if (request.priceListVersionId !== null) await assertDraftPriceVersion(scope, request.priceListVersionId);
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), target: { ...target, priceListVersionId: request.priceListVersionId } });
  });
}

/** `PUT /api/catalog/imports/[id]/price-target` — ορισμός/αλλαγή/αφαίρεση, και επανασχεδιασμός των εκκρεμών προτάσεων τιμών. */
export async function setImportPriceTarget(ctx: AuthContext, id: string, request: SetImportPriceTargetRequest): Promise<ImportBatchDetailView> {
  await assertPurposeAuthority(ctx, 'priceLines');
  await storePriceTarget(ctx, id, request);
  const pending = (await readBatchProposals(ctx, id)).filter((proposal) => proposal.purpose === 'priceLines' && proposal.status === 'pending');
  for (const proposal of pending) await proposeGroup(ctx, id, proposal.extracted);
  return readImportBatchDetail(ctx, id);
}
