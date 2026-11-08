import 'server-only';

/**
 * **Αναβάθμιση σελίδας στην τρέχουσα έκδοση παραγωγής** (ADR-923 §5.5.2 Β3.1) — όπως το Revit αναβαθμίζει αρχείο όταν το ανοίγεις.
 *
 * Τα παράγωγα μιας σελίδας (προτάσεις · πίνακες απέξω · γραμμές χωρίς πεδίο) **αποθηκεύονται** στην παρτίδα. Όταν αλλάζει ο παραγωγός
 * (`IMPORT_PAGE_DERIVATION`), η παλιά σελίδα ξαναχτίζεται από την πηγή της: φυλαγμένη απάντηση + PDF + αποφάσεις του ανθρώπου. Ίδιος
 * πυρήνας με την απόφαση γραμμής (`import-table-rebuild.server`), κόστος $0.
 *
 * 🔑 **Ιδεμπότητο από τη φύση του:** σελίδα ήδη τρέχουσα ⇒ καμία εγγραφή. Η σφραγίδα μπαίνει **τελευταία**: διακοπή στη μέση αφήνει τη
 *    σελίδα μπαγιάτικη, άρα ξαναδοκιμάζεται, και το ξαναχτίσιμο είναι ντετερμινιστικό.
 * 🔑 **Όλα ή τίποτα ανά σελίδα:** κάθε πίνακας κρίνεται στη μνήμη πριν γραφτεί ο πρώτος. Άρνηση ⇒ καμία εγγραφή παραγώγων, μόνο
 *    σφραγίδα με τον λόγο, ώστε να μη ξαναδοκιμάζεται σε κάθε άνοιγμα και η οθόνη να ξέρει γιατί.
 * 🔑 Παρτίδα κλειστή ή εγκαταλειμμένη δεν αγγίζεται. Πρόταση εγκεκριμένη/απορριφθείσα μένει ως έχει (`stageGroup`).
 * @module server/catalog/import-page-rederive.server
 */

import type { AuthContext } from '@/lib/auth';
import { isPageCurrent } from '@/subapps/catalog/import/page-derivation';
import { tableOverridesOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_FINISHED_BATCH_STATUSES } from '@/subapps/catalog/vocabulary/catalog-import';
import { readOwned, runCatalogReadOnly } from './catalog-store.server';
import { assertPurposeAuthority, stampPageDerivation, type StoredImportBatch } from './import-batch-writer.server';
import { readImportBatchDetail } from './import-reads.server';
import { commitTable, pageBasis, prepareTable, readBatchSchema, refuse, tableOf, type Judged, type PreparedTable } from './import-table-rebuild.server';

/** Μόνο ανοιχτή παρτίδα ιδιοτήτων, σε σελίδα διαβασμένη και μπαγιάτικη. Οτιδήποτε άλλο ⇒ τίποτα να γίνει. */
function needsRederive(batch: StoredImportBatch, page: number): boolean {
  const { pages } = batch;
  if (batch.target.purpose !== 'attributes' || IMPORT_FINISHED_BATCH_STATUSES.includes(batch.status) || !pages) return false;
  return pages.done.includes(page) && !isPageCurrent(pages, page);
}

/** Κάθε πίνακας της φυλαγμένης ανάγνωσης, με τις αποφάσεις του ανθρώπου από πάνω, κριμένος στη μνήμη. Μία άρνηση ⇒ άρνηση σελίδας. */
async function preparePage(ctx: AuthContext, batch: StoredImportBatch, page: number): Promise<Judged<readonly PreparedTable[]>> {
  const basis = await pageBasis(ctx, batch, page);
  if (!basis.ok) return basis;
  const schema = await readBatchSchema(ctx, batch);
  if (schema === null) return refuse('lineUnknown');
  const prepared: PreparedTable[] = [];
  for (const { table: key } of basis.value.answer.tables) {
    const table = tableOf(basis.value, key);
    if (!table.ok) return table;
    const ready = prepareTable(schema, table.value, tableOverridesOf(batch.pages?.lineOverrides, page, key));
    if (!ready.ok) return ready;
    prepared.push(ready.value);
  }
  return { ok: true, value: prepared };
}

/** `POST /api/catalog/imports/[id]/reinterpret` — μία σελίδα στην τρέχουσα έκδοση παραγωγής, χωρίς AI. */
export async function reinterpretImportPage(ctx: AuthContext, id: string, page: number): Promise<ImportBatchDetailView> {
  const batch = await runCatalogReadOnly(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  if (needsRederive(batch, page)) {
    const prepared = await preparePage(ctx, batch, page);
    if (prepared.ok) for (const table of prepared.value) await commitTable(ctx, batch.id, table);
    await stampPageDerivation(ctx, batch.id, page, prepared.ok ? null : prepared.reason);
  }
  return readImportBatchDetail(ctx, id);
}
