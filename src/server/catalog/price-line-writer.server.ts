import 'server-only';

/**
 * Ο **γραφέας γραμμών τιμοκαταλόγου** (ADR-923 §5.11 «3β») — δέσμη upsert/διαγραφής σε **πρόχειρη** έκδοση, όπως η
 * επικόλληση TSV των παραλλαγών: **μία** συναλλαγή, ή γράφονται όλες ή καμία.
 *
 * - CAS στο `linesRevision` της έκδοσης (όχι ανά γραμμή): ο πελάτης στέλνει την εικόνα των γραμμών που είδε.
 * - Ταυτότητα γραμμής = έκδοση + υποκείμενο ⇒ «μία γραμμή ανά υποκείμενο» **δομικά**· upsert = ίδιο έγγραφο.
 * - Επικύρωση με τις **ίδιες** συναρτήσεις του πελάτη· αναφορές (ομάδα έκπτωσης · SKU υποκειμένου · SKU υλικού
 *   ανάλυσης) **μέσα** στη συναλλαγή — ξένο ή διαγραμμένο ≡ ανύπαρκτο.
 * - Αμετάβλητη γραμμή δεν ξαναγράφεται (καμία ψεύτικη αλλαγή στο ιστορικό).
 * @module server/catalog/price-line-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validatePriceListLine, validateVersionLines } from '@/subapps/catalog/schema/validate-pricing';
import type { PriceLineBatch, PriceLineBatchResult } from '@/subapps/catalog/types/price-list-requests';
import type {
  DiscountGroupDefinition,
  PriceListDefinition,
  PriceListLineDefinition,
  StoredPriceListLineDefinition,
} from '@/subapps/catalog/types/price-list';
import { PRICE_LINES_PER_TRANSACTION } from '@/subapps/catalog/vocabulary/pricing';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  readForUpsert,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
} from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';
import { readDraftForLines, stageLinesTouched, storedLineOf, type StoredPriceLine, type StoredPriceVersion } from './price-version-aggregate.server';

/** Τα SKU που αναφέρει μια γραμμή: το υποκείμενο (`variant`) και το υλικό της ανάλυσης (`costItem`). */
function variantRefsOf(line: PriceListLineDefinition): string[] {
  const refs = line.subject.kind === 'variant' ? [line.subject.variantId] : [];
  return line.breakdown?.materialVariantId ? [...refs, line.breakdown.materialVariantId] : refs;
}

function lineIssues(
  line: PriceListLineDefinition,
  index: number,
  context: { readonly list: PriceListDefinition; readonly groups: ReadonlySet<string>; readonly variants: ReadonlySet<string> },
): CatalogIssue[] {
  const own = validatePriceListLine(line, { kind: context.list.kind, priceType: context.list.priceType, discountGroupIds: context.groups });
  const missing = variantRefsOf(line).filter((id) => !context.variants.has(id));
  return [
    ...own.map((issue) => ({ ...issue, path: `upserts[${index}].${issue.path}` })),
    ...missing.map(() => ({ code: 'unknownReference' as const, path: `upserts[${index}].subject` })),
  ];
}

async function assertBatchValid(
  scope: CatalogTx,
  version: StoredPriceVersion,
  lines: readonly PriceListLineDefinition[],
  batch: PriceLineBatch,
): Promise<void> {
  if (lines.length + batch.deletes.length > PRICE_LINES_PER_TRANSACTION) {
    assertNoIssues([{ code: 'tooMany', path: 'upserts', params: { max: PRICE_LINES_PER_TRANSACTION } }]);
  }
  const list = await readOwned<PriceListDefinition>(scope, 'priceList', version.priceListId);
  const groupIds = lines.flatMap((line) => (line.discountGroupId === null ? [] : [line.discountGroupId]));
  const groups = await readActiveByIds<DiscountGroupDefinition>(scope, 'discountGroup', groupIds);
  const variants = await readActiveByIds<object>(scope, 'product', lines.flatMap(variantRefsOf));
  const context = { list, groups: new Set(groups.keys()), variants: new Set(variants.keys()) };
  const deleted = new Set(batch.deletes.map(priceLineSubjectKey));
  const overlap = lines.flatMap((line, index) =>
    deleted.has(priceLineSubjectKey(line.subject)) ? [{ code: 'priceLineSubjectDuplicate' as const, path: `upserts[${index}].subject` }] : [],
  );
  assertNoIssues([
    ...lines.flatMap((line, index) => lineIssues(line, index, context)),
    ...validateVersionLines(lines),
    ...overlap,
  ]);
}

/** Ίδιο περιεχόμενο ⇒ καμία εγγραφή (το `subject` είναι η ταυτότητα, άρα ίδιο εξ ορισμού). */
function sameLine(current: StoredPriceLine, next: PriceListLineDefinition): boolean {
  return (
    current.netPrice === next.netPrice &&
    current.priceQuantity === next.priceQuantity &&
    current.unitCode === next.unitCode &&
    current.discountGroupId === next.discountGroupId &&
    JSON.stringify(current.breakdown) === JSON.stringify(next.breakdown)
  );
}

/**
 * Η δέσμη **μέσα σε υπάρχουσα συναλλαγή**: ο ΕΝΑΣ δρόμος γραμμών, κοινός με την έγκριση εισαγωγής (ADR-923 §5.5.1), που
 * γράφει τις γραμμές και το `applied` της πρότασης ατομικά. Κάνει και αναγνώσεις: ο καλών σκηνοθετεί τα δικά του **μετά**.
 */
export async function stagePriceLineBatch(scope: CatalogTx, versionId: string, batch: PriceLineBatch): Promise<PriceLineBatchResult> {
  const version = await readDraftForLines(scope, versionId, batch.expectedLinesRevision);
  const lines = batch.upserts.map((line): PriceListLineDefinition => ({ ...line, versionId: version.id }));
  await assertBatchValid(scope, version, lines, batch);
  const lineKey = (subjectKey: string) => priceListLineKey(version.id, subjectKey);
  const upserts = await Promise.all(
    lines.map((line) => readForUpsert<StoredPriceListLineDefinition>(scope, 'priceListLine', lineKey(priceLineSubjectKey(line.subject)))),
  );
  const deletes = await Promise.all(
    batch.deletes.map((subject) => readForUpsert<StoredPriceListLineDefinition>(scope, 'priceListLine', lineKey(priceLineSubjectKey(subject)))),
  );
  let written = 0;
  lines.forEach((line, index) => {
    const { target, current } = upserts[index];
    if (current !== null && sameLine(current, line)) return;
    const stored = storedLineOf(version, line);
    if (current === null) stageCreate(scope, 'priceListLine', target, stored);
    else stageReplace(scope, 'priceListLine', current, stored);
    written++;
  });
  for (const { current } of deletes) {
    if (current === null) continue;
    stageSoftDelete(scope, 'priceListLine', current);
    written++;
  }
  const touched = written > 0 ? stageLinesTouched(scope, version) : version;
  return { versionId: version.id, linesRevision: touched.derived.linesRevision, written };
}

/** `PUT /api/catalog/price-list-versions/[id]/lines` — η δέσμη, σε μία συναλλαγή. */
export function savePriceLines(ctx: AuthContext, versionId: string, batch: PriceLineBatch): Promise<PriceLineBatchResult> {
  return runCatalogTransaction(ctx, (scope) => stagePriceLineBatch(scope, versionId, batch));
}
