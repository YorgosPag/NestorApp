import 'server-only';

/**
 * Ο **προμηθευτής μιας παρτίδας ιδιοτήτων** (ADR-923 §5.5.2 Β5 Απόφαση 1): η επαφή που δίνει τη μνήμη ετικετών γραμμής.
 *
 * 🔑 **Ρύθμιση, όχι ταυτότητα:** δεν μπαίνει στο κλειδί της παρτίδας (όπως ο τιμοκατάλογος, Β4 Δ1), άρα ορίζεται ή αλλάζει σε υπάρχουσα
 *    παρτίδα **χωρίς** νέα πληρωμένη ανάγνωση.
 * 🔑 **Καμία σιωπηλή εγγραφή** (Απόφαση 4): ο ορισμός δεν εφαρμόζει μνήμη στις σελίδες που διαβάστηκαν. Ισχύει από την επόμενη
 *    ανάγνωση, και οι εγκρίσεις από εδώ και πέρα μαθαίνουν για αυτόν τον προμηθευτή.
 * 🔑 Η επαφή πρέπει να υπάρχει στον χώρο (`partyIssues`, ίδιος κριτής με την τιμολόγηση). Ξένη ≡ ανύπαρκτη.
 * @module server/catalog/import-supplier.server
 */

import type { AuthContext } from '@/lib/auth';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, SetImportSupplierRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { assertRevision, readOwned, runCatalogTransaction, stageReplace } from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import { assertImportBatchOpen, batchDefinitionOf, type StoredImportBatch } from './import-batch-writer.server';
import { readImportBatchDetail } from './import-reads.server';
import { partyIssues } from './pricing-party-reads.server';

function storeSupplier(ctx: AuthContext, id: string, request: SetImportSupplierRequest): Promise<StoredImportBatch> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportBatchDefinition>(scope, 'importBatch', id);
    assertRevision(current, request.expectedRevision);
    assertImportBatchOpen(current);
    const { target } = current;
    if (target.purpose !== 'attributes') throw new CatalogWriteError('invalid', [{ code: 'unknownReference', path: 'supplierContactId' }]);
    const { supplierContactId } = request;
    if (supplierContactId !== null) assertNoIssues(await partyIssues(scope, { kind: 'contact', contactId: supplierContactId }, 'supplierContactId'));
    if ((target.supplierContactId ?? null) === supplierContactId) return current;
    return stageReplace(scope, 'importBatch', current, { ...batchDefinitionOf(current), target: { ...target, supplierContactId } });
  });
}

/** `PUT /api/catalog/imports/[id]/supplier` — ορισμός/αλλαγή/αφαίρεση του προμηθευτή, χωρίς ανάγνωση και χωρίς εφαρμογή μνήμης. */
export async function setImportSupplier(ctx: AuthContext, id: string, request: SetImportSupplierRequest): Promise<ImportBatchDetailView> {
  await storeSupplier(ctx, id, request);
  return readImportBatchDetail(ctx, id);
}
