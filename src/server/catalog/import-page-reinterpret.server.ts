import 'server-only';

/**
 * Η **απόφαση γραμμής και η ξαναερμηνεία ενός πίνακα χωρίς AI** (ADR-923 §5.5.2 Β3 Γ3–Γ5).
 *
 * Ο άνθρωπος λέει «αυτή η γραμμή είναι εκείνη η ιδιότητα». Η σελίδα δεν ξαναδιαβάζεται: ο πίνακας ξαναχτίζεται από τον κοινό πυρήνα
 * (`import-table-rebuild.server`) με την ανθρώπινη απόφαση **από πάνω**. Ίδιος αγωγός, ίδιος κριτής, κόστος $0.
 *
 * 🔑 **Δομικά χωρίς πληρωμή:** ούτε αυτό το αρχείο ούτε ο πυρήνας εισάγουν τον αναλυτή. Όπου λείπει κάτι, αρνείται με λόγο
 *    (`ImportLineRefusal`) και **δεν γράφει τίποτα**· ο άνθρωπος αποφασίζει για νέα ανάγνωση.
 * 🔑 **Εμβέλεια πίνακα:** ξαναερμηνεύεται μόνο ο πίνακας της γραμμής. Άλλος πίνακας της ίδιας σελίδας έχει δική του πρόταση και δική
 *    του σειρά στην ουρά του πελάτη, άρα δύο αποφάσεις σε διαφορετικούς πίνακες δεν πατούν η μία την άλλη.
 * 🔑 Οι αποφάσεις πεδίων του ανθρώπου επιβιώνουν (`carriedDecision`)· πρόταση που εγκρίθηκε ή απορρίφθηκε δεν αγγίζεται.
 * @module server/catalog/import-page-reinterpret.server
 */

import type { AuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { lineDecisionOf, tableOverridesOf, withLineOverride } from '@/subapps/catalog/import/page-line-overrides';
import { familyDefinitionOf, withAttributeAtLevel } from '@/subapps/catalog/schema/family-binding';
import type { ImportBatchDefinition, ImportLineDecision } from '@/subapps/catalog/types/catalog-import';
import type { ImportLineOutcome, SetImportLineRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import type { ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';
import { readSchemaSnapshot } from './catalog-product-reads.server';
import { readOwned, runCatalogReadOnly } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { updateCatalogFamily } from './family-writer.server';
import { assertPurposeAuthority, setImportLineOverride, type StoredImportBatch } from './import-batch-writer.server';
import { readBatchProposals, readImportBatchDetail } from './import-reads.server';
import {
  commitTable,
  groupKeyOf,
  pageBasis,
  prepareTable,
  readBatchSchema,
  refuse,
  tableOf,
  type Judged,
  type TableBasis,
} from './import-table-rebuild.server';

/** Ο πίνακας της γραμμής, και η γραμμή μέσα στα όριά του (ο προσανατολισμός λέει αν οι γραμμές είναι σειρές ή στήλες). */
async function lineBasis(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest): Promise<Judged<TableBasis>> {
  const page = await pageBasis(ctx, batch, request.page);
  if (!page.ok) return page;
  const basis = tableOf(page.value, request.table);
  if (!basis.ok) return basis;
  const { answer, table } = basis.value;
  const lines = answer.variantsIn === 'columns' ? table.rowCount : table.colCount;
  return request.line < lines ? basis : refuse('lineUnknown');
}

/** Νέα ιδιότητα από τη γραμμή: δέσιμο στην οικογένεια της παρτίδας μέσω της μηχανής σχήματος (CHECK 3.106). Αλλαγή δομής ⇒ `schema`. */
async function bindToFamily(ctx: AuthContext, batch: StoredImportBatch, attributeId: string, level: ImportLineBindLevel): Promise<void> {
  if (batch.target.purpose !== 'attributes') return;
  // Ίδιο δόγμα με το `assertPurposeAuthority`: όποιος δεν αλλάζει δομή δεν μαθαίνει ότι η πόρτα υπάρχει.
  if (!(await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.schema))) throw new CatalogWriteError('notFound');
  const { familyId, variantSchemeCode } = batch.target;
  const { familyRecord } = await runCatalogReadOnly(ctx, (scope) => readSchemaSnapshot(scope, familyId, variantSchemeCode));
  const current = familyDefinitionOf(familyRecord);
  const next = withAttributeAtLevel(current, attributeId, level, variantSchemeCode);
  if (canonicalJson(next) === canonicalJson(current)) return;
  await updateCatalogFamily(ctx, familyId, familyRecord.revision, next);
}

/**
 * Ο πίνακας με τις αποφάσεις από πάνω, **μαζί με τη νέα**. Η απόφαση κρίνεται στη μνήμη πριν γραφτεί: άρνηση εδώ δεν αφήνει πίσω της
 * μισή κατάσταση. Μετά γράφεται η απόφαση και ό,τι παράγει.
 */
async function reinterpretTable(ctx: AuthContext, batch: StoredImportBatch, request: SetImportLineRequest, basis: TableBasis): Promise<Judged<null>> {
  const schema = await readBatchSchema(ctx, batch);
  if (schema === null) return refuse('lineUnknown');
  const stamp = { by: ctx.uid, at: nowISO() };
  const overrides = withLineOverride(tableOverridesOf(batch.pages?.lineOverrides, request.page, request.table), request, request.decision, stamp);
  const prepared = prepareTable(schema, basis, overrides);
  if (!prepared.ok) return prepared;
  await setImportLineOverride(ctx, batch.id, request, request.decision);
  await commitTable(ctx, batch.id, prepared.value);
  return { ok: true, value: null };
}

async function openBatch(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<Judged<StoredImportBatch>> {
  const batch = await runCatalogReadOnly(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  if (batch.target.purpose !== 'attributes' || !batch.pages?.done.includes(request.page)) return refuse('lineUnknown');
  const proposal = (await readBatchProposals(ctx, id)).find((candidate) => candidate.groupKey === groupKeyOf(request.page, request.table));
  return proposal && proposal.status !== 'pending' ? refuse('proposalClosed') : { ok: true, value: batch };
}

/** Χρειάζεται ο πίνακας μόνο όταν αλλάζει η αντιστοίχιση: η αγνόηση (και η αναίρεσή της) είναι απλώς κατάσταση. */
const touchesMapping = (decision: ImportLineDecision | null, previous: ImportLineDecision | null): boolean =>
  decision?.kind === 'attribute' || previous?.kind === 'attribute';

async function decideLine(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<ImportLineOutcome> {
  const opened = await openBatch(ctx, id, request);
  if (!opened.ok) return { kind: 'refused', reason: opened.reason };
  const previous = lineDecisionOf(opened.value.pages?.lineOverrides, request);
  if (!touchesMapping(request.decision, previous)) {
    await setImportLineOverride(ctx, id, request, request.decision);
    return { kind: 'settled' };
  }
  const basis = await lineBasis(ctx, opened.value, request);
  if (!basis.ok) return { kind: 'refused', reason: basis.reason };
  if (request.decision?.kind === 'attribute' && request.bind !== null) await bindToFamily(ctx, opened.value, request.decision.attributeId, request.bind);
  const outcome = await reinterpretTable(ctx, opened.value, request, basis.value);
  return outcome.ok ? { kind: 'settled' } : { kind: 'refused', reason: outcome.reason };
}

/** `POST /api/catalog/imports/[id]/lines` — απόφαση γραμμής + ξαναερμηνεία του πίνακά της, χωρίς AI. */
export async function setImportLine(ctx: AuthContext, id: string, request: SetImportLineRequest): Promise<SetImportLineResult> {
  const outcome = await decideLine(ctx, id, request);
  return { view: await readImportBatchDetail(ctx, id), outcome };
}
