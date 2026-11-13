import 'server-only';

/**
 * **Ο ένας γραφέας ενός ξαναχτισμένου πίνακα** (ADR-923 §5.5.2 Β3.2) — αποφάσεις γραμμής, προτάσεις, απόσυρση και «απέξω» σε **μία**
 * συναλλαγή.
 *
 * Ως το Β3.2 η ίδια πράξη γραφόταν σε 4–5 χωριστές συναλλαγές (απόφαση · πρόταση ιδιοτήτων · πρόταση τιμών · απόσυρση · απέξω): live
 * 2026-11-13 η απόφαση «+Φάσεις» γράφτηκε, η πρόταση έσκασε, και ο έλεγχος έδειχνε «Αντιστοιχίστηκε» πάνω σε πρόταση χωρίς το κελί.
 * Σε **μία** βάση η πρακτική είναι μία συναλλαγή (όλα ή τίποτα, επανεκτέλεση σε σύγκρουση)· η αντισταθμιστική αναίρεση (saga) είναι για
 * πράξεις που διασχίζουν συστήματα.
 *
 * 🔑 **Δύο φάσεις μέσα στη συναλλαγή** (Firestore: όλες οι αναγνώσεις πριν από κάθε εγγραφή, και τα `stage*` γράφουν αμέσως):
 *    πρώτα ανάγνωση + σχέδιο κάθε ομάδας (`planGroup`), μετά οι εγγραφές. Η πρόταση τιμών παίρνει την ταυτότητα από το **σχέδιο** της
 *    αδελφής (`siblingOfPlan`), γιατί μέσα στη συναλλαγή εκείνη δεν έχει γραφτεί ακόμη.
 * 🔑 **Αισιόδοξος έλεγχος των εισόδων:** ο πίνακας κρίθηκε στη μνήμη πάνω σε συγκεκριμένες αποφάσεις (`PreparedTable.overrides`). Αν οι
 *    αποφάσεις του πίνακα στη συναλλαγή, μετά την αλλαγή του καλούντα, δεν είναι οι ίδιες ⇒ `revisionMismatch` και ο καλών ξανακρίνει
 *    (`retryOnRevisionMismatch`). Ποτέ παράγωγο γραμμένο πάνω σε αποφάσεις άλλες από εκείνες που αποθηκεύονται δίπλα του.
 * 🔑 Η σφραγίδα της σελίδας ανανεώνει το αποτύπωμα αποφάσεων **μόνο** αν η σελίδα ήταν ήδη συνεπής (`pagesAfterTable`).
 * @module server/catalog/import-table-commit.server
 */

import type { AuthContext } from '@/lib/auth';
import { priceGroupKeyOf } from '@/subapps/catalog/import/import-keys';
import { sameDerivingOverrides, tableOverridesOf } from '@/subapps/catalog/import/page-line-overrides';
import type { PageTableReading } from '@/subapps/catalog/import/page-table-reading';
import type { ExtractedGroup, ImportBatchDefinition, ImportLineOverride } from '@/subapps/catalog/types/catalog-import';
import { readOwned, runCatalogTransaction, stageReplace, stageSoftDelete, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { assertImportBatchOpen, batchDefinitionOf, pagesAfterTable, pagesOrRefuse } from './import-batch-writer.server';
import type { ProposalSibling } from './import-proposal-plan.server';
import {
  planGroup,
  readGroupInputs,
  readGroupSlot,
  siblingOfPlan,
  writeGroup,
  type GroupInputs,
  type GroupPlan,
  type GroupSlot,
  type StoredImportProposal,
} from './import-proposal-writer.server';
import { groupKeyOf, type PreparedTable } from './import-table-rebuild.server';

/** Οι αποφάσεις του πίνακα ξαναγραμμένες από τον καλούντα πάνω στις τρέχουσες της συναλλαγής· απούσα = δεν αλλάζουν. */
export type TableRewrite = (own: readonly ImportLineOverride[]) => ImportLineOverride[];

/** Οι προτάσεις του πίνακα: ιδιότητες **πριν** από τιμές, γιατί η πρόταση τιμών παίρνει την ταυτότητα από εκείνη (§5.5.2 Β4 Δ4). */
const attributesFirst = (reading: PageTableReading): ExtractedGroup[] =>
  [...reading.groups].sort((a, b) => Number(a.purpose === 'priceLines') - Number(b.purpose === 'priceLines'));

/** Τα δύο έγγραφα πρότασης που ανήκουν στον πίνακα (ιδιότητες · τιμές): ντετερμινιστικά id, άρα χωρίς ερώτημα. */
const ownKeysOf = ({ basis }: PreparedTable): readonly string[] => {
  const attributes = groupKeyOf(basis.page, basis.table.key);
  return [attributes, priceGroupKeyOf(attributes)];
};

/** Ο φρουρός των εισόδων: οι αποφάσεις που θα αποθηκευτούν για τον πίνακα είναι αυτές πάνω στις οποίες κρίθηκε. */
function assertJudgedOn(batch: StoredCatalogRecord<ImportBatchDefinition>, prepared: PreparedTable, rewrite: TableRewrite | undefined): void {
  const { page, table } = prepared.basis;
  const own = tableOverridesOf(batch.pages?.lineOverrides, page, table.key);
  if (!sameDerivingOverrides(rewrite ? rewrite(own) : own, prepared.overrides)) {
    throw new CatalogWriteError('revisionMismatch', [], { currentRevision: batch.revision });
  }
}

interface PlannedTable {
  readonly plans: ReadonlyArray<{ readonly slot: GroupSlot; readonly plan: GroupPlan }>;
  readonly stale: readonly StoredImportProposal[];
}

/** Φάση ανάγνωσης: κάθε ομάδα σχεδιάζεται (η πρόταση τιμών με την αδελφή της από το σχέδιο)· εκκρεμείς προτάσεις του πίνακα που δεν ξαναβρέθηκαν φεύγουν. */
async function planTable(scope: CatalogTx, batch: StoredCatalogRecord<ImportBatchDefinition>, prepared: PreparedTable, inputs: readonly GroupInputs[]): Promise<PlannedTable> {
  const keys = ownKeysOf(prepared);
  const slots = new Map(await Promise.all(keys.map(async (key) => [key, await readGroupSlot(scope, batch.id, key)] as const)));
  const plans: { slot: GroupSlot; plan: GroupPlan }[] = [];
  let sibling: ProposalSibling | undefined;
  for (const input of inputs) {
    const slot = slots.get(input.group.groupKey) ?? (await readGroupSlot(scope, batch.id, input.group.groupKey));
    const plan = await planGroup(scope, batch, input, slot, input.group.purpose === 'priceLines' ? sibling : undefined);
    if (input.group.purpose !== 'priceLines') sibling = siblingOfPlan(plan);
    plans.push({ slot, plan });
  }
  const planned = new Set(inputs.map((input) => input.group.groupKey));
  const stale = keys.flatMap((key) => {
    const current = planned.has(key) ? null : slots.get(key)?.current ?? null;
    return current?.status === 'pending' ? [current] : [];
  });
  return { plans, stale };
}

/**
 * Γράφει ό,τι κρίθηκε, **ατομικά**: οι αποφάσεις του πίνακα (`rewrite`) · οι προτάσεις του · η απόσυρση όσων δεν ξαναβρέθηκαν · το «απέξω»
 * του πίνακα · το αποτύπωμα της σελίδας. Οι αναγνώσεις που δεν χρειάζονται συνέπεια (μνήμη τιμών · ταυτότητα · βάση σύγκρισης) γίνονται
 * πριν (`readGroupInputs`)· η συναλλαγή ελέγχει ότι οι αναθεωρήσεις τους δεν άλλαξαν.
 */
export async function commitTable(ctx: AuthContext, batchId: string, prepared: PreparedTable, rewrite?: TableRewrite): Promise<void> {
  const groups = attributesFirst(prepared.reading);
  const inputs = await Promise.all(groups.map((group) => readGroupInputs(ctx, batchId, group)));
  const { page, table } = prepared.basis;
  const { setAside, unmappedLines } = prepared.reading;
  await runCatalogTransaction(ctx, async (scope) => {
    const batch = await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId);
    assertImportBatchOpen(batch);
    assertJudgedOn(batch, prepared, rewrite);
    const pages = pagesAfterTable(pagesOrRefuse(batch), { page, table: table.key, rewrite, leftOut: { setAside, unmappedLines } });
    const { plans, stale } = await planTable(scope, batch, prepared, inputs);
    // ── από εδώ και κάτω μόνο εγγραφές ──
    for (const { slot, plan } of plans) if (plan.kind === 'planned') writeGroup(scope, slot, plan.definition);
    for (const proposal of stale) stageSoftDelete(scope, 'importProposal', proposal);
    stageReplace(scope, 'importBatch', batch, { ...batchDefinitionOf(batch), pages });
  });
}
