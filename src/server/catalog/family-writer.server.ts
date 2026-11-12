import 'server-only';

/**
 * Ο **γραφέας οικογενειών προϊόντων** (ADR-923 §5.2). Η οικογένεια είναι **ένα** έγγραφο και επικυρώνεται
 * **ολόκληρη** απέναντι στη βιβλιοθήκη **όπως είναι μέσα στη συναλλαγή**: αν κάποιος διέγραψε ή άλλαξε μια
 * ιδιότητα ένα δευτερόλεπτο πριν, η επικύρωση το βλέπει — δεν υπάρχει παράθυρο όπου η οικογένεια δείχνει σε
 * κάτι που δεν υπάρχει. Το `attributeIds` είναι **παράγωγο** (για «ποιος χρησιμοποιεί αυτή την ιδιότητα;»)
 * και το γράφει μόνο αυτός.
 *
 * 🔒 Από τη Φάση 2 (ADR-923 §5.10 Θωράκιση 2): με προϊόντα, κλειδώνουν οι άξονες/επίπεδα των σχημάτων που
 * χρησιμοποιούνται, η μετακίνηση ιδιότητας με τιμές σε άλλο επίπεδο, η αφαίρεση ιδιότητας με τιμές και η διαγραφή
 * (`schema-product-locks.server.ts`).
 * @module server/catalog/family-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { familyDefinitionOf } from '@/subapps/catalog/schema/family-binding';
import { validateFamily } from '@/subapps/catalog/schema/validate-family';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import {
  deriveFamilyAttributeIds,
  type CatalogFamilyDefinition,
  type StoredCatalogFamilyDefinition,
} from '@/subapps/catalog/types/family';
import { readAttributesByIds, readMeasurementRegistry } from './catalog-library-reads.server';
import {
  assertCodeUnchanged,
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
import { toStored, validateAgainstLibrary } from './attribute-writer.server';
import { assertNoIssues } from './catalog-write-error';
import { assertFamilyChangeKeepsProducts, assertFamilyHasNoProducts } from './schema-product-locks.server';

type StoredFamily = StoredCatalogRecord<StoredCatalogFamilyDefinition>;

async function validatedForStorage(
  scope: CatalogTx,
  definition: CatalogFamilyDefinition,
): Promise<StoredCatalogFamilyDefinition> {
  const attributeIds = deriveFamilyAttributeIds(definition);
  const library = await readAttributesByIds(scope, attributeIds);
  const registry = await readMeasurementRegistry(scope);
  assertNoIssues(validateFamily(definition, library, registry));
  return { ...definition, attributeIds };
}

export async function createCatalogFamily(ctx: AuthContext, definition: CatalogFamilyDefinition): Promise<StoredFamily> {
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'family', definition.code);
    const stored = await validatedForStorage(scope, definition);
    return stageCreate(scope, 'family', target, stored);
  });
}

export async function updateCatalogFamily(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: CatalogFamilyDefinition,
): Promise<StoredFamily> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<StoredCatalogFamilyDefinition>(scope, 'family', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    const stored = await validatedForStorage(scope, definition);
    await assertFamilyChangeKeepsProducts(scope, id, current, definition);
    return stageReplace(scope, 'family', current, stored);
  });
}

/** Διαγραφή = soft, **μόνο** όσο η οικογένεια δεν έχει μοντέλα ή προϊόντα (Θωράκιση 2). */
export async function deleteCatalogFamily(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredFamily> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<StoredCatalogFamilyDefinition>(scope, 'family', id);
    assertRevision(current, expectedRevision);
    await assertFamilyHasNoProducts(scope, id);
    return stageSoftDelete(scope, 'family', current);
  });
}

/** Νέα ιδιότητα **μέσα** σε οικογένεια: ο ορισμός της, και πού μπαίνει (δέσιμο · επίπεδο · κανάλια) όταν μάθει το id της. */
export interface AttributeIntoFamily {
  readonly definition: CatalogAttributeDefinition;
  readonly familyId: string;
  readonly place: (family: CatalogFamilyDefinition, attributeId: string) => CatalogFamilyDefinition;
}

/**
 * Ιδιότητα της βιβλιοθήκης **και** δέσιμο στην οικογένεια σε **μία** συναλλαγή (ADR-923 §5.5.2 Β3 Γ11): ή γίνονται και τα δύο, ή κανένα
 * — καμία ορφανή ιδιότητα όταν η οικογένεια αρνηθεί. Όλες οι αναγνώσεις πριν από τις εγγραφές (κανόνας συναλλαγής Firestore)· η
 * οικογένεια επικυρώνεται με τη νέα ιδιότητα **όπως θα γραφτεί**, γιατί μέσα στη συναλλαγή δεν διαβάζεται ακόμη.
 */
export async function createAttributeInFamily(ctx: AuthContext, request: AttributeIntoFamily): Promise<string> {
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'attribute', request.definition.code);
    const registry = await validateAgainstLibrary(scope, request.definition);
    const current = await readOwned<StoredCatalogFamilyDefinition>(scope, 'family', request.familyId);
    const next = request.place(familyDefinitionOf(current), target.id);
    const attributeIds = deriveFamilyAttributeIds(next);
    const library = await readAttributesByIds(scope, attributeIds.filter((id) => id !== target.id));
    library.set(target.id, toStored(request.definition));
    assertNoIssues(validateFamily(next, library, registry));
    await assertFamilyChangeKeepsProducts(scope, request.familyId, current, next);
    stageCreate(scope, 'attribute', target, toStored(request.definition));
    stageReplace(scope, 'family', current, { ...next, attributeIds });
    return target.id;
  });
}
