import 'server-only';

/**
 * Η **έγκριση** (ADR-923 §5.5): η μόνη στιγμή που μια εισαγωγή γράφει δεδομένα, και γράφει **μέσα από τους υπάρχοντες
 * γραφείς**: `commitAggregate` για μοντέλα/SKU · `stagePriceLineBatch` για τιμές. Ιστορικό (ADR-195), κρατήσεις, κανόνες
 * και σήματα όψεων έρχονται από εκεί, χωρίς δεύτερο δρόμο.
 *
 * 🔑 Δεδομένα **και** `applied` της πρότασης σε **μία** συναλλαγή: η επανάληψη βρίσκει `applied` και δεν ξαναγράφει τίποτα.
 * 🔑 CAS ανά γραμμή με την αναθεώρηση της διαφοράς: αν τα ζωντανά άλλαξαν αφότου τα είδε ο άνθρωπος, 409 και επανυπολογισμός,
 * ποτέ έγκριση πάνω σε άλλη εικόνα από αυτή που εγκρίθηκε.
 * @module server/catalog/import-apply.server
 */

import type { AuthContext } from '@/lib/auth';
import { modelDefinitionOf, productDefinitionOf } from '@/subapps/catalog/aggregate/edit-aggregate';
import { mergeFieldsIntoValues } from '@/subapps/catalog/import/proposal-values';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import type { ImportBatchDefinition, ImportProposalDefinition, ImportProposalField, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { PriceLineInput } from '@/subapps/catalog/types/price-list-requests';
import type { StoredCatalogProductDefinition, StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import type { StoredPriceListLineDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import { commitAggregate, type CommittedAggregate, type HolderChange } from './catalog-aggregate.server';
import { assertRevision, naturalKeyId, readForUpsert, readOwned, runCatalogTransaction, stageReplace, type CatalogTx } from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import { assertPurposeAuthority } from './import-batch-writer.server';
import { proposalDefinitionOf, settleImportBatch, type StoredImportProposal } from './import-proposal-writer.server';
import { stagePriceLineBatch } from './price-line-writer.server';

const accepted = (field: ImportProposalField): boolean => field.decision === 'accept';
const hasAccepted = (row: ImportProposalRow): boolean => row.fields.some(accepted);
const CATALOG_BLOCKERS = new Set(['modelCodeMissing', 'levelUnsupported', 'priceIncomplete', 'uniqueValueTaken']);

/** Τι εμποδίζει την έγκριση: πεδίο σε εκκρεμότητα, ή γραμμή που δεν γίνεται να γραφτεί. */
function assertDecided(proposal: ImportProposalDefinition): void {
  const pending = proposal.rows.some((row) => row.fields.some((field) => field.decision === 'pending'));
  if (pending) throw new CatalogWriteError('confirmationRequired');
  const blocked = proposal.rows.some((row) => hasAccepted(row) && row.issues.some((issue) => CATALOG_BLOCKERS.has(issue.code)));
  if (blocked) throw new CatalogWriteError('confirmationRequired');
}

async function modelChange(scope: CatalogTx, proposal: ImportProposalDefinition, row: ImportProposalRow, categoryIds: readonly string[]): Promise<HolderChange | null> {
  if (row.holderId === null) {
    return {
      op: 'create',
      kind: 'productModel',
      definition: { code: proposal.modelCode ?? '', familyId: proposal.familyId ?? '', variantSchemeCode: proposal.variantSchemeCode ?? '', parentId: null, categoryIds, noValueReasons: {}, values: mergeFieldsIntoValues({}, row.fields, accepted) },
    };
  }
  if (!hasAccepted(row)) return null;
  const current = await readOwned<StoredCatalogProductModelDefinition>(scope, 'productModel', row.holderId);
  const definition = { ...modelDefinitionOf(current), values: mergeFieldsIntoValues(current.values, row.fields, accepted) };
  return { op: 'update', kind: 'productModel', id: row.holderId, expectedRevision: row.expectedRevision ?? current.revision, definition };
}

async function productChange(scope: CatalogTx, proposal: ImportProposalDefinition, row: ImportProposalRow, rootId: string | null, categoryIds: readonly string[]): Promise<HolderChange | null> {
  if (!hasAccepted(row)) return null;
  if (row.holderId === null) {
    const values = mergeFieldsIntoValues({}, row.fields, accepted);
    return { op: 'create', kind: 'product', requestedId: null, definition: { modelId: rootId, familyId: proposal.familyId ?? '', categoryIds, noValueReasons: {}, values } };
  }
  const current = await readOwned<StoredCatalogProductDefinition>(scope, 'product', row.holderId);
  const definition = { ...productDefinitionOf(current), values: mergeFieldsIntoValues(current.values, row.fields, accepted) };
  return { op: 'update', kind: 'product', id: row.holderId, expectedRevision: row.expectedRevision ?? current.revision, definition };
}

function rootIdOf(scope: CatalogTx, proposal: ImportProposalDefinition, modelRow: ImportProposalRow | undefined): string | null {
  if (!modelRow) return null;
  return modelRow.holderId ?? naturalKeyId(scope, 'productModel', proposal.modelCode ?? '');
}

/** Οι γραμμές με τα ids που γεννήθηκαν: η βάση της επόμενης σύγκρισης τριών σημείων. */
function rowsWithHolders(rows: readonly ImportProposalRow[], committed: CommittedAggregate): ImportProposalRow[] {
  let created = 0;
  return rows.map((row) => {
    if (row.holderId !== null || (!hasAccepted(row) && row.holderKind === 'product')) return row;
    return { ...row, holderId: committed.createdIds[created++] ?? null };
  });
}

async function applyAttributes(scope: CatalogTx, proposal: StoredImportProposal, categoryIds: readonly string[]): Promise<readonly ImportProposalRow[]> {
  const modelRow = proposal.rows.find((row) => row.holderKind === 'productModel');
  const rootId = rootIdOf(scope, proposal, modelRow);
  const changes: HolderChange[] = [];
  if (modelRow) {
    const change = await modelChange(scope, proposal, modelRow, categoryIds);
    if (change) changes.push(change);
  }
  for (const row of proposal.rows.filter((candidate) => candidate.holderKind === 'product')) {
    const change = await productChange(scope, proposal, row, rootId, categoryIds);
    if (change) changes.push(change);
  }
  if (changes.length === 0) return proposal.rows;
  const created = changes.some((change) => change.op === 'create' && change.kind === 'productModel');
  return rowsWithHolders(proposal.rows, await commitAggregate(scope, created ? null : rootId, changes));
}

function fieldValue<T extends ImportProposalField['incoming']>(row: ImportProposalRow, field: string): T | null {
  const found = row.fields.find((candidate) => accepted(candidate) && candidate.target.kind === 'price' && candidate.target.field === field);
  return (found?.incoming ?? null) as T | null;
}

type Money = Extract<ImportProposalField['incoming'], { type: 'money' }>;
type Quantity = Extract<ImportProposalField['incoming'], { type: 'priceQuantity' }>;
type Unit = Extract<ImportProposalField['incoming'], { type: 'unit' }>;
type DiscountGroup = Extract<ImportProposalField['incoming'], { type: 'discountGroup' }>;

/** Η γραμμή μετά την έγκριση: ό,τι δεν έφερε η πηγή μένει όπως είναι (ανάλυση κόστους, ομάδα έκπτωσης). */
function priceLineOf(row: ImportProposalRow, variantId: string, live: StoredPriceListLineDefinition | null): PriceLineInput | null {
  const netPrice = fieldValue<Money>(row, 'netPrice')?.minor ?? live?.netPrice;
  const unitCode = fieldValue<Unit>(row, 'unitCode')?.unitCode ?? live?.unitCode;
  if (netPrice === undefined || unitCode === undefined) return null;
  const discount = fieldValue<DiscountGroup>(row, 'discountGroup');
  return {
    subject: { kind: 'variant', variantId },
    netPrice,
    unitCode,
    priceQuantity: fieldValue<Quantity>(row, 'priceQuantity')?.quantity ?? live?.priceQuantity ?? 1,
    discountGroupId: discount ? discount.discountGroupId : (live?.discountGroupId ?? null),
    breakdown: live?.breakdown ?? null,
  };
}

/** Η πρόχειρη άλλαξε αφότου υπολογίστηκε η διαφορά ⇒ 409 και επανυπολογισμός. */
function assertLineUnchanged(row: ImportProposalRow, live: StoredPriceListLineDefinition | null): void {
  const seen = row.fields.find((field) => field.target.kind === 'price' && field.target.field === 'netPrice')?.live;
  const before = seen?.type === 'money' ? seen.minor : null;
  if (before !== (live?.netPrice ?? null)) throw new CatalogWriteError('revisionMismatch', [], { currentRevision: 0 });
}

async function applyPrices(scope: CatalogTx, proposal: StoredImportProposal): Promise<readonly ImportProposalRow[]> {
  const versionId = proposal.priceListVersionId ?? '';
  const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', versionId);
  const upserts: PriceLineInput[] = [];
  for (const row of proposal.rows.filter((candidate) => hasAccepted(candidate) && candidate.holderId !== null)) {
    const variantId = row.holderId ?? '';
    const key = priceListLineKey(version.id, priceLineSubjectKey({ kind: 'variant', variantId }));
    const { current } = await readForUpsert<StoredPriceListLineDefinition>(scope, 'priceListLine', key);
    assertLineUnchanged(row, current);
    const line = priceLineOf(row, variantId, current);
    if (line) upserts.push(line);
    else assertNoIssues([{ code: 'priceAmountInvalid', path: row.rowKey }]);
  }
  if (upserts.length > 0) await stagePriceLineBatch(scope, version.id, { expectedLinesRevision: version.derived.linesRevision, upserts, deletes: [] });
  return proposal.rows;
}

/** `POST /api/catalog/import-proposals/[id]/apply`. Ιδεμπότητη: εφαρμοσμένη πρόταση επιστρέφεται όπως είναι. */
export async function applyImportProposal(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredImportProposal> {
  const applied = await commitProposal(ctx, id, expectedRevision);
  await settleImportBatch(ctx, applied.batchId);
  return applied;
}

function commitProposal(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredImportProposal> {
  return runCatalogTransaction(ctx, async (scope) => {
    const proposal = await readOwned<ImportProposalDefinition>(scope, 'importProposal', id);
    if (proposal.status === 'applied') return proposal;
    assertRevision(proposal, expectedRevision);
    await assertPurposeAuthority(ctx, proposal.purpose);
    if (proposal.status !== 'pending') throw new CatalogWriteError('immutable', [{ code: 'fieldImmutable', path: 'status', params: { field: 'status' } }]);
    assertDecided(proposal);
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', proposal.batchId);
    const categoryIds = batch.target.purpose === 'attributes' ? batch.target.categoryIds : [];
    const rows = proposal.purpose === 'attributes' ? await applyAttributes(scope, proposal, categoryIds) : await applyPrices(scope, proposal);
    return stageReplace(scope, 'importProposal', proposal, { ...proposalDefinitionOf(proposal), rows, status: 'applied', appliedAt: scope.now, appliedBy: ctx.uid });
  });
}
