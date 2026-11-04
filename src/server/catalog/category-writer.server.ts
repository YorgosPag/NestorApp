import 'server-only';

/**
 * Ο **γραφέας του δέντρου κατηγοριών** (ADR-923 §5.2). Ο `ancestorIds` είναι παράγωγο που γράφει **μόνο**
 * αυτός: στη γέννηση από τον γονέα, στη μετακίνηση για **ολόκληρο** το υποδέντρο μέσα στην **ίδια**
 * συναλλαγή (κανείς δεν βλέπει ποτέ μισομετακινημένο κλάδο). Έλεγχος κύκλου και βάθους υποδέντρου πριν
 * από κάθε εγγραφή (`validateCategoryPlacement`). Η σειρά ανάμεσα στα αδέλφια = fractional `orderKey`:
 * η αναδιάταξη γράφει **ένα** έγγραφο.
 * @module server/catalog/category-writer.server
 */

import { hasPermission, type AuthContext } from '@/lib/auth';
import { hasAnyLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import {
  ancestorsUnder,
  rebaseSubtree,
  validateCategoryPlacement,
  type CategoryNode,
} from '@/subapps/catalog/schema/category-tree';
import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogCategoryDefinition, CatalogCategoryMappings } from '@/subapps/catalog/types/category';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import { categoryVatSource, vatRateShifts } from '@/subapps/catalog/schema/category-vat';
import { readActiveByIds, readCategoryDescendants } from './catalog-library-reads.server';
import {
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';

type StoredCategory = StoredCatalogRecord<CatalogCategoryDefinition>;

/**
 * Όριο εγγραφών υποδέντρου σε μία μετακίνηση — κάτω από το όριο των 500 εγγραφών ανά συναλλαγή της
 * Firestore, με περιθώριο για τον ίδιο τον κόμβο. Μεγαλύτερος κλάδος μετακινείται σε τμήματα.
 */
const MAX_SUBTREE_MOVE = 450;

export interface CreateCategoryInput {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly parentId: string | null;
  readonly orderKey: string;
  readonly mappings: CatalogCategoryMappings;
  /** ADR-923 §5.13 Ε3 — απών ⇒ αδήλωτος. */
  readonly vatRate?: GreekVatRatePercent | null;
}

/** Η αλλαγή κατηγορίας. `vatRate` απών ⇒ μένει ό,τι ήταν (πελάτης χωρίς το πεδίο δεν το σβήνει). */
export interface UpdateCategoryPatch {
  readonly labels: LocalizedText;
  readonly mappings: CatalogCategoryMappings;
  readonly vatRate?: GreekVatRatePercent | null;
}

const VAT_AUTHORITY: readonly CatalogIssue[] = [{ code: 'vatRatePricingAuthority', path: 'vatRate' }];
const MOVE_VAT_AUTHORITY: readonly CatalogIssue[] = [{ code: 'vatRatePricingAuthority', path: 'parentId' }];

/**
 * Χ4: ο συντελεστής ΦΠΑ είναι **φορολογική** ρύθμιση της τελικής τιμής, όχι σχήμα. Η διαδρομή κρίνει `catalog:schema:manage`·
 * η **αλλαγή** του συντελεστή θέλει επιπλέον το δικαίωμα τιμολόγησης (SAP: tax classification στα δεδομένα πωλήσεων, όχι στο υλικό).
 * Ίδιος συντελεστής με πριν ⇒ κανένας έλεγχος, ώστε η φόρμα να αποθηκεύει ετικέτες χωρίς το δικαίωμα.
 */
async function assertVatAuthority(ctx: AuthContext, before: GreekVatRatePercent | null, after: GreekVatRatePercent | null): Promise<void> {
  if (before === after) return;
  if (!(await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing))) throw new CatalogWriteError('invalid', VAT_AUTHORITY);
}

function assertLabelled(labels: LocalizedText): void {
  assertNoIssues(hasAnyLocalizedText(labels) ? [] : [{ code: 'labelRequired', path: 'labels' }]);
}

async function readParent(scope: CatalogTx, parentId: string | null): Promise<StoredCategory | null> {
  if (parentId === null) return null;
  try {
    return await readOwned<CatalogCategoryDefinition>(scope, 'category', parentId);
  } catch (error) {
    if (error instanceof CatalogWriteError && error.kind === 'notFound') {
      throw new CatalogWriteError('invalid', [{ code: 'categoryParentUnknown', path: 'parentId' }]);
    }
    throw error;
  }
}

export async function createCatalogCategory(ctx: AuthContext, input: CreateCategoryInput): Promise<StoredCategory> {
  assertLabelled(input.labels);
  await assertVatAuthority(ctx, null, input.vatRate ?? null);
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'category', input.code);
    const parent = await readParent(scope, input.parentId);
    assertNoIssues(validateCategoryPlacement(null, input.parentId, parent ? [parent] : []));
    return stageCreate(scope, 'category', target, { ...input, ancestorIds: ancestorsUnder(parent) });
  });
}

export async function updateCatalogCategory(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  patch: UpdateCategoryPatch,
): Promise<StoredCategory> {
  assertLabelled(patch.labels);
  // Το δικαίωμα κρίνεται πριν από τη συναλλαγή (δίκτυο)· η σύγκριση με το τρέχον, μέσα της (CAS).
  const vatAllowed = patch.vatRate === undefined || (await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing));
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogCategoryDefinition>(scope, 'category', id);
    assertRevision(current, expectedRevision);
    const { labels, mappings, vatRate } = patch;
    if (vatRate !== undefined && vatRate !== (current.vatRate ?? null)) assertNoIssues(vatAllowed ? [] : VAT_AUTHORITY);
    return stageReplace(scope, 'category', current, { ...current, labels, mappings, ...(vatRate === undefined ? {} : { vatRate }) });
  });
}

/**
 * Χ4 στη μετακίνηση (ανασκόπηση Μ-1): κατηγορία χωρίς δικό της συντελεστή, κάτω από ρίζα με άλλον, αλλάζει την τελική τιμή προς τον
 * καταναλωτή **χωρίς** να γραφτεί κανένα `vatRate`. Κρίνεται ο **ενεργός** συντελεστής πριν/μετά, για τον κόμβο **και** κάθε
 * απόγονο, μέσα στην ίδια συναλλαγή (ίδιο στιγμιότυπο με την εγγραφή)· αν αλλάζει έστω ένας ⇒ θέλει το δικαίωμα τιμολόγησης.
 */
async function assertMoveKeepsVat(
  scope: CatalogTx,
  subtree: { readonly nodes: readonly StoredCategory[]; readonly parent: StoredCategory | null },
  rebased: ReadonlyMap<string, readonly string[]>,
  pricingAllowed: boolean,
): Promise<void> {
  if (pricingAllowed) return;
  const { nodes, parent } = subtree;
  const ancestorIds = [...(nodes[0]?.ancestorIds ?? []), ...(parent ? ancestorsUnder(parent) : [])];
  const byId = new Map<string, StoredCategory>(await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', ancestorIds));
  for (const node of nodes) byId.set(node.id, node);
  if (vatRateShifts(nodes, rebased, byId).length > 0) assertNoIssues(MOVE_VAT_AUTHORITY);
}

/**
 * Συναλλαγή πάνω σε **υπάρχουσα** κατηγορία (CAS), με το δικαίωμα τιμολόγησης κριμένο **πριν** από αυτήν (δίκτυο εκτός
 * συναλλαγής)· το αν αλλάζει ο ενεργός συντελεστής ΦΠΑ κρίνεται μέσα της, πάνω στο ίδιο στιγμιότυπο με την εγγραφή (Χ4).
 */
async function onExistingCategory<T>(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  work: (scope: CatalogTx, current: StoredCategory, pricingAllowed: boolean) => Promise<T>,
): Promise<T> {
  const pricingAllowed = await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing);
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogCategoryDefinition>(scope, 'category', id);
    assertRevision(current, expectedRevision);
    return work(scope, current, pricingAllowed);
  });
}

/** Μετακίνηση κάτω από άλλο γονέα (ή στη ρίζα) και/ή αλλαγή θέσης ανάμεσα στα αδέλφια. */
export async function moveCatalogCategory(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  target: { readonly parentId: string | null; readonly orderKey: string },
): Promise<StoredCategory> {
  return onExistingCategory(ctx, id, expectedRevision, async (scope, current, pricingAllowed) => {
    const parent = await readParent(scope, target.parentId);
    const descendants = await readCategoryDescendants(scope, id);
    if (descendants.length > MAX_SUBTREE_MOVE) {
      throw new CatalogWriteError('invalid', [{ code: 'tooMany', path: 'parentId', params: { max: MAX_SUBTREE_MOVE } }]);
    }
    const nodes: CategoryNode[] = [current, ...(parent ? [parent] : []), ...descendants];
    assertNoIssues(validateCategoryPlacement(current, target.parentId, nodes));
    const rebased = rebaseSubtree(current, parent, nodes);
    await assertMoveKeepsVat(scope, { nodes: [current, ...descendants], parent }, rebased, pricingAllowed);
    for (const descendant of descendants) {
      stageReplace(scope, 'category', descendant, {
        ...descendant,
        ancestorIds: rebased.get(descendant.id) ?? descendant.ancestorIds,
      });
    }
    return stageReplace(scope, 'category', current, {
      ...current,
      parentId: target.parentId,
      orderKey: target.orderKey,
      ancestorIds: rebased.get(current.id) ?? ancestorsUnder(parent),
    });
  });
}

/**
 * Χ4 στη διαγραφή (3ος γύρος ανασκόπησης, Δ-1): κατηγορία που **φέρει** ενεργό συντελεστή (δικό της ή κληρονομημένο) αλλάζει τον
 * συντελεστή κάθε SKU που την έχει, όταν χαθεί — από αντίφαση σε έναν συντελεστή (νέα τελική τιμή), ή από συντελεστή σε κανέναν
 * («Κατόπιν προσφοράς»). Κατηγορία χωρίς ενεργό συντελεστή δεν συνεισφέρει σε κανέναν κλάδο, άρα σβήνεται χωρίς τιμολόγηση.
 */
async function assertDeleteKeepsVat(scope: CatalogTx, current: StoredCategory, pricingAllowed: boolean): Promise<void> {
  if (pricingAllowed) return;
  const ancestors = await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', current.ancestorIds);
  if (categoryVatSource(current.vatRate ?? null, current.ancestorIds, ancestors).kind !== 'none') assertNoIssues(VAT_AUTHORITY);
}

export async function deleteCatalogCategory(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredCategory> {
  return onExistingCategory(ctx, id, expectedRevision, async (scope, current, pricingAllowed) => {
    const descendants = await readCategoryDescendants(scope, id);
    if (descendants.length > 0) throw new CatalogWriteError('inUse', [], { children: descendants.length });
    await assertDeleteKeepsVat(scope, current, pricingAllowed);
    return stageSoftDelete(scope, 'category', current);
  });
}
